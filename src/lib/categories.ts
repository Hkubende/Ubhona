import { api } from "./api";
import { isApiConfigured } from "./config";

export type RestaurantCategory = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

const CATEGORIES_KEY = "mv_restaurant_categories_v1";

type ApiCategoryRow = {
  id?: unknown;
  name?: unknown;
  sortOrder?: unknown;
  createdAt?: unknown;
};

function toCategoryRow(value: unknown): ApiCategoryRow {
  if (!value || typeof value !== "object") return {};
  return value as ApiCategoryRow;
}

function mapCategory(row: ApiCategoryRow): RestaurantCategory {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    sortOrder: Number(row.sortOrder || 0),
    createdAt: String(row.createdAt || new Date().toISOString()),
  };
}

function readCache(): RestaurantCategory[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed as RestaurantCategory[];
  } catch {
    return [];
  }
}

function writeCache(categories: RestaurantCategory[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export async function getCategories(): Promise<RestaurantCategory[]> {
  if (!isApiConfigured) return readCache();

  try {
    const rows = await api.get<unknown[]>("/categories");
    const mapped = rows
      .map((row) => mapCategory(toCategoryRow(row)))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    writeCache(mapped);
    return mapped;
  } catch {
    return readCache();
  }
}

export function saveCategories(categories: RestaurantCategory[]) {
  writeCache(categories);
}

export async function addCategory(input: { name: string; sortOrder?: number }) {
  const row = await api.post<unknown>("/categories", {
    name: input.name.trim(),
    sortOrder: input.sortOrder ?? 0,
  });
  const created = mapCategory(toCategoryRow(row));
  const next = [...readCache(), created];
  writeCache(next);
  return created;
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<RestaurantCategory, "name" | "sortOrder">>
) {
  const row = await api.patch<unknown>(`/categories/${id}`, {
    name: updates.name?.trim(),
    sortOrder: updates.sortOrder,
  });
  const updated = mapCategory(toCategoryRow(row));
  const next = readCache().map((category) => (category.id === id ? updated : category));
  writeCache(next);
  return updated;
}

export async function deleteCategory(id: string) {
  await api.delete(`/categories/${id}`);
  const next = readCache().filter((category) => category.id !== id);
  writeCache(next);
  return next;
}

