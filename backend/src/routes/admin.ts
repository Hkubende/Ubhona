import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAdmin } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { logAuditEvent } from "../services/audit.service.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const trackerStatusSchema = z.enum(["backlog", "planned", "in_progress", "done", "blocked"]);
const trackerItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: trackerStatusSchema,
  notes: z.string(),
  updatedAt: z.string().min(1),
});
const trackerSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  items: z.array(trackerItemSchema),
});
const trackerBoardSchema = z.object({
  updatedAt: z.string().min(1),
  sections: z.array(trackerSectionSchema),
});
const PLATFORM_TRACKER_KEY = "menuvista-platform-roadmap";

function nowIso() {
  return new Date().toISOString();
}

function makeTrackerItem(id: string, label: string) {
  return {
    id,
    label,
    status: "backlog" as const,
    notes: "",
    updatedAt: nowIso(),
  };
}

function getDefaultPlatformTrackerBoard() {
  return {
    updatedAt: nowIso(),
    sections: [
      {
        id: "customer-platform",
        title: "Customer Platform",
        description: "Customer-facing menu, AR, cart, checkout, and tracking flows.",
        items: [
          makeTrackerItem("restaurant-menu", "Restaurant Menu"),
          makeTrackerItem("ar-food-preview", "AR Food Preview"),
          makeTrackerItem("cart", "Cart"),
          makeTrackerItem("checkout", "Checkout"),
          makeTrackerItem("order-tracking", "Order Tracking"),
        ],
      },
      {
        id: "restaurant-dashboard",
        title: "Restaurant Dashboard",
        description: "Merchant onboarding and daily operations tooling.",
        items: [
          makeTrackerItem("onboarding", "Onboarding"),
          makeTrackerItem("menu-builder", "Menu Builder"),
          makeTrackerItem("order-management", "Order Management"),
          makeTrackerItem("analytics", "Analytics"),
          makeTrackerItem("branding", "Branding"),
        ],
      },
      {
        id: "payments-system",
        title: "Payments System",
        description: "STK, payment records, and callback reliability.",
        items: [
          makeTrackerItem("stk-push", "STK Push"),
          makeTrackerItem("payment-records", "Payment Records"),
          makeTrackerItem("callback-handling", "Callback Handling"),
        ],
      },
      {
        id: "platform-admin",
        title: "Platform Admin",
        description: "Admin tools for restaurants, billing, support, and usage.",
        items: [
          makeTrackerItem("restaurant-management", "Restaurant Management"),
          makeTrackerItem("subscription-plans", "Subscription Plans"),
          makeTrackerItem("support-tools", "Support Tools"),
          makeTrackerItem("usage-analytics", "Usage Analytics"),
        ],
      },
    ],
  };
}

adminRouter.get("/restaurants", async (req, res) => {
  const query = z
    .object({
      q: z.string().optional(),
      plan: z.string().optional(),
      status: z.string().optional(),
    })
    .safeParse(req.query);

  const q = query.success ? String(query.data.q || "").trim() : "";
  const plan = query.success ? String(query.data.plan || "").trim().toLowerCase() : "";
  const status = query.success ? String(query.data.status || "").trim().toLowerCase() : "";

  const restaurants = await prisma.restaurant.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(plan ? { subscriptionPlan: plan } : {}),
      ...(status ? { subscriptionStatus: status } : {}),
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          dishes: true,
          orders: true,
          categories: true,
          analyticsEvents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const orderSums = await prisma.order.groupBy({
    by: ["restaurantId"],
    _sum: { totalAmount: true },
  });
  const revenueByRestaurant = new Map(orderSums.map((row) => [row.restaurantId, Number(row._sum.totalAmount || 0)]));

  const rows = restaurants.map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    email: restaurant.email,
    phone: restaurant.phone,
    location: restaurant.location,
    subscriptionPlan: restaurant.subscriptionPlan,
    subscriptionStatus: restaurant.subscriptionStatus,
    trialEndsAt: restaurant.trialEndsAt,
    renewalDate: restaurant.renewalDate,
    createdAt: restaurant.createdAt,
    owner: restaurant.owner,
    usage: {
      categories: restaurant._count.categories,
      dishes: restaurant._count.dishes,
      orders: restaurant._count.orders,
      analyticsEvents: restaurant._count.analyticsEvents,
      revenue: revenueByRestaurant.get(restaurant.id) || 0,
    },
  }));

  res.json(rows);
});

adminRouter.patch("/restaurants/:id/status", async (req: AuthRequest, res) => {
  const body = z
    .object({
      status: z.enum(["active", "suspended"]),
      reason: z.string().max(500).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid status payload." });
    return;
  }

  const existing = await prisma.restaurant.findUnique({
    where: { id: req.params.id },
    select: { id: true, subscriptionStatus: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }

  const updated = await prisma.restaurant.update({
    where: { id: existing.id },
    data: {
      subscriptionStatus: body.data.status,
    },
  });

  await logAuditEvent({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: body.data.status === "suspended" ? "suspend_restaurant" : "reactivate_restaurant",
    targetType: "restaurant",
    targetId: existing.id,
    metadata: {
      previousStatus: existing.subscriptionStatus,
      nextStatus: body.data.status,
      reason: body.data.reason || null,
      actorEmail: req.user!.email,
      ip: req.ip || null,
      userAgent: req.get("user-agent") || null,
    },
  });

  res.json(updated);
});

adminRouter.get("/audit-logs", async (req: AuthRequest, res) => {
  const query = z
    .object({
      action: z.string().optional(),
      targetType: z.string().optional(),
      targetId: z.string().optional(),
      actorUserId: z.string().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
    })
    .safeParse(req.query);

  const params = query.success ? query.data : {};
  const limit = params.limit || 50;

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(params.action ? { action: params.action } : {}),
      ...(params.targetType ? { targetType: params.targetType } : {}),
      ...(params.targetId ? { targetId: params.targetId } : {}),
      ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json(rows);
});

adminRouter.get("/metrics", async (_req, res) => {
  const [restaurantCount, orderCount, totalRevenueAgg, plansAgg, statusAgg, failedPayments, recentOrders] =
    await Promise.all([
      prisma.restaurant.count(),
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { totalAmount: true } }),
      prisma.restaurant.groupBy({ by: ["subscriptionPlan"], _count: { _all: true } }),
      prisma.restaurant.groupBy({ by: ["subscriptionStatus"], _count: { _all: true } }),
      prisma.payment.count({ where: { status: "failed" } }),
      prisma.order.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

  res.json({
    restaurants: restaurantCount,
    orders: orderCount,
    totalRevenue: Number(totalRevenueAgg._sum.totalAmount || 0),
    recentOrders24h: recentOrders,
    failedPayments,
    planBreakdown: plansAgg.map((row) => ({ plan: row.subscriptionPlan, count: row._count._all })),
    statusBreakdown: statusAgg.map((row) => ({ status: row.subscriptionStatus, count: row._count._all })),
  });
});

adminRouter.get("/support", async (_req, res) => {
  const [failedPayments, billingFlags] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "failed" },
      include: {
        order: {
          include: {
            restaurant: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.restaurant.findMany({
      where: {
        subscriptionStatus: { in: ["past_due", "canceled", "suspended"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const paymentIssues = failedPayments.map((payment) => ({
    id: `pay-${payment.id}`,
    type: "payment_failed",
    priority: "high",
    status: "open",
    createdAt: payment.updatedAt,
    restaurantId: payment.order.restaurant.id,
    restaurantName: payment.order.restaurant.name,
    restaurantSlug: payment.order.restaurant.slug,
    summary: `Failed payment for order ${payment.orderId}`,
    details: payment.resultDesc || "Payment failed",
  }));

  const billingIssues = billingFlags.map((restaurant) => ({
    id: `billing-${restaurant.id}`,
    type: "billing_status",
    priority: "medium",
    status: "open",
    createdAt: restaurant.createdAt,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantSlug: restaurant.slug,
    summary: `Subscription status is ${restaurant.subscriptionStatus}`,
    details: `Plan: ${restaurant.subscriptionPlan}`,
  }));

  res.json([...paymentIssues, ...billingIssues].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
});

adminRouter.get("/platform-tracker", async (_req, res) => {
  const existing = await prisma.platformTrackerDocument.findUnique({
    where: { key: PLATFORM_TRACKER_KEY },
    select: { payload: true },
  });
  if (!existing) {
    const seeded = getDefaultPlatformTrackerBoard();
    const created = await prisma.platformTrackerDocument.create({
      data: {
        key: PLATFORM_TRACKER_KEY,
        payload: seeded as Prisma.InputJsonValue,
      },
      select: { payload: true },
    });
    res.json(created.payload);
    return;
  }
  const parsed = trackerBoardSchema.safeParse(existing.payload);
  if (!parsed.success) {
    const resetBoard = getDefaultPlatformTrackerBoard();
    const updated = await prisma.platformTrackerDocument.update({
      where: { key: PLATFORM_TRACKER_KEY },
      data: { payload: resetBoard as Prisma.InputJsonValue },
      select: { payload: true },
    });
    res.json(updated.payload);
    return;
  }
  res.json(parsed.data);
});

adminRouter.put("/platform-tracker", async (req, res) => {
  const body = trackerBoardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid platform tracker payload." });
    return;
  }
  const nextBoard = {
    ...body.data,
    updatedAt: nowIso(),
  };
  const saved = await prisma.platformTrackerDocument.upsert({
    where: { key: PLATFORM_TRACKER_KEY },
    update: { payload: nextBoard as Prisma.InputJsonValue },
    create: {
      key: PLATFORM_TRACKER_KEY,
      payload: nextBoard as Prisma.InputJsonValue,
    },
    select: { payload: true },
  });
  res.json(saved.payload);
});

adminRouter.post("/platform-tracker/reset", async (_req, res) => {
  const board = getDefaultPlatformTrackerBoard();
  const saved = await prisma.platformTrackerDocument.upsert({
    where: { key: PLATFORM_TRACKER_KEY },
    update: { payload: board as Prisma.InputJsonValue },
    create: {
      key: PLATFORM_TRACKER_KEY,
      payload: board as Prisma.InputJsonValue,
    },
    select: { payload: true },
  });
  res.json(saved.payload);
});
