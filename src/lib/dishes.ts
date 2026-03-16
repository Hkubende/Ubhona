import { resolveLocalAssetPath } from "./localAssets";
import { api } from "./api";
import { isApiConfigured } from "./config";

export type Dish = {
  id: string;
  cat: string;
  name: string;
  price: number;
  desc: string;
  model: string;
  thumb: string;
};

export const CUSTOM_PRODUCTS_KEY = "mv_custom_products_v1";
export const MENU_CATEGORIES_KEY = "mv_menu_categories_v1";

const BASE_URL = import.meta.env.BASE_URL;

function withBase(path: string) {
  if (!path) return path;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  const cleaned = path.replace(/^\/+/, "");
  return `${BASE_URL}${cleaned}`;
}

function isDish(value: unknown): value is Dish {
  if (!value || typeof value !== "object") return false;
  const dish = value as Record<string, unknown>;
  return (
    typeof dish.id === "string" &&
    typeof dish.cat === "string" &&
    typeof dish.name === "string" &&
    typeof dish.price === "number" &&
    Number.isFinite(dish.price) &&
    typeof dish.desc === "string" &&
    typeof dish.model === "string" &&
    typeof dish.thumb === "string"
  );
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function loadCustomProducts(): Dish[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_PRODUCTS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDish);
  } catch {
    return [];
  }
}

export function saveCustomProducts(products: Dish[]) {
  localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(products));
}

export function loadMenuCategories(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MENU_CATEGORIES_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value || "").trim())
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

export function saveMenuCategories(categories: string[]) {
  const normalized = Array.from(
    new Set(categories.map((value) => String(value || "").trim()).filter(Boolean))
  );
  localStorage.setItem(MENU_CATEGORIES_KEY, JSON.stringify(normalized));
}

export function addMenuCategory(category: string) {
  const next = Array.from(new Set([...loadMenuCategories(), category.trim()]));
  saveMenuCategories(next);
  return next;
}

export function removeMenuCategory(category: string) {
  const target = category.trim().toLowerCase();
  const next = loadMenuCategories().filter((value) => value.trim().toLowerCase() !== target);
  saveMenuCategories(next);
  return next;
}

export function upsertCustomProduct(dish: Dish) {
  const current = loadCustomProducts();
  const next = [...current.filter((item) => item.id !== dish.id), dish];
  saveCustomProducts(next);
  return next;
}

export async function loadFallbackDishes(): Promise<Dish[]> {
  const response = await fetch(withBase("data/dishes.json"), { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load dishes.json (${response.status})`);
  const base = (await response.json()) as unknown;
  if (!Array.isArray(base)) throw new Error("dishes.json must be an array");

  const baseDishes = base.filter(isDish);
  return Promise.all(
    baseDishes.map(async (dish) => ({
      ...dish,
      model: withBase(await resolveLocalAssetPath(dish.model)),
      thumb: withBase(await resolveLocalAssetPath(dish.thumb)),
    }))
  );
}

export async function loadRestaurantDishes(): Promise<Dish[]> {
  if (!isApiConfigured) return [];

  const [categories, rawDishes] = await Promise.all([
    api.get<unknown[]>("/categories"),
    api.get<unknown[]>("/dishes"),
  ]);
  const categoryNameById = new Map<string, string>(
    categories.map((category) => {
      const row = toRecord(category);
      return [String(row?.id || ""), String(row?.name || "Menu")];
    })
  );
  const raw = rawDishes
    .map((dish) => toRecord(dish))
    .filter((dish): dish is Record<string, unknown> => !!dish && dish.isAvailable !== false);
  return Promise.all(
    raw.map(async (dish) => ({
      id: String(dish.id),
      cat: categoryNameById.get(String(dish.categoryId)) || "Menu",
      name: String(dish.name || ""),
      price: Number(dish.price || 0),
      desc: String(dish.description || dish.desc || ""),
      model: withBase(await resolveLocalAssetPath(String(dish.modelUrl || dish.model || ""))),
      thumb: withBase(await resolveLocalAssetPath(String(dish.thumbUrl || dish.thumb || ""))),
    }))
  );
}

export async function loadActiveMenuDishes(): Promise<Dish[]> {
  try {
    const restaurantMenu = await loadRestaurantDishes();
    if (restaurantMenu.length > 0) return restaurantMenu;
  }
  catch {
    // fall back to demo data below
  }

  const fallback = await loadFallbackDishes();
  const custom = loadCustomProducts();

  const byId = new Map<string, Dish>();
  for (const dish of fallback) byId.set(dish.id, dish);
  for (const dish of custom) byId.set(dish.id, dish);

  return [...byId.values()];
}

export async function fetchDishes(): Promise<Dish[]> {
  return loadActiveMenuDishes();
}

export function getCategories(dishes: Dish[]) {
  return ["All", ...Array.from(new Set(dishes.map((dish) => dish.cat)))];
}

export function getDishById(dishes: Dish[], id: string) {
  return dishes.find((dish) => dish.id === id);
}

export function getMenuCategories(dishes: Dish[]) {
  return getCategories(dishes);
}
