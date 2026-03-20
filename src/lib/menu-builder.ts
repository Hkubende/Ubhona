import type { Category, Dish } from "../types/dashboard";

export type MenuCategoryInput = {
  name: string;
  sortOrder?: number;
};

export type MenuDishInput = {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  available: boolean;
  imageUrl: string;
  modelUrl?: string;
};

export function normalizeCategoryName(value: string) {
  return value.trim();
}

export function normalizeDishInput(input: {
  name: string;
  description: string;
  price: string | number;
  categoryId: string;
  available: boolean;
  imageUrl: string;
  modelUrl?: string;
}): MenuDishInput {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    price: typeof input.price === "number" ? input.price : Number(input.price),
    categoryId: input.categoryId.trim(),
    available: Boolean(input.available),
    imageUrl: input.imageUrl.trim(),
    modelUrl: input.modelUrl?.trim() || undefined,
  };
}

export function validateDishInput(input: MenuDishInput) {
  if (!input.categoryId) return "Category is required.";
  if (!input.name) return "Dish name is required.";
  if (!input.description) return "Dish description is required.";
  if (!Number.isFinite(input.price) || input.price <= 0) return "Price must be greater than zero.";
  if (!input.imageUrl) return "Image URL is required.";
  return null;
}

export function getFilteredDishes(
  dishes: Dish[],
  search: string,
  categoryFilter: string
) {
  const q = search.trim().toLowerCase();
  return dishes.filter((dish) => {
    const matchesCategory = categoryFilter === "all" || dish.categoryId === categoryFilter;
    const matchesSearch =
      !q ||
      dish.name.toLowerCase().includes(q) ||
      dish.description.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
}

export function sortCategories(rows: Category[]) {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
