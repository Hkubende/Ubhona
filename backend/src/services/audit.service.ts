import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "../prisma.js";

export type AuditAction =
  | "suspend_restaurant"
  | "reactivate_restaurant";

export type AuditTargetType =
  | "restaurant"
  | "user"
  | "order"
  | "subscription";

export async function logAuditEvent(input: {
  actorUserId: string;
  actorRole: UserRole;
  action: AuditAction | string;
  targetType: AuditTargetType | string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  const entry = await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    select: {
      id: true,
      actorUserId: true,
      actorRole: true,
      action: true,
      targetType: true,
      targetId: true,
      createdAt: true,
    },
  });

  // Structured operational telemetry for quick log-based triage.
  console.info(
    JSON.stringify({
      event: "admin_audit",
      ...entry,
    })
  );

  return entry;
}
