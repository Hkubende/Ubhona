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

export const ordersRouter = Router();

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

ordersRouter.post("/", async (req, res) => {
  try {
    const body = z
      .object({
        restaurantId: z.string().min(1),
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
      })
      .parse(req.body);
    const { order } = await createStorefrontOrder(body);

    res.status(201).json({
      orderId: order.id,
      order,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order." });
  }
});

ordersRouter.post("/admin", requireAuth, async (req: AuthRequest, res) => {
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
    res.json(order);
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

ordersRouter.patch("/:id/status", requireAuth, async (req: AuthRequest, res) => {
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
    });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order status.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

ordersRouter.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
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
    });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order status.";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
});
