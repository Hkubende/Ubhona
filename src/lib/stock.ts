import { ApiError, api } from "./api";
import { isApiConfigured } from "./config";
import { emitLowStockEvent, getCurrentBranchId } from "../services/automation-engine";
import type { Dish } from "../types/dashboard";

export type DishStockState = {
  restaurantId: string;
  branchId: string;
  dishId: string;
  availability_status: "available" | "low_stock" | "unavailable";
  stock_quantity: number | null;
  low_stock_threshold: number;
  hidden_from_public_menu: boolean;
};

const LOCAL_STOCK_KEY = "ubhona_branch_stock_overrides_v1";

function readLocalStockMap(): Record<string, DishStockState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STOCK_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, DishStockState>;
  } catch {
    return {};
  }
}

function writeLocalStockMap(next: Record<string, DishStockState>) {
  localStorage.setItem(LOCAL_STOCK_KEY, JSON.stringify(next));
}

function localStockKey(input: { restaurantId: string; branchId: string; dishId: string }) {
  return `${input.restaurantId}:${input.branchId}:${input.dishId}`;
}

function saveLocalStockOverride(stock: DishStockState) {
  const map = readLocalStockMap();
  map[localStockKey(stock)] = stock;
  writeLocalStockMap(map);
}

export function getLocalDishStockOverride(input: {
  restaurantId: string;
  dishId: string;
  branchId?: string;
}) {
  const branchId = input.branchId || getCurrentBranchId();
  const map = readLocalStockMap();
  return map[localStockKey({ restaurantId: input.restaurantId, branchId, dishId: input.dishId })] || null;
}

function isApiUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 503) return false;
  const code = (error.body as { code?: unknown } | null)?.code;
  return code === "API_NOT_CONFIGURED" || code === "API_UNREACHABLE";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapStock(value: unknown, fallback?: Partial<DishStockState>): DishStockState {
  const row = toRecord(value);
  return {
    restaurantId: String(row.restaurantId || fallback?.restaurantId || ""),
    branchId: String(row.branchId || fallback?.branchId || getCurrentBranchId()),
    dishId: String(row.dishId || fallback?.dishId || ""),
    availability_status:
      String(row.availability_status || "").toLowerCase() === "low_stock"
        ? "low_stock"
        : String(row.availability_status || "").toLowerCase() === "unavailable"
          ? "unavailable"
          : "available",
    stock_quantity:
      row.stock_quantity == null || row.stock_quantity === ""
        ? null
        : Number.isFinite(Number(row.stock_quantity))
          ? Number(row.stock_quantity)
          : null,
    low_stock_threshold: Number.isFinite(Number(row.low_stock_threshold)) ? Number(row.low_stock_threshold) : 5,
    hidden_from_public_menu: Boolean(row.hidden_from_public_menu),
  };
}

function inferAvailabilityFromQty(input: {
  stock_quantity: number | null;
  low_stock_threshold: number;
  availability_status?: DishStockState["availability_status"];
}) {
  if (input.stock_quantity == null) return input.availability_status || "available";
  if (input.stock_quantity <= 0) return "unavailable";
  if (input.stock_quantity <= input.low_stock_threshold) return "low_stock";
  return "available";
}

export async function getDishStock(dishId: string, branchId = getCurrentBranchId()): Promise<DishStockState | null> {
  if (!isApiConfigured) return null;
  try {
    const response = await api.get<unknown>(`/dishes/${encodeURIComponent(dishId)}/stock?branchId=${encodeURIComponent(branchId)}`);
    return mapStock(response, { dishId, branchId });
  } catch (error) {
    if (isApiUnavailable(error)) return null;
    throw error;
  }
}

export async function updateDishStock(input: {
  dish: Dish;
  branchId?: string;
  availability_status?: DishStockState["availability_status"];
  stock_quantity?: number | null;
  low_stock_threshold?: number;
  hidden_from_public_menu?: boolean;
}) {
  const branchId = input.branchId || getCurrentBranchId();
  const nextThreshold = Number.isFinite(Number(input.low_stock_threshold))
    ? Math.max(0, Math.floor(Number(input.low_stock_threshold)))
    : input.dish.stock?.low_stock_threshold ?? 5;
  const nextQty =
    input.stock_quantity == null
      ? input.dish.stock?.stock_quantity ?? null
      : Math.max(0, Math.floor(Number(input.stock_quantity)));
  const nextAvailability = inferAvailabilityFromQty({
    stock_quantity: nextQty,
    low_stock_threshold: nextThreshold,
    availability_status: input.availability_status || input.dish.stock?.availability_status,
  });
  const patch = {
    branchId,
    availability_status: nextAvailability,
    stock_quantity: nextQty,
    low_stock_threshold: nextThreshold,
    hidden_from_public_menu: input.hidden_from_public_menu ?? input.dish.stock?.hidden_from_public_menu ?? false,
  };
  if (!isApiConfigured) {
    const local = mapStock(
      {
        restaurantId: input.dish.restaurantId,
        dishId: input.dish.id,
        ...patch,
      },
      { restaurantId: input.dish.restaurantId, branchId, dishId: input.dish.id }
    );
    saveLocalStockOverride(local);
    if (local.availability_status === "low_stock" || local.availability_status === "unavailable") {
      await emitLowStockEvent({
        restaurantId: input.dish.restaurantId,
        branchId,
        dish: { id: input.dish.id, restaurantId: input.dish.restaurantId, name: input.dish.name },
        metadata: {
          stock_quantity: local.stock_quantity,
          low_stock_threshold: local.low_stock_threshold,
          availability_status: local.availability_status,
        },
      });
    }
    return local;
  }
  const response = await api.patch<unknown>(`/dishes/${encodeURIComponent(input.dish.id)}/stock`, patch);
  const next = mapStock(response, {
    restaurantId: input.dish.restaurantId,
    branchId,
    dishId: input.dish.id,
  });
  saveLocalStockOverride(next);
  if (next.availability_status === "low_stock" || next.availability_status === "unavailable") {
    await emitLowStockEvent({
      restaurantId: input.dish.restaurantId,
      branchId,
      dish: { id: input.dish.id, restaurantId: input.dish.restaurantId, name: input.dish.name },
      metadata: {
        stock_quantity: next.stock_quantity,
        low_stock_threshold: next.low_stock_threshold,
        availability_status: next.availability_status,
      },
    });
  }
  return next;
}
