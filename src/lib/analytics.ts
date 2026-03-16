import { api } from "./api";

export type AnalyticsEventType =
  | "page_view"
  | "dish_view"
  | "ar_open"
  | "add_to_cart"
  | "checkout_start"
  | "order_created"
  | "payment_success"
  | "payment_failed";

export type AnalyticsSummary = {
  periodDays: number;
  totals: {
    pageViewCount: number;
    dishViewCount: number;
    arOpenCount: number;
    addToCartCount: number;
    checkoutStartCount: number;
    orderCreatedCount: number;
    paymentSuccessCount: number;
    paymentFailedCount: number;
  };
  rates: {
    arEngagementRate: number;
    addToCartRate: number;
    orderConversionRate: number;
    paymentSuccessRate: number;
  };
  mostViewedDishes: Array<{
    dishId: string;
    name: string;
    views: number;
  }>;
  mostOrderedDishes: Array<{
    dishId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
};

export type AnalyticsTopDishes = {
  periodDays: number;
  mostViewedDishes: AnalyticsSummary["mostViewedDishes"];
  mostOrderedDishes: AnalyticsSummary["mostOrderedDishes"];
};

export type AnalyticsConversion = {
  periodDays: number;
  totals: AnalyticsSummary["totals"];
  rates: {
    addToCartRate: number;
    orderConversionRate: number;
    arEngagementRate: number;
    paymentSuccessRate: number;
  };
};

function getSessionId() {
  const key = "mv_analytics_session_v1";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(key, next);
  return next;
}

export async function trackAnalyticsEvent(input: {
  restaurantId: string;
  eventType: AnalyticsEventType;
  dishId?: string;
  orderId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await api.post("/analytics/events", {
      ...input,
      sessionId: getSessionId(),
      source: input.source || "web",
    });
  } catch {
    // Analytics should never block primary UX.
  }
}

export async function getAnalyticsSummary(days = 30) {
  return api.get<AnalyticsSummary>(`/analytics/summary?days=${Math.max(1, Math.floor(days))}`);
}

export async function getAnalyticsTopDishes(days = 30) {
  return api.get<AnalyticsTopDishes>(`/analytics/top-dishes?days=${Math.max(1, Math.floor(days))}`);
}

export async function getAnalyticsConversion(days = 30) {
  return api.get<AnalyticsConversion>(`/analytics/conversion?days=${Math.max(1, Math.floor(days))}`);
}
