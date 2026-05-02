import { ApiError, api } from "./api";
import { hasRemoteAuthSession } from "./auth";
import { isApiConfigured } from "./config";
import { getRestaurantProfile } from "./restaurant";

export type RestaurantCategory = {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  menuControl?: {
    restaurantId: string;
    categoryId: string;
    isActive: boolean;
  } | null;
  createdAt: string;
};

const CATEGORIES_KEY = "mv_restaurant_categories_v1";
const LEGACY_BUCKET = "__legacy__";
let categoriesRequest: Promise<RestaurantCategory[]> | null = null;

type ApiCategoryRow = {
  id?: unknown;
  restaurantId?: unknown;
  name?: unknown;
  sortOrder?: unknown;
  menuControl?: unknown;
  createdAt?: unknown;
};

function toCategoryRow(value: unknown): ApiCategoryRow {
  if (!value || typeof value !== "object") return {};
  return value as ApiCategoryRow;
}

function mapCategory(row: ApiCategoryRow): RestaurantCategory {
  const profile = getRestaurantProfile();
  return {
    id: String(row.id),
    restaurantId: String(row.restaurantId || profile?.id || "local_default_restaurant"),
    name: String(row.name || ""),
    sortOrder: Number(row.sortOrder || 0),
    menuControl:
      row.menuControl && typeof row.menuControl === "object"
        ? {
            restaurantId: String((row.menuControl as Record<string, unknown>).restaurantId || profile?.id || "local_default_restaurant"),
            categoryId: String((row.menuControl as Record<string, unknown>).categoryId || row.id || ""),
            isActive: (row.menuControl as Record<string, unknown>).isActive !== false,
          }
        : null,
    createdAt: String(row.createdAt || new Date().toISOString()),
  };
}

function getActiveRestaurantId() {
  return getRestaurantProfile()?.id || "local_default_restaurant";
}

function readAllCache(): Record<string, RestaurantCategory[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "[]");
    if (Array.isArray(parsed)) {
      const legacy = parsed
        .filter((row): row is RestaurantCategory => !!row && typeof row === "object")
        .map((row) => ({
          ...row,
          restaurantId: String((row as RestaurantCategory).restaurantId || LEGACY_BUCKET),
        }));
      return { [LEGACY_BUCKET]: legacy };
    }
    if (!parsed || typeof parsed !== "object") return {};
    const map = parsed as Record<string, unknown>;
    const out: Record<string, RestaurantCategory[]> = {};
    for (const [restaurantId, value] of Object.entries(map)) {
      if (!Array.isArray(value)) continue;
      out[restaurantId] = value
        .filter((row): row is RestaurantCategory => !!row && typeof row === "object")
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

function writeAllCache(categoriesByRestaurant: Record<string, RestaurantCategory[]>) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categoriesByRestaurant));
}

function readCache(restaurantId = getActiveRestaurantId()): RestaurantCategory[] {
  const all = readAllCache();
  const scoped = all[restaurantId];
  if (scoped) return scoped;
  return all[LEGACY_BUCKET] || [];
}

function writeCache(categories: RestaurantCategory[], restaurantId = getActiveRestaurantId()) {
  const all = readAllCache();
  delete all[LEGACY_BUCKET];
  all[restaurantId] = categories;
  writeAllCache(all);
}

function isApiUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 503) return false;
  const code = (error.body as { code?: unknown } | null)?.code;
  return code === "API_NOT_CONFIGURED" || code === "API_UNREACHABLE";
}

function normalizeLocal(rows: RestaurantCategory[]) {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getCategories(): Promise<RestaurantCategory[]> {
  const restaurantId = getActiveRestaurantId();
  if (!isApiConfigured || !hasRemoteAuthSession()) return readCache();
  if (categoriesRequest) return categoriesRequest;

  categoriesRequest = (async () => {
    try {
      const rows = await api.get<unknown[]>("/categories");
      const mapped = rows
        .map((row) => mapCategory(toCategoryRow(row)))
        .filter((row) => row.restaurantId === restaurantId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      writeCache(mapped);
      return mapped;
    } catch {
      return readCache();
    } finally {
      categoriesRequest = null;
    }
  })();

  return categoriesRequest;
}

export function saveCategories(categories: RestaurantCategory[]) {
  writeCache(categories);
}

export async function addCategory(input: { name: string; sortOrder?: number; isActive?: boolean }) {
  const restaurantId = getActiveRestaurantId();
  const name = input.name.trim();
  const sortOrder = input.sortOrder ?? 0;
  if (!isApiConfigured) {
    const id = `local_cat_${Date.now().toString(36)}`;
    const created: RestaurantCategory = {
      id,
      restaurantId,
      name,
      sortOrder,
      menuControl: {
        restaurantId,
        categoryId: id,
        isActive: input.isActive !== false,
      },
      createdAt: new Date().toISOString(),
    };
    const next = normalizeLocal([...readCache(), created]);
    writeCache(next);
    return created;
  }
  try {
    const row = await api.post<unknown>("/categories", { name, sortOrder, isActive: input.isActive });
    const created = mapCategory(toCategoryRow(row));
    const next = normalizeLocal([...readCache(), created]);
    writeCache(next);
    return created;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    const id = `local_cat_${Date.now().toString(36)}`;
    const created: RestaurantCategory = {
      id,
      restaurantId,
      name,
      sortOrder,
      menuControl: {
        restaurantId,
        categoryId: id,
        isActive: input.isActive !== false,
      },
      createdAt: new Date().toISOString(),
    };
    const next = normalizeLocal([...readCache(), created]);
    writeCache(next);
    return created;
  }
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<RestaurantCategory, "name" | "sortOrder" | "menuControl">> & { isActive?: boolean }
) {
  const patch = {
    name: updates.name?.trim(),
    sortOrder: updates.sortOrder,
    isActive: updates.isActive ?? updates.menuControl?.isActive,
  };
  if (!isApiConfigured) {
    const next = normalizeLocal(
      readCache().map((category) =>
        category.id === id
          ? {
              ...category,
              name: patch.name ?? category.name,
              sortOrder: patch.sortOrder ?? category.sortOrder,
              menuControl: {
                restaurantId: category.restaurantId,
                categoryId: category.id,
                isActive: patch.isActive ?? category.menuControl?.isActive ?? true,
              },
            }
          : category
      )
    );
    writeCache(next);
    const updated = next.find((category) => category.id === id);
    if (!updated) throw new Error("Category not found.");
    return updated;
  }
  try {
    const row = await api.patch<unknown>(`/categories/${id}`, patch);
    const updated = mapCategory(toCategoryRow(row));
    const next = normalizeLocal(readCache().map((category) => (category.id === id ? updated : category)));
    writeCache(next);
    return updated;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    const next = normalizeLocal(
      readCache().map((category) =>
        category.id === id
          ? {
              ...category,
              name: patch.name ?? category.name,
              sortOrder: patch.sortOrder ?? category.sortOrder,
              menuControl: {
                restaurantId: category.restaurantId,
                categoryId: category.id,
                isActive: patch.isActive ?? category.menuControl?.isActive ?? true,
              },
            }
          : category
      )
    );
    writeCache(next);
    const updated = next.find((category) => category.id === id);
    if (!updated) throw new Error("Category not found.");
    return updated;
  }
}

export async function deleteCategory(id: string) {
  if (!isApiConfigured) {
    const next = normalizeLocal(readCache().filter((category) => category.id !== id));
    writeCache(next);
    return next;
  }
  try {
    await api.delete(`/categories/${id}`);
    const next = normalizeLocal(readCache().filter((category) => category.id !== id));
    writeCache(next);
    return next;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    const next = normalizeLocal(readCache().filter((category) => category.id !== id));
    writeCache(next);
    return next;
  }
}

