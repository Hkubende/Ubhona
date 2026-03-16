import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export const ANALYTICS_EVENT_TYPES = [
  "page_view",
  "dish_view",
  "ar_open",
  "add_to_cart",
  "checkout_start",
  "order_created",
  "payment_success",
  "payment_failed",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

function getSince(days: number) {
  const safeDays = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 30;
  return { days: safeDays, since: new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000) };
}

export async function recordAnalyticsEvent(input: {
  restaurantId: string;
  eventType: AnalyticsEventType;
  dishId?: string;
  orderId?: string;
  source?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: { id: true },
  });
  if (!restaurant) throw new Error("Restaurant not found.");

  if (input.dishId) {
    const dish = await prisma.dish.findFirst({
      where: { id: input.dishId, restaurantId: input.restaurantId },
      select: { id: true },
    });
    if (!dish) throw new Error("Dish does not belong to this restaurant.");
  }
  if (input.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, restaurantId: input.restaurantId },
      select: { id: true },
    });
    if (!order) throw new Error("Order does not belong to this restaurant.");
  }

  return prisma.analyticsEvent.create({
    data: {
      restaurantId: input.restaurantId,
      eventType: input.eventType,
      dishId: input.dishId,
      orderId: input.orderId,
      source: input.source || "storefront",
      sessionId: input.sessionId || null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    select: { id: true, eventType: true, createdAt: true },
  });
}

export async function getAnalyticsSummary(restaurantId: string, days: number) {
  const { since, days: periodDays } = getSince(days);
  const baseWhere = { restaurantId, createdAt: { gte: since } };

  const [eventCounts, topByViews, topByOrders] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["eventType"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["dishId"],
      where: { ...baseWhere, eventType: "dish_view", dishId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { dishId: "desc" } },
      take: 10,
    }),
    prisma.orderItem.groupBy({
      by: ["dishId"],
      where: {
        order: {
          restaurantId,
          createdAt: { gte: since },
        },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const row of eventCounts) countMap.set(row.eventType, row._count._all);

  const dishIds = Array.from(
    new Set([
      ...topByViews.map((row) => String(row.dishId || "")),
      ...topByOrders.map((row) => row.dishId),
    ].filter(Boolean))
  );
  const dishes = dishIds.length
    ? await prisma.dish.findMany({
        where: { id: { in: dishIds } },
        select: { id: true, name: true },
      })
    : [];
  const dishNameById = new Map(dishes.map((dish) => [dish.id, dish.name]));

  const totals = {
    pageViewCount: countMap.get("page_view") || 0,
    dishViewCount: countMap.get("dish_view") || 0,
    arOpenCount: countMap.get("ar_open") || 0,
    addToCartCount: countMap.get("add_to_cart") || 0,
    checkoutStartCount: countMap.get("checkout_start") || 0,
    orderCreatedCount: countMap.get("order_created") || 0,
    paymentSuccessCount: countMap.get("payment_success") || 0,
    paymentFailedCount: countMap.get("payment_failed") || 0,
  };
  const rates = {
    arEngagementRate: totals.dishViewCount > 0 ? (totals.arOpenCount / totals.dishViewCount) * 100 : 0,
    addToCartRate: totals.dishViewCount > 0 ? (totals.addToCartCount / totals.dishViewCount) * 100 : 0,
    orderConversionRate: totals.checkoutStartCount > 0
      ? (totals.orderCreatedCount / totals.checkoutStartCount) * 100
      : totals.dishViewCount > 0
        ? (totals.orderCreatedCount / totals.dishViewCount) * 100
        : 0,
    paymentSuccessRate: totals.orderCreatedCount > 0
      ? (totals.paymentSuccessCount / totals.orderCreatedCount) * 100
      : 0,
  };

  return {
    periodDays,
    totals,
    rates,
    mostViewedDishes: topByViews.map((row) => ({
      dishId: String(row.dishId),
      name: dishNameById.get(String(row.dishId)) || "Unknown dish",
      views: row._count._all,
    })),
    mostOrderedDishes: topByOrders.map((row) => ({
      dishId: row.dishId,
      name: dishNameById.get(row.dishId) || "Unknown dish",
      quantity: Number(row._sum.quantity || 0),
      revenue: Number(row._sum.subtotal || 0),
    })),
  };
}

export async function getTopDishes(restaurantId: string, days: number) {
  const summary = await getAnalyticsSummary(restaurantId, days);
  return {
    periodDays: summary.periodDays,
    mostViewedDishes: summary.mostViewedDishes,
    mostOrderedDishes: summary.mostOrderedDishes,
  };
}

export async function getConversionMetrics(restaurantId: string, days: number) {
  const summary = await getAnalyticsSummary(restaurantId, days);
  return {
    periodDays: summary.periodDays,
    totals: summary.totals,
    rates: {
      addToCartRate: summary.rates.addToCartRate,
      orderConversionRate: summary.rates.orderConversionRate,
      arEngagementRate: summary.rates.arEngagementRate,
      paymentSuccessRate: summary.rates.paymentSuccessRate,
    },
  };
}
