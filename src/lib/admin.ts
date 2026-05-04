import { ApiError, api, AUTH_TOKEN_KEY } from "./api";
import { isPlatformAdmin } from "./auth";
import { allowOfflineDemoFallback } from "./config";

export type AdminRestaurant = {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  location: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  renewalDate?: string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  usage: {
    categories: number;
    dishes: number;
    orders: number;
    analyticsEvents: number;
    revenue: number;
  };
};

export type AdminMetrics = {
  restaurants: number;
  orders: number;
  totalRevenue: number;
  recentOrders24h: number;
  failedPayments: number;
  planBreakdown: Array<{ plan: string; count: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
};

export type AdminSupportRecord = {
  id: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  summary: string;
  details: string;
};

export type AdminAuditLog = {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
};

export type AdminBillingOverviewRow = {
  restaurantId: string;
  restaurantName: string;
  currentPlan: string;
  trialEndDate: string | null;
  subscriptionStatus: string;
  latestInvoice: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    issuedAt: string;
    dueAt: string | null;
    paymentReference: string;
  } | null;
  latestPayment: {
    id: string;
    amount: number;
    provider: string;
    status: string;
    method: string;
    createdAt: string;
  } | null;
  lastPaymentMethod: string | null;
  outstandingBalance: number;
};

const LOCAL_TOKEN_PREFIX = "local:";
const PROFILE_KEY = "mv_restaurant_profile_v1";
const PROFILE_REGISTRY_KEY = "mv_restaurant_profiles_registry_v1";
const DISHES_KEY = "mv_restaurant_dishes_v1";
const ORDERS_KEY = "mv_orders_v1";
const ANALYTICS_KEY = "mv_analytics_events_v1";

type LocalRestaurantProfile = {
  id?: string;
  restaurantName?: string;
  name?: string;
  slug?: string;
  email?: string;
  phone?: string;
  location?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
  renewalDate?: string | null;
  createdAt?: string;
};

type LocalOrder = {
  id?: string;
  restaurantId?: string;
  total?: number;
  totalAmount?: number;
  status?: string;
  paymentStatus?: string;
  createdAt?: string;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function hasLocalAdminSession() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
  return allowOfflineDemoFallback && isPlatformAdmin() && token.startsWith(LOCAL_TOKEN_PREFIX);
}

function isLocalAdminFallbackEligible(error: unknown, hadLocalAdminSession: boolean) {
  if (!hadLocalAdminSession) return false;
  if (!(error instanceof ApiError)) return true;
  return error.status === 401 || error.status === 403 || error.status === 503;
}

function getLocalProfiles() {
  const registry = readJson<LocalRestaurantProfile[]>(PROFILE_REGISTRY_KEY, []);
  const activeProfile = readJson<LocalRestaurantProfile | null>(PROFILE_KEY, null);
  const merged = [...registry];
  if (activeProfile?.id && !merged.some((row) => row.id === activeProfile.id)) merged.unshift(activeProfile);
  if (merged.length) return merged;
  return [
    {
      id: "demo-admin-restaurant",
      restaurantName: "Ubhona Demo Kitchen",
      slug: "ubhona-demo",
      email: "owner@ubhona.demo",
      phone: "+254700000000",
      location: "Nairobi",
      subscriptionPlan: "growth",
      subscriptionStatus: "active",
      createdAt: new Date().toISOString(),
    },
  ];
}

function getLocalDishesByRestaurant() {
  return readJson<Record<string, unknown[]>>(DISHES_KEY, {});
}

function getLocalOrders() {
  return readJson<LocalOrder[]>(ORDERS_KEY, []);
}

function getLocalAnalyticsEvents() {
  return readJson<Array<{ restaurantId?: string }>>(ANALYTICS_KEY, []);
}

function toAdminRestaurant(profile: LocalRestaurantProfile, index: number): AdminRestaurant {
  const id = profile.id || `local-admin-restaurant-${index + 1}`;
  const dishes = getLocalDishesByRestaurant()[id] || [];
  const orders = getLocalOrders().filter((order) => !order.restaurantId || order.restaurantId === id);
  const analyticsEvents = getLocalAnalyticsEvents().filter((event) => !event.restaurantId || event.restaurantId === id);
  const revenue = orders.reduce((sum, order) => sum + Number(order.totalAmount ?? order.total ?? 0), 0);
  const name = profile.restaurantName || profile.name || `Restaurant ${index + 1}`;
  return {
    id,
    name,
    slug: profile.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    email: profile.email || "owner@ubhona.demo",
    phone: profile.phone || "+254700000000",
    location: profile.location || "Nairobi",
    subscriptionPlan: profile.subscriptionPlan || (index % 2 ? "starter" : "growth"),
    subscriptionStatus: profile.subscriptionStatus || (index % 3 === 2 ? "past_due" : "active"),
    trialEndsAt: profile.trialEndsAt ?? null,
    renewalDate: profile.renewalDate ?? null,
    createdAt: profile.createdAt || new Date().toISOString(),
    owner: {
      id: `local-owner-${id}`,
      name: `${name} Owner`,
      email: profile.email || "owner@ubhona.demo",
    },
    usage: {
      categories: 3,
      dishes: dishes.length,
      orders: orders.length,
      analyticsEvents: analyticsEvents.length,
      revenue,
    },
  };
}

function getDemoAdminRestaurants() {
  return getLocalProfiles().map(toAdminRestaurant);
}

function filterDemoAdminRestaurants(params?: { q?: string; plan?: string; status?: string }) {
  const q = params?.q?.trim().toLowerCase();
  return getDemoAdminRestaurants().filter((restaurant) => {
    const matchesQuery = q
      ? [restaurant.name, restaurant.slug, restaurant.email, restaurant.phone].some((value) =>
          value.toLowerCase().includes(q)
        )
      : true;
    const matchesPlan = params?.plan ? restaurant.subscriptionPlan === params.plan : true;
    const matchesStatus = params?.status ? restaurant.subscriptionStatus === params.status : true;
    return matchesQuery && matchesPlan && matchesStatus;
  });
}

function getDemoAdminMetrics(): AdminMetrics {
  const restaurants = getDemoAdminRestaurants();
  const orders = getLocalOrders();
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const countBy = (field: "subscriptionPlan" | "subscriptionStatus") => {
    const counts = new Map<string, number>();
    restaurants.forEach((restaurant) => counts.set(restaurant[field], (counts.get(restaurant[field]) || 0) + 1));
    return Array.from(counts, ([key, count]) => ({
      [field === "subscriptionPlan" ? "plan" : "status"]: key,
      count,
    })) as AdminMetrics["planBreakdown"];
  };
  return {
    restaurants: restaurants.length,
    orders: orders.length,
    totalRevenue: restaurants.reduce((sum, restaurant) => sum + restaurant.usage.revenue, 0),
    recentOrders24h: orders.filter((order) => +new Date(order.createdAt || 0) >= recentCutoff).length,
    failedPayments: orders.filter((order) => order.paymentStatus === "failed").length,
    planBreakdown: countBy("subscriptionPlan"),
    statusBreakdown: countBy("subscriptionStatus") as AdminMetrics["statusBreakdown"],
  };
}

function getDemoBillingOverview() {
  return getDemoAdminRestaurants().map((restaurant): AdminBillingOverviewRow => ({
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    currentPlan: restaurant.subscriptionPlan,
    trialEndDate: restaurant.trialEndsAt ?? null,
    subscriptionStatus: restaurant.subscriptionStatus,
    latestInvoice: {
      id: `invoice-${restaurant.id}`,
      amount: restaurant.subscriptionPlan === "pro" ? 12900 : restaurant.subscriptionPlan === "growth" ? 7900 : 3900,
      currency: "KES",
      status: restaurant.subscriptionStatus === "past_due" ? "pending" : "paid",
      issuedAt: restaurant.createdAt,
      dueAt: restaurant.renewalDate ?? null,
      paymentReference: `LOCAL-${restaurant.id.slice(0, 8).toUpperCase()}`,
    },
    latestPayment: {
      id: `payment-${restaurant.id}`,
      amount: restaurant.usage.revenue,
      provider: "local-demo",
      status: restaurant.subscriptionStatus === "past_due" ? "failed" : "succeeded",
      method: "manual_mpesa",
      createdAt: restaurant.createdAt,
    },
    lastPaymentMethod: "manual_mpesa",
    outstandingBalance: restaurant.subscriptionStatus === "past_due" ? 7900 : 0,
  }));
}

function getDemoSupportRecords(): AdminSupportRecord[] {
  return getDemoAdminRestaurants()
    .filter((restaurant) => restaurant.subscriptionStatus !== "active")
    .map((restaurant) => ({
      id: `support-${restaurant.id}`,
      type: "billing_status",
      priority: restaurant.subscriptionStatus === "past_due" ? "high" : "medium",
      status: "open",
      createdAt: restaurant.createdAt,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
      summary: `${restaurant.name} needs billing review`,
      details: `Subscription status is ${restaurant.subscriptionStatus} on ${restaurant.subscriptionPlan}.`,
    }));
}

function getDemoAuditLogs(): AdminAuditLog[] {
  return getDemoAdminRestaurants().slice(0, 6).map((restaurant, index) => ({
    id: `audit-${restaurant.id}`,
    actorUserId: "local-platform-admin",
    actorRole: "platform_admin",
    action: index % 2 ? "review_restaurant" : "admin_dashboard_opened",
    targetType: "restaurant",
    targetId: restaurant.id,
    metadata: { source: "local-admin-demo" },
    createdAt: new Date(Date.now() - index * 45 * 60 * 1000).toISOString(),
    actor: {
      id: "local-platform-admin",
      name: "Local Platform Admin",
      email: "admin@ubhona.demo",
    },
  }));
}

export function isCurrentUserAdmin() {
  return isPlatformAdmin();
}

export async function getAdminRestaurants(params?: { q?: string; plan?: string; status?: string }) {
  const hadLocalAdminSession = hasLocalAdminSession();
  if (hadLocalAdminSession) return filterDemoAdminRestaurants(params);
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.plan) query.set("plan", params.plan);
  if (params?.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  try {
    return await api.get<AdminRestaurant[]>(`/admin/restaurants${suffix}`);
  } catch (error) {
    if (!isLocalAdminFallbackEligible(error, hadLocalAdminSession)) throw error;
    return filterDemoAdminRestaurants(params);
  }
}

export function updateAdminRestaurantStatus(restaurantId: string, status: "active" | "suspended") {
  return api.patch(`/admin/restaurants/${encodeURIComponent(restaurantId)}/status`, { status });
}

export async function getAdminMetrics() {
  const hadLocalAdminSession = hasLocalAdminSession();
  if (hadLocalAdminSession) return getDemoAdminMetrics();
  try {
    return await api.get<AdminMetrics>("/admin/metrics");
  } catch (error) {
    if (!isLocalAdminFallbackEligible(error, hadLocalAdminSession)) throw error;
    return getDemoAdminMetrics();
  }
}

export async function getAdminBillingOverview() {
  const hadLocalAdminSession = hasLocalAdminSession();
  if (hadLocalAdminSession) return getDemoBillingOverview();
  try {
    return await api.get<AdminBillingOverviewRow[]>("/admin/billing-overview");
  } catch (error) {
    if (!isLocalAdminFallbackEligible(error, hadLocalAdminSession)) throw error;
    return getDemoBillingOverview();
  }
}

export async function getAdminSupportRecords() {
  const hadLocalAdminSession = hasLocalAdminSession();
  if (hadLocalAdminSession) return getDemoSupportRecords();
  try {
    return await api.get<AdminSupportRecord[]>("/admin/support");
  } catch (error) {
    if (!isLocalAdminFallbackEligible(error, hadLocalAdminSession)) throw error;
    return getDemoSupportRecords();
  }
}

export async function getAdminAuditLogs(params?: {
  action?: string;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  limit?: number;
}) {
  const hadLocalAdminSession = hasLocalAdminSession();
  if (hadLocalAdminSession) return getDemoAuditLogs().slice(0, params?.limit ?? 50);
  const query = new URLSearchParams();
  if (params?.action) query.set("action", params.action);
  if (params?.targetType) query.set("targetType", params.targetType);
  if (params?.targetId) query.set("targetId", params.targetId);
  if (params?.actorUserId) query.set("actorUserId", params.actorUserId);
  if (params?.limit != null) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  try {
    return await api.get<AdminAuditLog[]>(`/admin/audit-logs${suffix}`);
  } catch (error) {
    if (!isLocalAdminFallbackEligible(error, hadLocalAdminSession)) throw error;
    return getDemoAuditLogs().slice(0, params?.limit ?? 50);
  }
}
