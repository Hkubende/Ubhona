import { api } from "./api";
import { isPlatformAdmin } from "./auth";

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

export function isCurrentUserAdmin() {
  return isPlatformAdmin();
}

export function getAdminRestaurants(params?: { q?: string; plan?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.plan) query.set("plan", params.plan);
  if (params?.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api.get<AdminRestaurant[]>(`/admin/restaurants${suffix}`);
}

export function updateAdminRestaurantStatus(restaurantId: string, status: "active" | "suspended") {
  return api.patch(`/admin/restaurants/${encodeURIComponent(restaurantId)}/status`, { status });
}

export function getAdminMetrics() {
  return api.get<AdminMetrics>("/admin/metrics");
}

export function getAdminSupportRecords() {
  return api.get<AdminSupportRecord[]>("/admin/support");
}

export function getAdminAuditLogs(params?: {
  action?: string;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.action) query.set("action", params.action);
  if (params?.targetType) query.set("targetType", params.targetType);
  if (params?.targetId) query.set("targetId", params.targetId);
  if (params?.actorUserId) query.set("actorUserId", params.actorUserId);
  if (params?.limit != null) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api.get<AdminAuditLog[]>(`/admin/audit-logs${suffix}`);
}
