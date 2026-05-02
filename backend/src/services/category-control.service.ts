import { Prisma, type PrismaClient } from "@prisma/client";
import { listRestaurantDocuments, findRestaurantDocumentByKey, upsertRestaurantDocument } from "./tenant-document.service.js";
import {
  findRestaurantDocumentByKeyTx,
  upsertRestaurantDocumentTx,
} from "./tenant-document.service.js";

export type CategoryMenuControl = {
  restaurantId: string;
  categoryId: string;
  isActive: boolean;
  updatedAt: string;
};

const CATEGORY_CONTROL_KEY_PREFIX = "category_control:";
type CategoryControlClient = Pick<PrismaClient | Prisma.TransactionClient, "platformTrackerDocument">;

function categoryControlKey(restaurantId: string, categoryId: string) {
  return `${CATEGORY_CONTROL_KEY_PREFIX}${restaurantId}:${categoryId}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toCategoryMenuControl(payload: unknown): CategoryMenuControl | null {
  const row = toRecord(payload);
  const restaurantId = String(row.restaurantId || "");
  const categoryId = String(row.categoryId || "");
  if (!restaurantId || !categoryId) return null;
  return {
    restaurantId,
    categoryId,
    isActive: row.isActive !== false,
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

export async function listCategoryMenuControls(input: { restaurantId: string }) {
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: `${CATEGORY_CONTROL_KEY_PREFIX}${input.restaurantId}:`,
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((row) => toCategoryMenuControl(row.payload))
    .filter((item): item is CategoryMenuControl => !!item);
}

export async function getCategoryMenuControl(input: { restaurantId: string; categoryId: string }) {
  const row = await findRestaurantDocumentByKey({
    restaurantId: input.restaurantId,
    key: categoryControlKey(input.restaurantId, input.categoryId),
    select: { payload: true },
  });
  if (!row) return null;
  return toCategoryMenuControl(row.payload);
}

export async function getCategoryMenuControlTx(
  client: CategoryControlClient,
  input: { restaurantId: string; categoryId: string }
) {
  const row = await findRestaurantDocumentByKeyTx(client, {
    restaurantId: input.restaurantId,
    key: categoryControlKey(input.restaurantId, input.categoryId),
    select: { payload: true },
  });
  if (!row) return null;
  return toCategoryMenuControl(row.payload);
}

export async function upsertCategoryMenuControl(input: { restaurantId: string; categoryId: string; isActive?: boolean }) {
  const existing = await getCategoryMenuControl({
    restaurantId: input.restaurantId,
    categoryId: input.categoryId,
  });
  const next = toCategoryMenuControl({
    restaurantId: input.restaurantId,
    categoryId: input.categoryId,
    isActive: input.isActive ?? existing?.isActive ?? true,
    updatedAt: new Date().toISOString(),
  });
  if (!next) throw new Error("Invalid category control payload.");
  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key: categoryControlKey(input.restaurantId, input.categoryId),
    payload: next as Prisma.InputJsonValue,
  });
  return next;
}

export async function upsertCategoryMenuControlTx(
  client: CategoryControlClient,
  input: { restaurantId: string; categoryId: string; isActive?: boolean }
) {
  const existing = await getCategoryMenuControlTx(client, {
    restaurantId: input.restaurantId,
    categoryId: input.categoryId,
  });
  const next = toCategoryMenuControl({
    restaurantId: input.restaurantId,
    categoryId: input.categoryId,
    isActive: input.isActive ?? existing?.isActive ?? true,
    updatedAt: new Date().toISOString(),
  });
  if (!next) throw new Error("Invalid category control payload.");
  await upsertRestaurantDocumentTx(client, {
    restaurantId: input.restaurantId,
    key: categoryControlKey(input.restaurantId, input.categoryId),
    payload: next as Prisma.InputJsonValue,
  });
  return next;
}
