import { ApiError, api } from "./api";
import { isApiConfigured } from "./config";

export type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  timestamp: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type ApprovalItem = {
  id: string;
  status: "pending" | "approved" | "rejected";
  actionType: string;
  entityType: string;
  entityId: string;
  organizationId: string;
  branchId: string | null;
  restaurantId: string | null;
  requestedByUserId: string;
  requestedByRole: string;
  requestedAt: string;
  requestPayload: Record<string, unknown>;
  reason: string | null;
  reviewedByUserId: string | null;
  reviewedByRole: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type LooseRecord = Record<string, unknown>;

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as LooseRecord;
}

function isApiUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 503) return false;
  const code = (error.body as { code?: unknown } | null)?.code;
  return code === "API_NOT_CONFIGURED" || code === "API_UNREACHABLE";
}

function mapActivity(value: unknown): ActivityItem | null {
  const row = toRecord(value);
  const id = String(row.id || "");
  if (!id) return null;
  return {
    id,
    action: String(row.action || ""),
    entityType: String(row.entityType || ""),
    entityId: String(row.entityId || ""),
    actorName: String(row.actorName || "Someone"),
    timestamp: String(row.timestamp || ""),
    message: String(row.message || ""),
    metadata: toRecord(row.metadata),
  };
}

function mapApproval(value: unknown): ApprovalItem | null {
  const row = toRecord(value);
  const id = String(row.id || "");
  if (!id) return null;
  return {
    id,
    status:
      row.status === "approved" || row.status === "rejected" || row.status === "pending"
        ? row.status
        : "pending",
    actionType: String(row.actionType || ""),
    entityType: String(row.entityType || ""),
    entityId: String(row.entityId || ""),
    organizationId: String(row.organizationId || ""),
    branchId: row.branchId ? String(row.branchId) : null,
    restaurantId: row.restaurantId ? String(row.restaurantId) : null,
    requestedByUserId: String(row.requestedByUserId || ""),
    requestedByRole: String(row.requestedByRole || ""),
    requestedAt: String(row.requestedAt || ""),
    requestPayload: toRecord(row.requestPayload),
    reason: row.reason ? String(row.reason) : null,
    reviewedByUserId: row.reviewedByUserId ? String(row.reviewedByUserId) : null,
    reviewedByRole: row.reviewedByRole ? String(row.reviewedByRole) : null,
    reviewedAt: row.reviewedAt ? String(row.reviewedAt) : null,
    reviewNote: row.reviewNote ? String(row.reviewNote) : null,
  };
}

export async function getActivityHistory(params?: {
  limit?: number;
  entityType?: string;
  entityId?: string;
}): Promise<ActivityItem[]> {
  if (!isApiConfigured) return [];
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.entityType) query.set("entityType", params.entityType);
  if (params?.entityId) query.set("entityId", params.entityId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  try {
    const response = await api.get<unknown[]>(`/restaurants/me/activity${suffix}`);
    return response.map((item) => mapActivity(item)).filter((item): item is ActivityItem => !!item);
  } catch (error) {
    if (isApiUnavailable(error)) return [];
    throw error;
  }
}

export async function getOrderHistory(orderId: string, limit = 30): Promise<ActivityItem[]> {
  if (!isApiConfigured) return [];
  try {
    const response = await api.get<unknown[]>(
      `/restaurants/me/orders/${encodeURIComponent(orderId)}/history?limit=${Math.max(1, Math.min(100, limit))}`
    );
    return response.map((item) => mapActivity(item)).filter((item): item is ActivityItem => !!item);
  } catch (error) {
    if (isApiUnavailable(error)) return [];
    throw error;
  }
}

export async function getDishHistory(dishId: string, limit = 30): Promise<ActivityItem[]> {
  if (!isApiConfigured) return [];
  try {
    const response = await api.get<unknown[]>(
      `/restaurants/me/dishes/${encodeURIComponent(dishId)}/history?limit=${Math.max(1, Math.min(100, limit))}`
    );
    return response.map((item) => mapActivity(item)).filter((item): item is ActivityItem => !!item);
  } catch (error) {
    if (isApiUnavailable(error)) return [];
    throw error;
  }
}

export async function getApprovals(status?: "pending" | "approved" | "rejected"): Promise<ApprovalItem[]> {
  if (!isApiConfigured) return [];
  const suffix = status ? `?status=${status}` : "";
  try {
    const response = await api.get<unknown[]>(`/restaurants/me/approvals${suffix}`);
    return response.map((item) => mapApproval(item)).filter((item): item is ApprovalItem => !!item);
  } catch (error) {
    if (isApiUnavailable(error)) return [];
    throw error;
  }
}

export async function reviewApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<ApprovalItem> {
  const response = await api.post<unknown>(`/restaurants/me/approvals/${encodeURIComponent(approvalId)}/review`, {
    decision,
    note: note?.trim() || undefined,
  });
  const mapped = mapApproval(response);
  if (!mapped) throw new Error("Invalid approval response.");
  return mapped;
}
