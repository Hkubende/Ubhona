import { api } from "./api";

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

function normalizeRestaurant(row: any): PublicRestaurant {
  return {
    id: String(row.id),
    slug: String(row.slug || ""),
    name: String(row.name || ""),
    location: String(row.location || ""),
    logoUrl: String(row.logoUrl || "") || undefined,
    coverImage: String(row.coverImage || "") || undefined,
    themePrimary: String(row.themePrimary || "") || undefined,
    themeSecondary: String(row.themeSecondary || "") || undefined,
    shortDescription: String(row.shortDescription || "") || undefined,
  };
}

function normalizeCategory(row: any): PublicCategory {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    sortOrder: Number(row.sortOrder || 0),
  };
}

function normalizeDish(row: any): PublicDish {
  return {
    id: String(row.id),
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

export async function getRestaurantBySlug(slug: string) {
  const row = await api.get<any>(`/restaurants/${encodeURIComponent(slug)}`);
  return normalizeRestaurant(row);
}

export async function getRestaurantCategoriesBySlug(slug: string) {
  const rows = await api.get<any[]>(`/restaurants/${encodeURIComponent(slug)}/categories`);
  return rows.map(normalizeCategory);
}

export async function getRestaurantDishesBySlug(slug: string) {
  const rows = await api.get<any[]>(`/restaurants/${encodeURIComponent(slug)}/dishes`);
  return rows.map(normalizeDish).filter((dish) => dish.isAvailable);
}
