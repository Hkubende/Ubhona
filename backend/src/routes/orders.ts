import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { prisma } from "../prisma.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import {
  createStorefrontOrder,
  getRestaurantOrders,
  updateRestaurantOrderStatus,
} from "../services/order.service.js";
import { getRestaurantActivityHistory, recordActivityEvent } from "../services/activity.service.js";
import { issueOrderTrackingToken, verifyOrderTrackingToken } from "../services/order-tracking-token.service.js";
import { authAwareRateLimitKey, createRateLimiter } from "../middleware/rate-limit.js";

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

ordersRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
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
  if (query.data.restaurantId && query.data.restaurantId !== restaurant.id) {
    res.status(403).json({ error: "Forbidden for requested restaurant." });
    return;
  }
  const allowedStatuses = ["pending", "confirmed", "preparing", "ready", "completed"];
  const statusFilter = query.data.status && allowedStatuses.includes(query.data.status)
    ? query.data.status
    : undefined;
  const orders = await getRestaurantOrders({
    restaurantId: query.data.restaurantId || restaurant.id,
    status: statusFilter as "pending" | "confirmed" | "preparing" | "ready" | "completed" | undefined,
  });
  res.json(orders);
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
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        id: z.string().optional(),
        totalAmount: z.number().nonnegative(),
        paymentStatus: z.string().default("pending"),
        paymentMethod: z.string().default("manual_mpesa"),
        paymentReference: z.string().optional(),
        status: z.string().default("pending"),
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
    const order = await prisma.order.create({
      data: {
        id: body.id,
        restaurantId: restaurant.id,
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
    await prisma.analyticsEvent.create({
      data: {
        restaurantId: restaurant.id,
        orderId: order.id,
        eventType: "order_created",
        source: "admin",
        metadata: {
          itemsCount: body.items.reduce((sum, item) => sum + item.quantity, 0),
          totalAmount: body.totalAmount,
        },
      },
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "order_created",
      entityType: "order",
      entityId: order.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
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
    res.json({ ...order, trackingToken });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order." });
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
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, restaurantId: body.data.restaurantId },
    include: { items: true },
  });
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
  const order = await prisma.order.findUnique({
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
  });
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
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const rows = await getRestaurantActivityHistory({
      restaurantId: restaurant.id,
      entityType: "order",
      entityId: req.params.id,
      limit: Math.max(1, Math.min(100, Number(req.query.limit || 50))),
    });
    res.json(rows);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load order history." });
  }
});

ordersRouter.patch("/:id/status", requireAuth, authedOrderMutationLimiter, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  const body = z
    .object({
      status: z.enum(["pending", "confirmed", "preparing", "ready", "completed"]),
    })
    .parse(req.body);
  try {
    const order = await updateRestaurantOrderStatus({
      restaurantId: restaurant.id,
      orderId: req.params.id,
      status: body.status,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
    });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order status.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

ordersRouter.patch("/:id", requireAuth, authedOrderMutationLimiter, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  const body = z
    .object({
      status: z.enum(["pending", "confirmed", "preparing", "ready", "completed"]),
    })
    .parse(req.body);
  try {
    const order = await updateRestaurantOrderStatus({
      restaurantId: restaurant.id,
      orderId: req.params.id,
      status: body.status,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
    });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order status.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
});
