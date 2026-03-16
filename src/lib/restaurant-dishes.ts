import { api } from "./api";

export type RestaurantDish = {
  id: string;
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

function mapDish(row: any): RestaurantDish {
  return {
    id: String(row.id),
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

function readCache(): RestaurantDish[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISHES_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed as RestaurantDish[];
  } catch {
    return [];
  }
}

function writeCache(dishes: RestaurantDish[]) {
  localStorage.setItem(DISHES_KEY, JSON.stringify(dishes));
}

export async function getRestaurantDishes(): Promise<RestaurantDish[]> {
  try {
    const rows = await api.get<any[]>("/dishes");
    const mapped = rows.map(mapDish);
    writeCache(mapped);
    return mapped;
  } catch {
    return readCache();
  }
}

export function saveRestaurantDishes(dishes: RestaurantDish[]) {
  writeCache(dishes);
}

export async function addRestaurantDish(input: Omit<RestaurantDish, "id" | "createdAt">) {
  const row = await api.post<any>("/dishes", {
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.desc.trim(),
    price: input.price,
    thumbUrl: input.thumb.trim(),
    modelUrl: input.model.trim(),
    isAvailable: input.isAvailable,
  });
  const created = mapDish(row);
  const next = [created, ...readCache()];
  writeCache(next);
  return created;
}

export async function updateRestaurantDish(
  id: string,
  updates: Partial<Omit<RestaurantDish, "id" | "createdAt">>
) {
  const row = await api.patch<any>(`/dishes/${id}`, {
    categoryId: updates.categoryId,
    name: updates.name?.trim(),
    description: updates.desc?.trim(),
    price: updates.price,
    thumbUrl: updates.thumb?.trim(),
    modelUrl: updates.model?.trim(),
    isAvailable: updates.isAvailable,
  });
  const updated = mapDish(row);
  const next = readCache().map((dish) => (dish.id === id ? updated : dish));
  writeCache(next);
  return updated;
}

export async function deleteRestaurantDish(id: string) {
  await api.delete(`/dishes/${id}`);
  const next = readCache().filter((dish) => dish.id !== id);
  writeCache(next);
  return next;
}

export async function getDishesByCategory(categoryId: string) {
  const rows = await getRestaurantDishes();
  return rows.filter((dish) => dish.categoryId === categoryId);
}

