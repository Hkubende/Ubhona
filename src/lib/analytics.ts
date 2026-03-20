import { api } from "./api";

export type AnalyticsEventType =
  | "page_view"
  | "dish_view"
  | "ar_open"
  | "add_to_cart"
  | "checkout_start"
  | "order_placed";

export type AnalyticsEventRecord = {
  id: string;
  timestamp: string;
  restaurantId: string;
  eventType: AnalyticsEventType;
  dishId?: string;
  orderId?: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export type AnalyticsSummary = {
  periodDays: number;
  totals: {
    pageViewCount: number;
    dishViewCount: number;
    arOpenCount: number;
    addToCartCount: number;
    checkoutStartCount: number;
    orderPlacedCount: number;
  };
  rates: {
    arEngagementRate: number;
    addToCartRate: number;
    checkoutStartRate: number;
    orderConversionRate: number;
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
    checkoutStartRate: number;
    orderConversionRate: number;
    arEngagementRate: number;
  };
};

const ANALYTICS_EVENTS_KEY = "mv_analytics_events_v1";
const MAX_LOCAL_EVENTS = 4000;

function getSessionId() {
  const key = "mv_analytics_session_v1";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(key, next);
  return next;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function parseEvent(value: unknown): AnalyticsEventRecord | null {
  const row = toRecord(value);
  const restaurantId = String(row.restaurantId || "").trim();
  const eventType = String(row.eventType || "").trim() as AnalyticsEventType;
  if (!restaurantId) return null;
  if (!["page_view", "dish_view", "ar_open", "add_to_cart", "checkout_start", "order_placed"].includes(eventType)) {
    return null;
  }
  return {
    id: String(row.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    timestamp: String(row.timestamp || new Date().toISOString()),
    restaurantId,
    eventType,
    dishId: String(row.dishId || "").trim() || undefined,
    orderId: String(row.orderId || "").trim() || undefined,
    source: String(row.source || "web").trim() || "web",
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
  };
}

function readLocalEvents(): AnalyticsEventRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANALYTICS_EVENTS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => parseEvent(row))
      .filter((row): row is AnalyticsEventRecord => !!row)
      .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  } catch {
    return [];
  }
}

function writeLocalEvents(events: AnalyticsEventRecord[]) {
  const next = events.slice(-MAX_LOCAL_EVENTS);
  localStorage.setItem(ANALYTICS_EVENTS_KEY, JSON.stringify(next));
}

function pushLocalEvent(event: AnalyticsEventRecord) {
  const current = readLocalEvents();
  writeLocalEvents([...current, event]);
}

function withinDays(timestamp: string, days: number) {
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= Math.max(1, Math.floor(days)) * 24 * 60 * 60 * 1000;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSummary(value: unknown, days: number): AnalyticsSummary {
  const row = toRecord(value);
  const totals = toRecord(row.totals);
  const rates = toRecord(row.rates);
  const mostViewedDishes = Array.isArray(row.mostViewedDishes) ? row.mostViewedDishes : [];
  const mostOrderedDishes = Array.isArray(row.mostOrderedDishes) ? row.mostOrderedDishes : [];

  return {
    periodDays: Math.max(1, Math.floor(toNumber(row.periodDays) || days)),
    totals: {
      pageViewCount: toNumber(totals.pageViewCount),
      dishViewCount: toNumber(totals.dishViewCount),
      arOpenCount: toNumber(totals.arOpenCount),
      addToCartCount: toNumber(totals.addToCartCount),
      checkoutStartCount: toNumber(totals.checkoutStartCount),
      orderPlacedCount: toNumber(totals.orderPlacedCount ?? totals.orderCreatedCount),
    },
    rates: {
      arEngagementRate: toNumber(rates.arEngagementRate),
      addToCartRate: toNumber(rates.addToCartRate),
      checkoutStartRate: toNumber(rates.checkoutStartRate),
      orderConversionRate: toNumber(rates.orderConversionRate),
    },
    mostViewedDishes: mostViewedDishes.map((item) => {
      const dish = toRecord(item);
      return {
        dishId: String(dish.dishId || ""),
        name: String(dish.name || dish.dishId || "Dish"),
        views: toNumber(dish.views),
      };
    }),
    mostOrderedDishes: mostOrderedDishes.map((item) => {
      const dish = toRecord(item);
      return {
        dishId: String(dish.dishId || ""),
        name: String(dish.name || dish.dishId || "Dish"),
        quantity: toNumber(dish.quantity),
        revenue: toNumber(dish.revenue),
      };
    }),
  };
}

function buildSummaryFromEvents(events: AnalyticsEventRecord[], days: number): AnalyticsSummary {
  const totals: AnalyticsSummary["totals"] = {
    pageViewCount: 0,
    dishViewCount: 0,
    arOpenCount: 0,
    addToCartCount: 0,
    checkoutStartCount: 0,
    orderPlacedCount: 0,
  };

  const dishViews = new Map<string, { dishId: string; name: string; views: number }>();
  const ordered = new Map<string, { dishId: string; name: string; quantity: number; revenue: number }>();

  for (const event of events) {
    if (event.eventType === "page_view") totals.pageViewCount += 1;
    if (event.eventType === "dish_view") {
      totals.dishViewCount += 1;
      const id = event.dishId || "unknown";
      const name = String(event.metadata?.dishName || id);
      const current = dishViews.get(id) || { dishId: id, name, views: 0 };
      current.views += 1;
      dishViews.set(id, current);
    }
    if (event.eventType === "ar_open") totals.arOpenCount += 1;
    if (event.eventType === "add_to_cart") totals.addToCartCount += 1;
    if (event.eventType === "checkout_start") totals.checkoutStartCount += 1;
    if (event.eventType === "order_placed") {
      totals.orderPlacedCount += 1;
      const rawItems = Array.isArray(event.metadata?.items) ? event.metadata?.items : [];
      for (const raw of rawItems) {
        const item = toRecord(raw);
        const dishId = String(item.dishId || "").trim();
        if (!dishId) continue;
        const quantity = Math.max(1, Math.floor(toNumber(item.quantity)));
        const name = String(item.name || dishId);
        const subtotal = toNumber(item.subtotal);
        const unitPrice = toNumber(item.unitPrice);
        const row = ordered.get(dishId) || { dishId, name, quantity: 0, revenue: 0 };
        row.quantity += quantity;
        row.revenue += subtotal > 0 ? subtotal : quantity * unitPrice;
        ordered.set(dishId, row);
      }
    }
  }

  const safePct = (numerator: number, denominator: number) => (denominator > 0 ? (numerator / denominator) * 100 : 0);

  return {
    periodDays: days,
    totals,
    rates: {
      arEngagementRate: safePct(totals.arOpenCount, totals.pageViewCount),
      addToCartRate: safePct(totals.addToCartCount, totals.pageViewCount),
      checkoutStartRate: safePct(totals.checkoutStartCount, totals.pageViewCount),
      orderConversionRate: safePct(totals.orderPlacedCount, totals.checkoutStartCount),
    },
    mostViewedDishes: [...dishViews.values()].sort((a, b) => b.views - a.views).slice(0, 10),
    mostOrderedDishes: [...ordered.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
  };
}

function filterEvents(days: number, restaurantId?: string) {
  return readLocalEvents().filter((event) => {
    if (restaurantId && event.restaurantId !== restaurantId) return false;
    return withinDays(event.timestamp, days);
  });
}

export async function trackAnalyticsEvent(input: {
  restaurantId: string;
  eventType: AnalyticsEventType;
  dishId?: string;
  orderId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  const localEvent: AnalyticsEventRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    restaurantId: input.restaurantId,
    eventType: input.eventType,
    dishId: input.dishId,
    orderId: input.orderId,
    source: input.source || "web",
    metadata: input.metadata,
  };
  pushLocalEvent(localEvent);

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

export async function getAnalyticsSummary(days = 30, restaurantId?: string) {
  const safeDays = Math.max(1, Math.floor(days));
  const query = new URLSearchParams({ days: String(safeDays) });
  if (restaurantId) query.set("restaurantId", restaurantId);
  try {
    const response = await api.get<unknown>(`/analytics/summary?${query.toString()}`);
    return normalizeSummary(response, safeDays);
  } catch {
    return buildSummaryFromEvents(filterEvents(safeDays, restaurantId), safeDays);
  }
}

export async function getAnalyticsTopDishes(days = 30, restaurantId?: string) {
  const safeDays = Math.max(1, Math.floor(days));
  const query = new URLSearchParams({ days: String(safeDays) });
  if (restaurantId) query.set("restaurantId", restaurantId);
  try {
    const response = await api.get<unknown>(`/analytics/top-dishes?${query.toString()}`);
    const normalized = normalizeSummary(response, safeDays);
    return {
      periodDays: normalized.periodDays,
      mostViewedDishes: normalized.mostViewedDishes,
      mostOrderedDishes: normalized.mostOrderedDishes,
    };
  } catch {
    const summary = buildSummaryFromEvents(filterEvents(safeDays, restaurantId), safeDays);
    return {
      periodDays: safeDays,
      mostViewedDishes: summary.mostViewedDishes,
      mostOrderedDishes: summary.mostOrderedDishes,
    };
  }
}

export async function getAnalyticsConversion(days = 30, restaurantId?: string) {
  const safeDays = Math.max(1, Math.floor(days));
  const query = new URLSearchParams({ days: String(safeDays) });
  if (restaurantId) query.set("restaurantId", restaurantId);
  try {
    const response = await api.get<unknown>(`/analytics/conversion?${query.toString()}`);
    const summary = normalizeSummary(response, safeDays);
    return {
      periodDays: summary.periodDays,
      totals: summary.totals,
      rates: summary.rates,
    };
  } catch {
    const summary = buildSummaryFromEvents(filterEvents(safeDays, restaurantId), safeDays);
    return {
      periodDays: safeDays,
      totals: summary.totals,
      rates: summary.rates,
    };
  }
}
