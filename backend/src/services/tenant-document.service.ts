import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma.js";

function normalizeRestaurantId(value: string) {
  return String(value || "").trim();
}

function keyBelongsToRestaurant(restaurantId: string, key: string) {
  const normalizedRestaurantId = normalizeRestaurantId(restaurantId);
  const normalizedKey = String(key || "").trim();
  if (!normalizedRestaurantId || !normalizedKey) return false;
  return normalizedKey.includes(`:${normalizedRestaurantId}:`) || normalizedKey.endsWith(`:${normalizedRestaurantId}`);
}

function assertTenantScopedKey(restaurantId: string, key: string) {
  if (!keyBelongsToRestaurant(restaurantId, key)) {
    throw new Error("Tenant document key does not belong to the requested restaurant.");
  }
}

type DocumentClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  "platformTrackerDocument"
>;

function buildTenantWhere(restaurantId: string) {
  return {
    restaurantId,
  };
}

export async function findRestaurantDocumentByKey(input: {
  restaurantId: string;
  key: string;
  select?: Prisma.PlatformTrackerDocumentSelect;
}) {
  return findRestaurantDocumentByKeyTx(prisma, input);
}

export async function findRestaurantDocumentByKeyTx(
  client: DocumentClient,
  input: {
    restaurantId: string;
    key: string;
    select?: Prisma.PlatformTrackerDocumentSelect;
  }
) {
  assertTenantScopedKey(input.restaurantId, input.key);
  return client.platformTrackerDocument.findFirst({
    where: {
      key: input.key,
      ...buildTenantWhere(input.restaurantId),
    },
    select: input.select,
  });
}

export async function listRestaurantDocuments(input: {
  restaurantId: string;
  keyPrefix: string;
  orderBy?: Prisma.PlatformTrackerDocumentOrderByWithRelationInput | Prisma.PlatformTrackerDocumentOrderByWithRelationInput[];
  take?: number;
  select?: Prisma.PlatformTrackerDocumentSelect;
}) {
  return listRestaurantDocumentsTx(prisma, input);
}

export async function listRestaurantDocumentsTx(
  client: DocumentClient,
  input: {
    restaurantId: string;
    keyPrefix: string;
    orderBy?: Prisma.PlatformTrackerDocumentOrderByWithRelationInput | Prisma.PlatformTrackerDocumentOrderByWithRelationInput[];
    take?: number;
    select?: Prisma.PlatformTrackerDocumentSelect;
  }
) {
  assertTenantScopedKey(input.restaurantId, input.keyPrefix);
  return client.platformTrackerDocument.findMany({
    where: {
      key: { startsWith: input.keyPrefix },
      ...buildTenantWhere(input.restaurantId),
    },
    orderBy: input.orderBy,
    take: input.take,
    select: input.select,
  });
}

export async function upsertRestaurantDocument(input: {
  restaurantId: string;
  key: string;
  payload: Prisma.InputJsonValue;
}) {
  return upsertRestaurantDocumentTx(prisma, input);
}

export async function upsertRestaurantDocumentTx(
  client: DocumentClient,
  input: {
    restaurantId: string;
    key: string;
    payload: Prisma.InputJsonValue;
  }
) {
  assertTenantScopedKey(input.restaurantId, input.key);
  return client.platformTrackerDocument.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      restaurantId: input.restaurantId,
      payload: input.payload,
    },
    update: {
      restaurantId: input.restaurantId,
      payload: input.payload,
    },
  });
}

export async function createRestaurantDocument(input: {
  restaurantId: string;
  key: string;
  payload: Prisma.InputJsonValue;
}) {
  return createRestaurantDocumentTx(prisma, input);
}

export async function createRestaurantDocumentTx(
  client: DocumentClient,
  input: {
    restaurantId: string;
    key: string;
    payload: Prisma.InputJsonValue;
  }
) {
  assertTenantScopedKey(input.restaurantId, input.key);
  return client.platformTrackerDocument.create({
    data: {
      key: input.key,
      restaurantId: input.restaurantId,
      payload: input.payload,
    },
  });
}

export async function deleteRestaurantDocuments(input: {
  restaurantId: string;
  key?: string;
  keyPrefix?: string;
}) {
  return deleteRestaurantDocumentsTx(prisma, input);
}

export async function deleteRestaurantDocumentsTx(
  client: DocumentClient,
  input: {
    restaurantId: string;
    key?: string;
    keyPrefix?: string;
  }
) {
  if (input.key) {
    assertTenantScopedKey(input.restaurantId, input.key);
  }
  if (input.keyPrefix) {
    assertTenantScopedKey(input.restaurantId, input.keyPrefix);
  }
  return client.platformTrackerDocument.deleteMany({
    where: {
      ...buildTenantWhere(input.restaurantId),
      ...(input.key ? { key: input.key } : {}),
      ...(input.keyPrefix ? { key: { startsWith: input.keyPrefix } } : {}),
    },
  });
}
