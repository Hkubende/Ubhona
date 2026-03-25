import { getRestaurantProfile, getCurrentPlan, getDishLimit, getMonthlyOrderLimit, type SubscriptionPlan } from "./restaurant";
import type { Order } from "./orders";

type RestaurantUsageSnapshot = {
  restaurantId: string;
  monthKey: string;
  ordersCount: number;
  revenueTotal: number;
  paymentsCount: number;
  activeDays: string[];
  dishCount: number;
  updatedAt: string;
};

export type UpgradePrompt = {
  title: string;
  message: string;
  ctaLabel: string;
  to: string;
};

export const DEFAULT_TRANSACTION_FEE_RATE = 0.015;
const USAGE_KEY = "ubhona_growth_usage_v1";

function nowIso() {
  return new Date().toISOString();
}

function getMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function sanitizeSnapshot(value: unknown): RestaurantUsageSnapshot | null {
  const row = toRecord(value);
  const restaurantId = String(row.restaurantId || "").trim();
  const monthKey = String(row.monthKey || "").trim();
  if (!restaurantId || !monthKey) return null;
  const activeDays = Array.isArray(row.activeDays)
    ? row.activeDays.map((day) => String(day)).filter((day) => day.trim().length > 0)
    : [];
  return {
    restaurantId,
    monthKey,
    ordersCount: Math.max(0, Number(row.ordersCount || 0)),
    revenueTotal: Math.max(0, Number(row.revenueTotal || 0)),
    paymentsCount: Math.max(0, Number(row.paymentsCount || 0)),
    activeDays,
    dishCount: Math.max(0, Number(row.dishCount || 0)),
    updatedAt: String(row.updatedAt || nowIso()),
  };
}

function readAllUsage(): Record<string, RestaurantUsageSnapshot> {
  try {
    const parsed = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, RestaurantUsageSnapshot> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const snapshot = sanitizeSnapshot(value);
      if (snapshot) out[key] = snapshot;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAllUsage(next: Record<string, RestaurantUsageSnapshot>) {
  localStorage.setItem(USAGE_KEY, JSON.stringify(next));
}

function usageKey(restaurantId: string, monthKey = getMonthKey()) {
  return `${restaurantId}:${monthKey}`;
}

function ensureSnapshot(restaurantId: string, monthKey = getMonthKey()) {
  const all = readAllUsage();
  const key = usageKey(restaurantId, monthKey);
  const existing = all[key];
  if (existing) return { all, key, snapshot: existing };
  const snapshot: RestaurantUsageSnapshot = {
    restaurantId,
    monthKey,
    ordersCount: 0,
    revenueTotal: 0,
    paymentsCount: 0,
    activeDays: [],
    dishCount: 0,
    updatedAt: nowIso(),
  };
  all[key] = snapshot;
  return { all, key, snapshot };
}

export function getRestaurantUsage(restaurantId: string, monthKey = getMonthKey()) {
  const all = readAllUsage();
  return all[usageKey(restaurantId, monthKey)] || {
    restaurantId,
    monthKey,
    ordersCount: 0,
    revenueTotal: 0,
    paymentsCount: 0,
    activeDays: [],
    dishCount: 0,
    updatedAt: nowIso(),
  };
}

export function trackActiveUsageDay(restaurantId: string, isoDate = nowIso()) {
  const day = isoDate.slice(0, 10);
  const { all, key, snapshot } = ensureSnapshot(restaurantId, getMonthKey(new Date(isoDate)));
  if (!snapshot.activeDays.includes(day)) snapshot.activeDays = [...snapshot.activeDays, day].sort();
  snapshot.updatedAt = nowIso();
  all[key] = snapshot;
  writeAllUsage(all);
}

export function recordOrderCreated(restaurantId: string, amount: number, isoDate = nowIso()) {
  const { all, key, snapshot } = ensureSnapshot(restaurantId, getMonthKey(new Date(isoDate)));
  snapshot.ordersCount += 1;
  snapshot.revenueTotal += Math.max(0, Number.isFinite(amount) ? amount : 0);
  snapshot.updatedAt = nowIso();
  all[key] = snapshot;
  writeAllUsage(all);
  trackActiveUsageDay(restaurantId, isoDate);
}

export function recordPaymentUpdate(order: Order, nextPaymentStatus?: string) {
  if (!order.restaurantId) return;
  const status = String(nextPaymentStatus || order.paymentStatus || "").toLowerCase();
  if (status !== "paid") return;
  const { all, key, snapshot } = ensureSnapshot(order.restaurantId, getMonthKey(new Date(order.createdAt)));
  snapshot.paymentsCount += 1;
  snapshot.updatedAt = nowIso();
  all[key] = snapshot;
  writeAllUsage(all);
  trackActiveUsageDay(order.restaurantId, order.createdAt);
}

export function setDishCount(restaurantId: string, dishCount: number) {
  const { all, key, snapshot } = ensureSnapshot(restaurantId);
  snapshot.dishCount = Math.max(0, dishCount);
  snapshot.updatedAt = nowIso();
  all[key] = snapshot;
  writeAllUsage(all);
  trackActiveUsageDay(restaurantId);
}

export function getRemainingStarterAllowance(restaurantId: string) {
  const profile = getRestaurantProfile();
  const usage = getRestaurantUsage(restaurantId);
  const plan = getCurrentPlan(profile).plan;
  const dishLimit = getDishLimit(profile);
  const monthlyOrderLimit = getMonthlyOrderLimit(profile);
  const dishesUsageFromProfile = Number(profile?.usage?.dishes);
  const ordersUsageFromProfile = Number(profile?.usage?.ordersPerMonth);
  const dishesUsed = Number.isFinite(dishesUsageFromProfile) ? dishesUsageFromProfile : usage.dishCount;
  const ordersUsed = Number.isFinite(ordersUsageFromProfile) ? ordersUsageFromProfile : usage.ordersCount;
  return {
    plan,
    dishLimit,
    monthlyOrderLimit,
    dishesRemaining: dishLimit == null ? null : Math.max(0, dishLimit - dishesUsed),
    monthlyOrdersRemaining: monthlyOrderLimit == null ? null : Math.max(0, monthlyOrderLimit - ordersUsed),
  };
}

export function canCreateDishWithPlan(restaurantId: string) {
  const allowance = getRemainingStarterAllowance(restaurantId);
  if (allowance.dishLimit == null) return { allowed: true as const };
  if ((allowance.dishesRemaining || 0) > 0) return { allowed: true as const };
  return {
    allowed: false as const,
    reason: `Starter includes up to ${allowance.dishLimit} dishes. Upgrade to add more.`,
  };
}

export function canCreateOrderWithPlan(restaurantId: string) {
  const allowance = getRemainingStarterAllowance(restaurantId);
  if (allowance.monthlyOrderLimit == null) return { allowed: true as const };
  if ((allowance.monthlyOrdersRemaining || 0) > 0) return { allowed: true as const };
  return {
    allowed: false as const,
    reason: `Starter allows ${allowance.monthlyOrderLimit} orders/month. Upgrade to continue receiving orders.`,
  };
}

export function getUpgradePrompt(
  reason: "dish_limit" | "monthly_orders" | "feature_locked" | "branding_locked",
  targetPlan: SubscriptionPlan = "growth"
): UpgradePrompt {
  const planLabel = targetPlan === "pro" ? "Pro" : "Growth";
  if (reason === "dish_limit") {
    return {
      title: "Dish limit reached",
      message: `You have reached the Starter dish limit. Upgrade to ${planLabel} for higher capacity.`,
      ctaLabel: `Upgrade to ${planLabel}`,
      to: "/pricing",
    };
  }
  if (reason === "monthly_orders") {
    return {
      title: "Monthly order cap reached",
      message: `Starter monthly order allowance is exhausted. Upgrade to ${planLabel} to keep accepting orders.`,
      ctaLabel: `Upgrade to ${planLabel}`,
      to: "/pricing",
    };
  }
  if (reason === "branding_locked") {
    return {
      title: "Branding controls are on paid plans",
      message: "Remove 'Powered by Ubhona' and unlock full custom branding on Growth or Pro.",
      ctaLabel: "View plans",
      to: "/pricing",
    };
  }
  return {
    title: "Feature locked on Starter",
    message: `Upgrade to ${planLabel} to unlock this feature.`,
    ctaLabel: `Upgrade to ${planLabel}`,
    to: "/pricing",
  };
}

export function estimateTransactionFee(amount: number, rate = DEFAULT_TRANSACTION_FEE_RATE) {
  const value = Math.max(0, Number.isFinite(amount) ? amount : 0);
  return Math.round(value * rate * 100) / 100;
}
