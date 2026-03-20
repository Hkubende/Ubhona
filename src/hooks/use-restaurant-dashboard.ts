import * as React from "react";
import {
  getActiveRestaurantId,
  getRestaurantDashboardData,
} from "../lib/dashboard-data";
import type { RestaurantDashboardData } from "../types/dashboard";

type UseRestaurantDashboardState = {
  restaurantId: string;
  data: RestaurantDashboardData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

export function useRestaurantDashboard(): UseRestaurantDashboardState {
  const [restaurantId, setRestaurantId] = React.useState("");
  const [data, setData] = React.useState<RestaurantDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeRestaurantId = await getActiveRestaurantId();
      setRestaurantId(activeRestaurantId);
      const payload = await getRestaurantDashboardData(activeRestaurantId);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { restaurantId, data, loading, error, refresh };
}
