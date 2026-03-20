import * as React from "react";
import { getActiveRestaurantId, getCategories, getDishes } from "../lib/dashboard-data";
import type { Category, Dish } from "../types/dashboard";

type UseRestaurantMenuState = {
  restaurantId: string;
  categories: Category[];
  dishes: Dish[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

export function useRestaurantMenu(): UseRestaurantMenuState {
  const [restaurantId, setRestaurantId] = React.useState("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [dishes, setDishes] = React.useState<Dish[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeRestaurantId = await getActiveRestaurantId();
      setRestaurantId(activeRestaurantId);
      const [nextCategories, nextDishes] = await Promise.all([
        getCategories(activeRestaurantId),
        getDishes(activeRestaurantId),
      ]);
      setCategories(nextCategories);
      setDishes(nextDishes);
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

  return { restaurantId, categories, dishes, loading, error, refresh };
}
