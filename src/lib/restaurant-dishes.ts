import { ApiError, api } from "./api";
import { isApiConfigured } from "./config";
import { getRestaurantProfile } from "./restaurant";

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
  thumb?: unknown;
  modelUrl?: unknown;
  model?: unknown;
  isAvailable?: unknown;
  createdAt?: unknown;
};

function toDishRow(value: unknown): ApiDishRow {
  if (!value || typeof value !== "object") return {};
  return value as ApiDishRow;
}

function mapDish(row: ApiDishRow): RestaurantDish {
  const profile = getRestaurantProfile();
  return {
    id: String(row.id),
    restaurantId: String(row.restaurantId || profile?.id || "local_default_restaurant"),
    categoryId: String(row.categoryId || ""),
    name: String(row.name || ""),
    desc: String(row.description || row.desc || ""),
    price: Number(row.price || 0),
    thumb: String(row.thumbUrl || row.thumb || ""),
    model: String(row.modelUrl || row.model || ""),
    isAvailable: row.isAvailable === false ? false : true,
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
  if (!isApiConfigured) return readCache();

  try {
    const rows = await api.get<unknown[]>("/dishes");
    const mapped = rows.map((row) => mapDish(toDishRow(row))).filter((dish) => dish.restaurantId === restaurantId);
    writeCache(mapped);
    return mapped;
  } catch {
    return readCache();
  }
}

export function saveRestaurantDishes(dishes: RestaurantDish[]) {
  writeCache(dishes);
}

export async function addRestaurantDish(input: Omit<RestaurantDish, "id" | "createdAt" | "restaurantId">) {
  const restaurantId = getActiveRestaurantId();
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
    return created;
  }
  try {
    const row = await api.post<unknown>("/dishes", {
      categoryId: payload.categoryId,
      name: payload.name,
      description: payload.desc,
      price: payload.price,
      thumbUrl: payload.thumb,
      modelUrl: payload.model,
      isAvailable: payload.isAvailable,
      restaurantId: payload.restaurantId,
    });
    const created = mapDish(toDishRow(row));
    const next = [created, ...readCache()];
    writeCache(next);
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
      thumbUrl: patch.thumb,
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
  if (!isApiConfigured) {
    const next = readCache().filter((dish) => dish.id !== id);
    writeCache(next);
    return next;
  }
  try {
    await api.delete(`/dishes/${id}`);
    const next = readCache().filter((dish) => dish.id !== id);
    writeCache(next);
    return next;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    const next = readCache().filter((dish) => dish.id !== id);
    writeCache(next);
    return next;
  }
}

export async function getDishesByCategory(categoryId: string) {
  const rows = await getRestaurantDishes();
  return rows.filter((dish) => dish.categoryId === categoryId);
}

