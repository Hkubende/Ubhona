import { ApiError, api } from "./api";
import { isApiConfigured } from "./config";
import { getRestaurantProfile } from "./restaurant";
import { canCreateDishWithPlan, setDishCount } from "./growth";
import { getCurrentBranchId } from "../services/automation-engine";
import { getLocalDishStockOverride } from "./stock";

export type RestaurantDish = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  desc: string;
  price: number;
  thumb: string;
  model: string;
  isAvailable: boolean;
  stock?: {
    branchId: string;
    availability_status: "available" | "low_stock" | "unavailable";
    stock_quantity: number | null;
    low_stock_threshold: number;
    hidden_from_public_menu: boolean;
  } | null;
  createdAt: string;
};

const DISHES_KEY = "mv_restaurant_dishes_v1";
const LEGACY_BUCKET = "__legacy__";

type ApiDishRow = {
  id?: unknown;
  restaurantId?: unknown;
  categoryId?: unknown;
  name?: unknown;
  description?: unknown;
  desc?: unknown;
  price?: unknown;
  thumbUrl?: unknown;
  thumbnailUrl?: unknown;
  thumbnail_url?: unknown;
  thumb?: unknown;
  modelUrl?: unknown;
  model_url?: unknown;
  model?: unknown;
  isAvailable?: unknown;
  stock?: unknown;
  createdAt?: unknown;
};

function toDishRow(value: unknown): ApiDishRow {
  if (!value || typeof value !== "object") return {};
  return value as ApiDishRow;
}

function mapDish(row: ApiDishRow): RestaurantDish {
  const profile = getRestaurantProfile();
  const branchId = getCurrentBranchId();
  const stockRecord = row.stock && typeof row.stock === "object" ? (row.stock as Record<string, unknown>) : null;
  const localStock = getLocalDishStockOverride({
    restaurantId: String(row.restaurantId || profile?.id || "local_default_restaurant"),
    dishId: String(row.id || ""),
    branchId,
  });
  return {
    id: String(row.id),
    restaurantId: String(row.restaurantId || profile?.id || "local_default_restaurant"),
    categoryId: String(row.categoryId || ""),
    name: String(row.name || ""),
    desc: String(row.description || row.desc || ""),
    price: Number(row.price || 0),
    thumb: String(row.thumbnail_url || row.thumbnailUrl || row.thumbUrl || row.thumb || ""),
    model: String(row.model_url || row.modelUrl || row.model || ""),
    isAvailable: row.isAvailable === false ? false : true,
    stock: localStock
      ? localStock
      : stockRecord
      ? {
          branchId: String(stockRecord.branchId || branchId),
          availability_status:
            String(stockRecord.availability_status || "").toLowerCase() === "low_stock"
              ? "low_stock"
              : String(stockRecord.availability_status || "").toLowerCase() === "unavailable"
                ? "unavailable"
                : "available",
          stock_quantity:
            stockRecord.stock_quantity == null || stockRecord.stock_quantity === ""
              ? null
              : Number.isFinite(Number(stockRecord.stock_quantity))
                ? Number(stockRecord.stock_quantity)
                : null,
          low_stock_threshold: Number.isFinite(Number(stockRecord.low_stock_threshold))
            ? Number(stockRecord.low_stock_threshold)
            : 5,
          hidden_from_public_menu: Boolean(stockRecord.hidden_from_public_menu),
        }
      : null,
    createdAt: String(row.createdAt || new Date().toISOString()),
  };
}

function getActiveRestaurantId() {
  return getRestaurantProfile()?.id || "local_default_restaurant";
}

function readAllCache(): Record<string, RestaurantDish[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISHES_KEY) || "[]");
    if (Array.isArray(parsed)) {
      const legacy = parsed
        .filter((row): row is RestaurantDish => !!row && typeof row === "object")
        .map((row) => ({
          ...row,
          restaurantId: String((row as RestaurantDish).restaurantId || LEGACY_BUCKET),
        }));
      return { [LEGACY_BUCKET]: legacy };
    }
    if (!parsed || typeof parsed !== "object") return {};
    const map = parsed as Record<string, unknown>;
    const out: Record<string, RestaurantDish[]> = {};
    for (const [restaurantId, value] of Object.entries(map)) {
      if (!Array.isArray(value)) continue;
      out[restaurantId] = value
        .filter((row): row is RestaurantDish => !!row && typeof row === "object")
        .map((row) => ({
          ...row,
          restaurantId: String(row.restaurantId || restaurantId),
        }));
    }
    return out;
  } catch {
    return {};
  }
}

function writeAllCache(dishesByRestaurant: Record<string, RestaurantDish[]>) {
  localStorage.setItem(DISHES_KEY, JSON.stringify(dishesByRestaurant));
}

function readCache(restaurantId = getActiveRestaurantId()): RestaurantDish[] {
  const all = readAllCache();
  const scoped = all[restaurantId];
  if (scoped) return scoped;
  return all[LEGACY_BUCKET] || [];
}

function writeCache(dishes: RestaurantDish[], restaurantId = getActiveRestaurantId()) {
  const all = readAllCache();
  delete all[LEGACY_BUCKET];
  all[restaurantId] = dishes;
  writeAllCache(all);
}

function isApiUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 503) return false;
  const code = (error.body as { code?: unknown } | null)?.code;
  return code === "API_NOT_CONFIGURED" || code === "API_UNREACHABLE";
}

export async function getRestaurantDishes(): Promise<RestaurantDish[]> {
  const restaurantId = getActiveRestaurantId();
  const branchId = getCurrentBranchId();
  if (!isApiConfigured) {
    const cached = readCache();
    setDishCount(restaurantId, cached.length);
    return cached;
  }

  try {
    const rows = await api.get<unknown[]>(`/dishes?branchId=${encodeURIComponent(branchId)}`);
    const mapped = rows.map((row) => mapDish(toDishRow(row))).filter((dish) => dish.restaurantId === restaurantId);
    writeCache(mapped);
    setDishCount(restaurantId, mapped.length);
    return mapped;
  } catch {
    const cached = readCache();
    setDishCount(restaurantId, cached.length);
    return cached;
  }
}

export function saveRestaurantDishes(dishes: RestaurantDish[]) {
  writeCache(dishes);
}

export async function addRestaurantDish(input: Omit<RestaurantDish, "id" | "createdAt" | "restaurantId">) {
  const restaurantId = getActiveRestaurantId();
  const limitGate = canCreateDishWithPlan(restaurantId);
  if (!limitGate.allowed) throw new Error(limitGate.reason);
  const payload = {
    restaurantId,
    categoryId: input.categoryId,
    name: input.name.trim(),
    desc: input.desc.trim(),
    price: input.price,
    thumb: input.thumb.trim(),
    model: input.model.trim(),
    isAvailable: input.isAvailable,
  };
  if (!isApiConfigured) {
    const created: RestaurantDish = {
      id: `local_dish_${Date.now().toString(36)}`,
      restaurantId: payload.restaurantId,
      categoryId: payload.categoryId,
      name: payload.name,
      desc: payload.desc,
      price: payload.price,
      thumb: payload.thumb,
      model: payload.model,
      isAvailable: payload.isAvailable,
      createdAt: new Date().toISOString(),
    };
    const next = [created, ...readCache()];
    writeCache(next);
    setDishCount(restaurantId, next.length);
    return created;
  }
  try {
    const row = await api.post<unknown>("/dishes", {
      categoryId: payload.categoryId,
      name: payload.name,
      description: payload.desc,
      price: payload.price,
      thumbnail_url: payload.thumb,
      thumbUrl: payload.thumb,
      thumbnailUrl: payload.thumb,
      model_url: payload.model,
      modelUrl: payload.model,
      isAvailable: payload.isAvailable,
      restaurantId: payload.restaurantId,
    });
    const created = mapDish(toDishRow(row));
    const next = [created, ...readCache()];
    writeCache(next);
    setDishCount(restaurantId, next.length);
    return created;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    const created: RestaurantDish = {
      id: `local_dish_${Date.now().toString(36)}`,
      restaurantId: payload.restaurantId,
      categoryId: payload.categoryId,
      name: payload.name,
      desc: payload.desc,
      price: payload.price,
      thumb: payload.thumb,
      model: payload.model,
      isAvailable: payload.isAvailable,
      createdAt: new Date().toISOString(),
    };
    const next = [created, ...readCache()];
    writeCache(next);
    setDishCount(restaurantId, next.length);
    return created;
  }
}

export async function updateRestaurantDish(
  id: string,
  updates: Partial<Omit<RestaurantDish, "id" | "createdAt" | "restaurantId">>
) {
  const patch = {
    categoryId: updates.categoryId,
    name: updates.name?.trim(),
    desc: updates.desc?.trim(),
    price: updates.price,
    thumb: updates.thumb?.trim(),
    model: updates.model?.trim(),
    isAvailable: updates.isAvailable,
  };
  if (!isApiConfigured) {
    const next = readCache().map((dish) =>
      dish.id === id
        ? {
            ...dish,
            categoryId: patch.categoryId ?? dish.categoryId,
            name: patch.name ?? dish.name,
            desc: patch.desc ?? dish.desc,
            price: patch.price ?? dish.price,
            thumb: patch.thumb ?? dish.thumb,
            model: patch.model ?? dish.model,
            isAvailable: patch.isAvailable ?? dish.isAvailable,
          }
        : dish
    );
    writeCache(next);
    const updated = next.find((dish) => dish.id === id);
    if (!updated) throw new Error("Dish not found.");
    return updated;
  }
  try {
    const row = await api.patch<unknown>(`/dishes/${id}`, {
      categoryId: patch.categoryId,
      name: patch.name,
      description: patch.desc,
      price: patch.price,
      thumbnail_url: patch.thumb,
      thumbUrl: patch.thumb,
      thumbnailUrl: patch.thumb,
      model_url: patch.model,
      modelUrl: patch.model,
      isAvailable: patch.isAvailable,
    });
    const updated = mapDish(toDishRow(row));
    const next = readCache().map((dish) => (dish.id === id ? updated : dish));
    writeCache(next);
    return updated;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    const next = readCache().map((dish) =>
      dish.id === id
        ? {
            ...dish,
            categoryId: patch.categoryId ?? dish.categoryId,
            name: patch.name ?? dish.name,
            desc: patch.desc ?? dish.desc,
            price: patch.price ?? dish.price,
            thumb: patch.thumb ?? dish.thumb,
            model: patch.model ?? dish.model,
            isAvailable: patch.isAvailable ?? dish.isAvailable,
          }
        : dish
    );
    writeCache(next);
    const updated = next.find((dish) => dish.id === id);
    if (!updated) throw new Error("Dish not found.");
    return updated;
  }
}

export async function deleteRestaurantDish(id: string) {
  const restaurantId = getActiveRestaurantId();
  if (!isApiConfigured) {
    const next = readCache().filter((dish) => dish.id !== id);
    writeCache(next);
    setDishCount(restaurantId, next.length);
    return next;
  }
  try {
    await api.delete(`/dishes/${id}`);
    const next = readCache().filter((dish) => dish.id !== id);
    writeCache(next);
    setDishCount(restaurantId, next.length);
    return next;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    const next = readCache().filter((dish) => dish.id !== id);
    writeCache(next);
    setDishCount(restaurantId, next.length);
    return next;
  }
}

export async function getDishesByCategory(categoryId: string) {
  const rows = await getRestaurantDishes();
  return rows.filter((dish) => dish.categoryId === categoryId);
}

