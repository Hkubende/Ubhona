import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export type BranchDishAvailabilityStatus = "available" | "low_stock" | "unavailable";

export type BranchDishStockOverride = {
  restaurantId: string;
  branchId: string;
  dishId: string;
  availability_status: BranchDishAvailabilityStatus;
  stock_quantity: number | null;
  low_stock_threshold: number;
  hidden_from_public_menu: boolean;
  updatedAt: string;
};

const STOCK_KEY_PREFIX = "stock_override:";

function stockKey(restaurantId: string, branchId: string, dishId: string) {
  return `${STOCK_KEY_PREFIX}${restaurantId}:${branchId}:${dishId}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeStatus(value: unknown): BranchDishAvailabilityStatus {
  const status = String(value || "").trim().toLowerCase();
  if (status === "low_stock") return "low_stock";
  if (status === "unavailable") return "unavailable";
  return "available";
}

function toStockOverride(payload: unknown): BranchDishStockOverride | null {
  const row = toRecord(payload);
  const restaurantId = String(row.restaurantId || "");
  const branchId = String(row.branchId || "");
  const dishId = String(row.dishId || "");
  if (!restaurantId || !branchId || !dishId) return null;
  const stockQtyRaw = row.stock_quantity;
  const stock_quantity =
    stockQtyRaw == null || stockQtyRaw === ""
      ? null
      : Number.isFinite(Number(stockQtyRaw))
        ? Math.max(0, Math.floor(Number(stockQtyRaw)))
        : null;
  const thresholdRaw = Number(row.low_stock_threshold ?? 5);
  const low_stock_threshold = Number.isFinite(thresholdRaw) ? Math.max(0, Math.floor(thresholdRaw)) : 5;
  let availability_status = normalizeStatus(row.availability_status);
  if (stock_quantity != null) {
    if (stock_quantity <= 0) availability_status = "unavailable";
    else if (stock_quantity <= low_stock_threshold) availability_status = "low_stock";
    else availability_status = "available";
  }
  return {
    restaurantId,
    branchId,
    dishId,
    availability_status,
    stock_quantity,
    low_stock_threshold,
    hidden_from_public_menu: Boolean(row.hidden_from_public_menu),
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

export async function listBranchDishStockOverrides(input: { restaurantId: string; branchId: string }) {
  const rows = await prisma.platformTrackerDocument.findMany({
    where: {
      key: {
        startsWith: `${STOCK_KEY_PREFIX}${input.restaurantId}:${input.branchId}:`,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((row) => toStockOverride(row.payload))
    .filter((item): item is BranchDishStockOverride => !!item);
}

export async function getBranchDishStockOverride(input: { restaurantId: string; branchId: string; dishId: string }) {
  const row = await prisma.platformTrackerDocument.findUnique({
    where: { key: stockKey(input.restaurantId, input.branchId, input.dishId) },
    select: { payload: true },
  });
  if (!row) return null;
  return toStockOverride(row.payload);
}

export async function upsertBranchDishStockOverride(input: {
  restaurantId: string;
  branchId: string;
  dishId: string;
  availability_status?: BranchDishAvailabilityStatus;
  stock_quantity?: number | null;
  low_stock_threshold?: number;
  hidden_from_public_menu?: boolean;
}) {
  const existing = await getBranchDishStockOverride({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    dishId: input.dishId,
  });
  const next = toStockOverride({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    dishId: input.dishId,
    availability_status: input.availability_status ?? existing?.availability_status ?? "available",
    stock_quantity: input.stock_quantity ?? existing?.stock_quantity ?? null,
    low_stock_threshold: input.low_stock_threshold ?? existing?.low_stock_threshold ?? 5,
    hidden_from_public_menu: input.hidden_from_public_menu ?? existing?.hidden_from_public_menu ?? false,
    updatedAt: new Date().toISOString(),
  });
  if (!next) throw new Error("Invalid stock override payload.");
  await prisma.platformTrackerDocument.upsert({
    where: { key: stockKey(input.restaurantId, input.branchId, input.dishId) },
    create: {
      key: stockKey(input.restaurantId, input.branchId, input.dishId),
      payload: next as Prisma.InputJsonValue,
    },
    update: {
      payload: next as Prisma.InputJsonValue,
    },
  });
  return next;
}

export async function removeBranchDishStockOverride(input: { restaurantId: string; branchId: string; dishId: string }) {
  await prisma.platformTrackerDocument.deleteMany({
    where: {
      key: stockKey(input.restaurantId, input.branchId, input.dishId),
    },
  });
}

