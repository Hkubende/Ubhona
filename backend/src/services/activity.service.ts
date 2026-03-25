import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "../prisma.js";
import { logAuditEvent } from "./audit.service.js";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalActionType =
  | "dish_price_change"
  | "dish_delete"
  | "settings_update"
  | "payment_settings_update"
  | "printer_settings_update"
  | "role_change";

export type ActivityEventInput = {
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  organizationId: string;
  branchId?: string | null;
  restaurantId?: string | null;
  source?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type ApprovalRecord = {
  id: string;
  status: ApprovalStatus;
  actionType: ApprovalActionType;
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

const APPROVAL_KEY_PREFIX = "approval_request:";

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getApprovalDocKey(restaurantId: string, approvalId: string) {
  return `${APPROVAL_KEY_PREFIX}${restaurantId}:${approvalId}`;
}

export async function recordActivityEvent(input: ActivityEventInput) {
  const metadata = {
    organizationId: input.organizationId,
    branchId: input.branchId || null,
    restaurantId: input.restaurantId || input.organizationId,
    source: input.source || "api",
    before: input.before || null,
    after: input.after || null,
    ...(input.metadata || {}),
  };
  return logAuditEvent({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: input.action,
    targetType: input.entityType,
    targetId: input.entityId,
    metadata,
  });
}

export function toHumanReadableActivity(log: {
  action: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
  actor: { name: string; email: string } | null;
  metadata: Prisma.JsonValue | null;
}) {
  const metadata = toRecord(log.metadata);
  const actorName = log.actor?.name || log.actor?.email || "Someone";
  const action = log.action;
  const entityType = log.targetType;
  const before = toRecord(metadata.before);
  const after = toRecord(metadata.after);

  let message = `${actorName} performed ${action} on ${entityType} ${log.targetId}`;
  if (action === "dish_created") {
    message = `${actorName} created dish ${String(after.name || log.targetId)}`;
  } else if (action === "dish_deleted") {
    message = `${actorName} deleted dish ${String(before.name || log.targetId)}`;
  } else if (action === "dish_price_changed") {
    message = `${actorName} changed ${String(after.name || before.name || "dish")} price from KSh ${Number(
      before.price || 0
    ).toLocaleString("en-KE")} to KSh ${Number(after.price || 0).toLocaleString("en-KE")}`;
  } else if (action === "order_status_changed") {
    message = `${actorName} changed order ${log.targetId} from ${String(before.status || "unknown")} to ${String(
      after.status || "unknown"
    )}`;
  } else if (action === "payment_status_changed") {
    message = `${actorName} updated payment for order ${log.targetId} to ${String(after.paymentStatus || "unknown")}`;
  } else if (action === "restaurant_settings_updated") {
    message = `${actorName} updated restaurant settings`;
  } else if (action === "payment_settings_updated") {
    message = `${actorName} updated payment or messaging settings`;
  } else if (action === "printer_settings_updated") {
    message = `${actorName} updated printer settings`;
  } else if (action === "approval_requested") {
    message = `${actorName} requested approval for ${String(metadata.approvalActionType || entityType)}`;
  } else if (action === "approval_approved") {
    message = `${actorName} approved ${String(metadata.approvalActionType || entityType)} request`;
  } else if (action === "approval_rejected") {
    message = `${actorName} rejected ${String(metadata.approvalActionType || entityType)} request`;
  }

  return {
    id: `${log.action}_${log.targetId}_${log.createdAt.getTime()}`,
    action: log.action,
    entityType,
    entityId: log.targetId,
    actorName,
    timestamp: log.createdAt.toISOString(),
    message,
    metadata,
  };
}

export async function getRestaurantActivityHistory(input: {
  restaurantId: string;
  limit?: number;
  entityType?: string;
  entityId?: string;
}) {
  const limit = Math.max(1, Math.min(200, input.limit || 50));
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(input.entityType ? { targetType: input.entityType } : {}),
      ...(input.entityId ? { targetId: input.entityId } : {}),
      metadata: {
        path: ["restaurantId"],
        equals: input.restaurantId,
      },
    },
    include: {
      actor: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) =>
    toHumanReadableActivity({
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt,
      actor: row.actor,
      metadata: row.metadata,
    })
  );
}

function canApproveAction(role: UserRole, actionType: ApprovalActionType) {
  if (role === "platform_admin" || role === "restaurant_owner") return true;
  if (role === "restaurant_manager") {
    return actionType === "dish_price_change" || actionType === "dish_delete";
  }
  return false;
}

export async function createApprovalRequest(input: {
  actionType: ApprovalActionType;
  entityType: string;
  entityId: string;
  organizationId: string;
  branchId?: string | null;
  restaurantId: string;
  requestedByUserId: string;
  requestedByRole: UserRole;
  requestPayload: Record<string, unknown>;
  reason?: string;
}) {
  const id = randomId("apr");
  const requestedAt = nowIso();
  const approval: ApprovalRecord = {
    id,
    status: "pending",
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    organizationId: input.organizationId,
    branchId: input.branchId || null,
    restaurantId: input.restaurantId,
    requestedByUserId: input.requestedByUserId,
    requestedByRole: input.requestedByRole,
    requestedAt,
    requestPayload: input.requestPayload,
    reason: input.reason || null,
    reviewedByUserId: null,
    reviewedByRole: null,
    reviewedAt: null,
    reviewNote: null,
  };

  await prisma.platformTrackerDocument.upsert({
    where: { key: getApprovalDocKey(input.restaurantId, id) },
    update: { payload: approval as Prisma.InputJsonValue },
    create: {
      key: getApprovalDocKey(input.restaurantId, id),
      payload: approval as Prisma.InputJsonValue,
    },
  });

  await recordActivityEvent({
    actorUserId: input.requestedByUserId,
    actorRole: input.requestedByRole,
    action: "approval_requested",
    entityType: "approval_request",
    entityId: id,
    organizationId: input.organizationId,
    branchId: input.branchId || null,
    restaurantId: input.restaurantId,
    source: "approval",
    metadata: {
      approvalActionType: input.actionType,
      requestEntityType: input.entityType,
      requestEntityId: input.entityId,
      reason: input.reason || null,
    },
  });

  return approval;
}

export async function listApprovalRequests(input: {
  restaurantId: string;
  status?: ApprovalStatus;
  branchId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(200, input.limit || 50));
  const rows = await prisma.platformTrackerDocument.findMany({
    where: {
      key: { startsWith: `${APPROVAL_KEY_PREFIX}${input.restaurantId}:` },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  const parsed = rows
    .map((row) => toRecord(row.payload) as unknown as ApprovalRecord)
    .filter((row) => row && typeof row.id === "string");
  return parsed.filter((row) => {
    if (input.status && row.status !== input.status) return false;
    if (input.branchId != null && row.branchId !== input.branchId) return false;
    return true;
  });
}

async function applyApprovedRequest(record: ApprovalRecord) {
  if (record.actionType === "dish_price_change") {
    const payload = toRecord(record.requestPayload);
    const after = toRecord(payload.after);
    const price = Number(after.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Invalid approved price payload.");
    }
    await prisma.dish.updateMany({
      where: { id: record.entityId, restaurantId: record.restaurantId || record.organizationId },
      data: { price },
    });
    return;
  }
  if (record.actionType === "dish_delete") {
    await prisma.dish.deleteMany({
      where: { id: record.entityId, restaurantId: record.restaurantId || record.organizationId },
    });
    return;
  }
}

export async function reviewApprovalRequest(input: {
  restaurantId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  reviewerUserId: string;
  reviewerRole: UserRole;
  note?: string;
}) {
  const key = getApprovalDocKey(input.restaurantId, input.approvalId);
  const existing = await prisma.platformTrackerDocument.findUnique({ where: { key } });
  if (!existing) throw new Error("Approval request not found.");
  const record = toRecord(existing.payload) as unknown as ApprovalRecord;
  if (record.status !== "pending") {
    throw new Error("Approval request is already resolved.");
  }
  if (!canApproveAction(input.reviewerRole, record.actionType)) {
    throw new Error("You do not have permission to review this approval.");
  }
  const next: ApprovalRecord = {
    ...record,
    status: input.decision,
    reviewedByUserId: input.reviewerUserId,
    reviewedByRole: input.reviewerRole,
    reviewedAt: nowIso(),
    reviewNote: input.note || null,
  };
  await prisma.platformTrackerDocument.update({
    where: { key },
    data: { payload: next as Prisma.InputJsonValue },
  });
  if (input.decision === "approved") {
    await applyApprovedRequest(next);
  }
  await recordActivityEvent({
    actorUserId: input.reviewerUserId,
    actorRole: input.reviewerRole,
    action: input.decision === "approved" ? "approval_approved" : "approval_rejected",
    entityType: "approval_request",
    entityId: input.approvalId,
    organizationId: next.organizationId,
    branchId: next.branchId,
    restaurantId: next.restaurantId || input.restaurantId,
    source: "approval",
    metadata: {
      approvalActionType: next.actionType,
      requestEntityType: next.entityType,
      requestEntityId: next.entityId,
      note: input.note || null,
    },
  });
  return next;
}

export function requiresApprovalForAction(input: {
  actionType: ApprovalActionType;
  role: UserRole;
  changeMagnitudePercent?: number;
}) {
  if (input.role === "platform_admin" || input.role === "restaurant_owner") return false;
  if (input.actionType === "dish_price_change") {
    return Number(input.changeMagnitudePercent || 0) >= 15;
  }
  if (input.actionType === "dish_delete") return true;
  if (input.actionType === "settings_update" || input.actionType === "payment_settings_update" || input.actionType === "printer_settings_update") {
    return true;
  }
  return false;
}
