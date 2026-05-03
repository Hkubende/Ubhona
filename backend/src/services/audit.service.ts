import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "../prisma.js";
import { getSystemActorLabel } from "./system-actors.js";

export type AuditAction =
  | "suspend_restaurant"
  | "reactivate_restaurant";

export type AuditTargetType =
  | "restaurant"
  | "user"
  | "order"
  | "subscription";

type AuditActorInput =
  | {
      actorUserId: string;
      systemActorKey?: never;
    }
  | {
      actorUserId?: never;
      systemActorKey: string;
    };

type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  systemActorKey: string | null;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
};

export async function logAuditEvent(
  input: AuditActorInput & {
    actorRole: UserRole;
    action: AuditAction | string;
    targetType: AuditTargetType | string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }
) {
  const sharedData = {
    actorRole: input.actorRole,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
  };

  const entry = (("actorUserId" in input)
    ? await prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          ...sharedData,
        },
      })
    : await prisma.auditLog.create({
        data: {
          systemActorKey: input.systemActorKey,
          ...sharedData,
        },
      })) as AuditLogEntry;

  console.info(
    JSON.stringify({
      event: "admin_audit",
      ...entry,
      actorLabel: getSystemActorLabel(entry.systemActorKey),
    })
  );

  return entry;
}
