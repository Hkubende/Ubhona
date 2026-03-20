import { ApiError, api } from "./api";
import { isApiConfigured } from "./config";
import { fetchDishes } from "./dishes";
import { getCategories } from "./categories";
import { getRestaurantDishes } from "./restaurant-dishes";
import { getRestaurantProfile } from "./restaurant";

export type PublicRestaurant = {
  id: string;
  slug: string;
  name: string;
  location: string;
  logoUrl?: string;
  coverImage?: string;
  themePrimary?: string;
  themeSecondary?: string;
  shortDescription?: string;
};

export type PublicCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type PublicDish = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  thumbUrl: string;
  modelUrl: string;
  isAvailable: boolean;
};

export type PublicStorefrontData = {
  restaurant: PublicRestaurant;
  categories: PublicCategory[];
  dishes: PublicDish[];
};

const DEMO_SLUGS = new Set(["demo", "ubhona", "ubhona-demo"]);
const UNSUPPORTED_DEMO_MODEL_IDS = new Set([
  "avalon-lemon",
  "burger-drink",
  "mexican-avocado",
  "orange",
  "persian-lime",
]);

type LooseRecord = Record<string, unknown>;
type LocalFallbackData = {
  restaurant: PublicRestaurant;
  categories: PublicCategory[];
  dishes: PublicDish[];
};

const localFallbackBySlug = new Map<string, Promise<LocalFallbackData>>();

function toRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as LooseRecord;
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

function assertSlug(value: string) {
  if (!normalizeSlug(value)) {
    throw new Error("Restaurant not found.");
  }
}

function isNotFoundError(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

function isApiUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 503) return false;
  const code = (error.body as { code?: unknown } | null)?.code;
  return code === "API_NOT_CONFIGURED" || code === "API_UNREACHABLE";
}

function mapApiRestaurant(rowValue: unknown): PublicRestaurant {
  const row = toRecord(rowValue) || {};
  return {
    id: String(row.id || ""),
    slug: normalizeSlug(String(row.slug || "")),
    name: String(row.name || ""),
    location: String(row.location || ""),
    logoUrl: String(row.logoUrl || "") || undefined,
    coverImage: String(row.coverImage || "") || undefined,
    themePrimary: String(row.themePrimary || "") || undefined,
    themeSecondary: String(row.themeSecondary || "") || undefined,
    shortDescription: String(row.shortDescription || "") || undefined,
  };
}

function mapApiCategory(rowValue: unknown): PublicCategory {
  const row = toRecord(rowValue) || {};
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    sortOrder: Number(row.sortOrder || 0),
  };
}

function mapApiDish(rowValue: unknown): PublicDish {
  const row = toRecord(rowValue) || {};
  return {
    id: String(row.id || ""),
    restaurantId: String(row.restaurantId || ""),
    categoryId: String(row.categoryId || ""),
    name: String(row.name || ""),
    description: String(row.description || ""),
    price: Number(row.price || 0),
    thumbUrl: String(row.thumbUrl || ""),
    modelUrl: String(row.modelUrl || ""),
    isAvailable: row.isAvailable !== false,
  };
}

async function getLocalFallback(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  const profile = getRestaurantProfile();
  const profileSlug = normalizeSlug(profile?.slug || "");
  const canUseProfile = !!profile && profileSlug === normalizedSlug;
  const canUseDemo = DEMO_SLUGS.has(normalizedSlug);

  if (!canUseProfile && !canUseDemo) {
    throw new Error("Restaurant not found.");
  }

  const localCategories = canUseProfile ? await getCategories() : [];
  const localRestaurantDishes = canUseProfile ? await getRestaurantDishes() : [];
  const dishes = !localRestaurantDishes.length ? await fetchDishes() : [];
  const categoryNameById = new Map<string, string>();
  const categories: PublicCategory[] = localCategories.map((category) => ({
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
  }));
  for (const category of categories) {
    categoryNameById.set(category.name.trim() || "Menu", category.id);
  }
  let categoryCounter = categories.length;

  const restaurant: PublicRestaurant = canUseProfile
    ? {
        id: profile?.id || "local_restaurant",
        slug: profileSlug,
        name: profile?.restaurantName || "Ubhona Restaurant",
        location: profile?.location || "Nairobi, Kenya",
        logoUrl: profile?.logo || undefined,
        coverImage: profile?.coverImage || undefined,
        themePrimary: profile?.themePrimary || "#E4572E",
        themeSecondary: profile?.themeSecondary || "#E8D8C3",
        shortDescription: profile?.shortDescription || "Visualize",
      }
    : {
        id: "demo_restaurant",
        slug: normalizedSlug,
        name: "Ubhona Demo Restaurant",
        location: "Nairobi, Kenya",
        logoUrl: undefined,
        coverImage: undefined,
        themePrimary: "#E4572E",
        themeSecondary: "#E8D8C3",
        shortDescription: "Visualize",
      };

  const managedDishes: PublicDish[] = localRestaurantDishes.map((dish) => ({
    id: dish.id,
    restaurantId: restaurant.id,
    categoryId: dish.categoryId,
    name: dish.name,
    description: dish.desc,
    price: dish.price,
    thumbUrl: dish.thumb,
    modelUrl: dish.model,
    isAvailable: dish.isAvailable,
  }));

  const fallbackDishes: PublicDish[] = dishes
    .filter((dish) => !(canUseDemo && UNSUPPORTED_DEMO_MODEL_IDS.has(dish.id)))
    .map((dish) => {
      const categoryName = dish.cat.trim() || "Menu";
      const categoryId = categoryNameById.get(categoryName) || "local_category_0";
      if (!categoryNameById.has(categoryName)) {
        const id = `local_category_${categoryCounter++}`;
        categoryNameById.set(categoryName, id);
        categories.push({ id, name: categoryName, sortOrder: categories.length });
      }
      return {
        id: dish.id,
        restaurantId: restaurant.id,
        categoryId: categoryNameById.get(categoryName) || categoryId,
        name: dish.name,
        description: dish.desc,
        price: dish.price,
        thumbUrl: dish.thumb,
        modelUrl: dish.model,
        isAvailable: true,
      };
    });

  const sourceDishes = managedDishes.length ? managedDishes : fallbackDishes;
  return { restaurant, categories, dishes: sourceDishes };
}

function getLocalFallbackCached(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  const cached = localFallbackBySlug.get(normalizedSlug);
  if (cached) return cached;

  const pending = getLocalFallback(normalizedSlug).catch((error) => {
    localFallbackBySlug.delete(normalizedSlug);
    throw error;
  });
  localFallbackBySlug.set(normalizedSlug, pending);
  return pending;
}

export async function getRestaurantBySlug(slug: string) {
  assertSlug(slug);
  const normalizedSlug = normalizeSlug(slug);
  if (isApiConfigured) {
    try {
      const row = await api.get<unknown>(`/restaurants/${encodeURIComponent(normalizedSlug)}`);
      return mapApiRestaurant(row);
    } catch (error) {
      if (!isNotFoundError(error) && !isApiUnavailable(error)) throw error;
    }
  }
  const fallback = await getLocalFallbackCached(normalizedSlug);
  return fallback.restaurant;
}

export async function getRestaurantCategoriesBySlug(slug: string) {
  assertSlug(slug);
  const normalizedSlug = normalizeSlug(slug);
  if (isApiConfigured) {
    try {
      const rows = await api.get<unknown[]>(`/restaurants/${encodeURIComponent(normalizedSlug)}/categories`);
      return rows.map(mapApiCategory).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    } catch (error) {
      if (!isNotFoundError(error) && !isApiUnavailable(error)) throw error;
    }
  }
  const fallback = await getLocalFallbackCached(normalizedSlug);
  return [...fallback.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getRestaurantDishesBySlug(slug: string) {
  assertSlug(slug);
  const normalizedSlug = normalizeSlug(slug);
  if (isApiConfigured) {
    try {
      const rows = await api.get<unknown[]>(`/restaurants/${encodeURIComponent(normalizedSlug)}/dishes`);
      return rows.map(mapApiDish).filter((dish) => dish.isAvailable);
    } catch (error) {
      if (!isNotFoundError(error) && !isApiUnavailable(error)) throw error;
    }
  }
  const fallback = await getLocalFallbackCached(normalizedSlug);
  return fallback.dishes.filter((dish) => dish.isAvailable);
}

export async function getStorefrontDataBySlug(slug: string): Promise<PublicStorefrontData> {
  const [restaurant, categories, dishes] = await Promise.all([
    getRestaurantBySlug(slug),
    getRestaurantCategoriesBySlug(slug),
    getRestaurantDishesBySlug(slug),
  ]);
  return { restaurant, categories, dishes };
}

export async function getRestaurantArDishesBySlug(slug: string) {
  const dishes = await getRestaurantDishesBySlug(slug);
  return dishes.filter((dish) => String(dish.modelUrl || "").trim().length > 0);
}
