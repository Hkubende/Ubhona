import * as React from "react";
import {
  addCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type RestaurantCategory,
} from "../lib/categories";
import {
  addRestaurantDish,
  deleteRestaurantDish,
  getRestaurantDishes,
  updateRestaurantDish,
  type RestaurantDish,
} from "../lib/restaurant-dishes";
import {
  normalizeCategoryName,
  type MenuCategoryInput,
  type MenuDishInput,
  validateDishInput,
} from "../lib/menu-builder";
import { getRestaurantProfile } from "../lib/restaurant";
import type { Category, Dish } from "../types/dashboard";

type UseRestaurantMenuBuilderState = {
  restaurantId: string;
  categories: Category[];
  dishes: Dish[];
  loading: boolean;
  saving: boolean;
  error: string;
  refresh: () => Promise<void>;
  createCategory: (input: MenuCategoryInput) => Promise<void>;
  editCategory: (id: string, input: MenuCategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  createDish: (input: MenuDishInput) => Promise<void>;
  editDish: (id: string, input: MenuDishInput) => Promise<void>;
  removeDish: (id: string) => Promise<void>;
};

function getActiveRestaurantId() {
  return getRestaurantProfile()?.id || "local_default_restaurant";
}

function mapCategory(row: RestaurantCategory): Category {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    name: row.name,
    sortOrder: row.sortOrder,
  };
}

function mapDish(row: RestaurantDish): Dish {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    categoryId: row.categoryId,
    name: row.name,
    description: row.desc,
    price: row.price,
    imageUrl: row.thumb,
    modelUrl: row.model || undefined,
    available: row.isAvailable,
  };
}

export function useRestaurantMenuBuilder(): UseRestaurantMenuBuilderState {
  const [restaurantId, setRestaurantId] = React.useState("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [dishes, setDishes] = React.useState<Dish[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeRestaurantId = getActiveRestaurantId();
      setRestaurantId(activeRestaurantId);
      const [nextCategories, nextDishes] = await Promise.all([getCategories(), getRestaurantDishes()]);
      setCategories(nextCategories.map(mapCategory));
      setDishes(nextDishes.map(mapDish));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load menu data.");
      setCategories([]);
      setDishes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCategory = React.useCallback(
    async (input: MenuCategoryInput) => {
      const name = normalizeCategoryName(input.name);
      if (!name) {
        setError("Category name is required.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        await addCategory({ name, sortOrder: input.sortOrder ?? categories.length });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create category.");
      } finally {
        setSaving(false);
      }
    },
    [categories.length, refresh]
  );

  const editCategory = React.useCallback(
    async (id: string, input: MenuCategoryInput) => {
      const name = normalizeCategoryName(input.name);
      if (!name) {
        setError("Category name is required.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        await updateCategory(id, { name, sortOrder: input.sortOrder });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update category.");
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  const removeCategory = React.useCallback(
    async (id: string) => {
      const hasDishes = dishes.some((dish) => dish.categoryId === id);
      if (hasDishes) {
        setError("Move or delete dishes in this category before deleting it.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        await deleteCategory(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete category.");
      } finally {
        setSaving(false);
      }
    },
    [dishes, refresh]
  );

  const createDish = React.useCallback(
    async (input: MenuDishInput) => {
      const validationError = validateDishInput(input);
      if (validationError) {
        setError(validationError);
        return;
      }
      setSaving(true);
      setError("");
      try {
        await addRestaurantDish({
          categoryId: input.categoryId,
          name: input.name,
          desc: input.description,
          price: input.price,
          thumb: input.imageUrl,
          model: input.modelUrl || "",
          isAvailable: input.available,
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create dish.");
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  const editDish = React.useCallback(
    async (id: string, input: MenuDishInput) => {
      const validationError = validateDishInput(input);
      if (validationError) {
        setError(validationError);
        return;
      }
      setSaving(true);
      setError("");
      try {
        await updateRestaurantDish(id, {
          categoryId: input.categoryId,
          name: input.name,
          desc: input.description,
          price: input.price,
          thumb: input.imageUrl,
          model: input.modelUrl || "",
          isAvailable: input.available,
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update dish.");
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  const removeDish = React.useCallback(
    async (id: string) => {
      setSaving(true);
      setError("");
      try {
        await deleteRestaurantDish(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete dish.");
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  return {
    restaurantId,
    categories,
    dishes,
    loading,
    saving,
    error,
    refresh,
    createCategory,
    editCategory,
    removeCategory,
    createDish,
    editDish,
    removeDish,
  };
}

