import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { prisma, runWithTenantContext } from "../prisma.js";
import { runWithPublicStorefrontDbContext } from "../db-rls.js";
import {
  createStorefrontOrder,
  getRestaurantOrders,
  updateRestaurantOrderStatus,
} from "../services/order.service.js";
import { getRestaurantActivityHistory, recordActivityEvent } from "../services/activity.service.js";
import { issueOrderTrackingToken, verifyOrderTrackingToken } from "../services/order-tracking-token.service.js";
import { authAwareRateLimitKey, createRateLimiter } from "../middleware/rate-limit.js";
import { isOrderLifecycleStatus, ORDER_STATUS_VALUES } from "../services/order-status.service.js";
import { setOrderBranchContext } from "../services/order-context.service.js";
import { createOrderLifecycleNotifications } from "../services/notification.service.js";

export const ordersRouter = Router();
const publicOrderCreateLimiter = createRateLimiter({
  keyPrefix: "orders-public-create",
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many order attempts. Please try again in a minute.",
});
const publicOrderLookupLimiter = createRateLimiter({
  keyPrefix: "orders-public-lookup",
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many tracking requests. Please wait briefly.",
});
const authedOrderMutationLimiter = createRateLimiter({
  keyPrefix: "orders-authed-mutate",
  windowMs: 60 * 1000,
  max: 80,
  keyGenerator: authAwareRateLimitKey,
  message: "Too many order updates. Please slow down.",
});

function requireTenantUser(req: AuthRequest) {
  const restaurantId = req.user?.restaurantId;
  if (!req.user || !restaurantId) {
    throw new Error("Create restaurant profile first.");
  }

  return {
    userId: req.user.id,
    restaurantId,
    isAdmin: req.user.role === "platform_admin",
    role: req.user.role,
  };
}

ordersRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const query = z
      .object({
        restaurantId: z.string().optional(),
        status: z.string().optional(),
      })
      .safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "Invalid query params." });
      return;
    }
    if (query.data.restaurantId && query.data.restaurantId !== tenantContext.restaurantId) {
      res.status(403).json({ error: "Forbidden for requested restaurant." });
      return;
    }
    const statusFilter = query.data.status && isOrderLifecycleStatus(query.data.status) ? query.data.status : undefined;
    const orders = await getRestaurantOrders({
      restaurantId: query.data.restaurantId || tenantContext.restaurantId,
      status: statusFilter,
      userId: tenantContext.userId,
      isAdmin: tenantContext.isAdmin,
    });
    res.json(orders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list orders.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

ordersRouter.post("/", publicOrderCreateLimiter, async (req, res) => {
  try {
    const body = z
      .object({
        restaurantId: z.string().min(1),
        branchId: z.string().trim().optional(),
        items: z
          .array(
            z.object({
              dishId: z.string().min(1),
              quantity: z.number().int().positive(),
            })
          )
          .min(1),
        customerName: z.string().trim().optional(),
        customerPhone: z.string().trim().optional(),
        tableNumber: z.string().trim().optional(),
        whatsappOptIn: z.boolean().optional(),
        whatsappNumber: z.string().trim().optional(),
      })
      .parse(req.body);
    const { order } = await createStorefrontOrder(body);
    const trackingToken = issueOrderTrackingToken({
      orderId: order.id,
      restaurantId: order.restaurantId,
    });

    res.status(201).json({
      orderId: order.id,
      order,
      trackingToken,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order." });
  }
});

ordersRouter.post("/admin", requireAuth, authedOrderMutationLimiter, async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const body = z
      .object({
        id: z.string().optional(),
        branchId: z.string().trim().optional(),
        totalAmount: z.number().nonnegative(),
        paymentStatus: z.string().default("pending"),
        paymentMethod: z.string().default("manual_mpesa"),
        paymentReference: z.string().optional(),
        status: z.enum(ORDER_STATUS_VALUES).default("pending"),
        items: z
          .array(
            z.object({
              dishId: z.string(),
              nameSnapshot: z.string(),
              priceSnapshot: z.number().nonnegative(),
              quantity: z.number().int().positive(),
              subtotal: z.number().nonnegative(),
            })
          )
          .min(1),
      })
      .parse(req.body);
    const order = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async (tx) => {
        const order = await tx.order.create({
          data: {
            id: body.id,
            restaurantId: tenantContext.restaurantId,
            totalAmount: body.totalAmount,
            paymentStatus: body.paymentStatus,
            paymentMethod: body.paymentMethod,
            paymentReference: body.paymentReference || "",
            status: body.status,
            items: {
              create: body.items.map((item) => ({
                dishId: item.dishId,
                nameSnapshot: item.nameSnapshot,
                priceSnapshot: item.priceSnapshot,
                quantity: item.quantity,
                subtotal: item.subtotal,
              })),
            },
          },
          include: { items: true },
        });
        await tx.analyticsEvent.create({
          data: {
            restaurantId: tenantContext.restaurantId,
            orderId: order.id,
            eventType: "order_created",
            source: "admin",
            metadata: {
              itemsCount: body.items.reduce((sum, item) => sum + item.quantity, 0),
              totalAmount: body.totalAmount,
            },
          },
        });
        return order;
      },
    });
    await recordActivityEvent({
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      action: "order_created",
      entityType: "order",
      entityId: order.id,
      organizationId: tenantContext.restaurantId,
      restaurantId: tenantContext.restaurantId,
      source: "admin_order_entry",
      after: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        itemsCount: body.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
    const trackingToken = issueOrderTrackingToken({
      orderId: order.id,
      restaurantId: order.restaurantId,
    });
    await setOrderBranchContext({
      restaurantId: tenantContext.restaurantId,
      orderId: order.id,
      branchId: body.branchId,
    });
    await createOrderLifecycleNotifications({
      restaurantId: tenantContext.restaurantId,
      orderId: order.id,
      status: "pending",
      tableNumber: null,
      customerName: null,
    });
    res.json({ ...order, trackingToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

ordersRouter.get("/:id", async (req, res) => {
  const body = z
    .object({
      restaurantId: z.string().min(1),
    })
    .safeParse(req.query);
  if (!body.success) {
    res.status(400).json({ error: "restaurantId query param is required." });
    return;
  }
  const order = await runWithPublicStorefrontDbContext(body.data.restaurantId, () =>
    prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    })
  );
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  res.json(order);
});

ordersRouter.get("/:id/public", publicOrderLookupLimiter, async (req, res) => {
  const query = z
    .object({
      token: z.string().min(20),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(401).json({ error: "Valid order tracking token is required." });
    return;
  }
  let claims: { orderId: string; restaurantId: string };
  try {
    claims = verifyOrderTrackingToken(query.data.token, req.params.id);
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Invalid order tracking token." });
    return;
  }
  const order = await runWithPublicStorefrontDbContext(claims.restaurantId, () =>
    prisma.order.findUnique({
      where: { id: claims.orderId },
      include: {
        items: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            location: true,
          },
        },
      },
    })
  );
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  if (order.restaurantId !== claims.restaurantId) {
    res.status(403).json({ error: "Order token scope mismatch." });
    return;
  }
  const estimatedMinutesByStatus: Record<string, number> = {
    pending: 25,
    confirmed: 20,
    preparing: 12,
    ready: 0,
    completed: 0,
    cancelled: 0,
  };
  const estimatedMinutes = estimatedMinutesByStatus[String(order.status || "").toLowerCase()] ?? 20;
  res.json({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    restaurant: order.restaurant,
    estimatedMinutes,
    items: order.items.map((item: {
      id: string;
      dishId: string;
      nameSnapshot: string;
      quantity: number;
      priceSnapshot: number;
      subtotal: number;
    }) => ({
      id: item.id,
      dishId: item.dishId,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPrice: item.priceSnapshot,
      subtotal: item.subtotal,
    })),
  });
});

ordersRouter.get("/:id/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const rows = await getRestaurantActivityHistory({
      restaurantId: tenantContext.restaurantId,
      entityType: "order",
      entityId: req.params.id,
      limit: Math.max(1, Math.min(100, Number(req.query.limit || 50))),
    });
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load order history.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

ordersRouter.patch("/:id/status", requireAuth, authedOrderMutationLimiter, async (req: AuthRequest, res) => {
  const body = z
    .object({
      status: z.enum(ORDER_STATUS_VALUES),
    })
    .parse(req.body);
  try {
    const tenantContext = requireTenantUser(req);
    const order = await updateRestaurantOrderStatus({
      restaurantId: tenantContext.restaurantId,
      orderId: req.params.id,
      status: body.status,
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      isAdmin: tenantContext.isAdmin,
    });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order status.";
    const status = /not found/i.test(message) ? 404 : message === "Create restaurant profile first." ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

ordersRouter.patch("/:id", requireAuth, authedOrderMutationLimiter, async (req: AuthRequest, res) => {
  const body = z
    .object({
      status: z.enum(ORDER_STATUS_VALUES),
    })
    .parse(req.body);
  try {
    const tenantContext = requireTenantUser(req);
    const order = await updateRestaurantOrderStatus({
      restaurantId: tenantContext.restaurantId,
      orderId: req.params.id,
      status: body.status,
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      isAdmin: tenantContext.isAdmin,
    });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order status.";
    const status = /not found/i.test(message) ? 404 : message === "Create restaurant profile first." ? 400 : 500;
    res.status(status).json({ error: message });
  }
});