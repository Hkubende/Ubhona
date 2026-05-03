import * as React from "react";
import {
  getCachedRestaurantDashboardData,
  getActiveRestaurantId,
  getRestaurantDashboardData,
} from "../lib/dashboard-data";
import { getRestaurantProfile } from "../lib/restaurant";
import type { RestaurantDashboardData } from "../types/dashboard";

type UseRestaurantDashboardState = {
  restaurantId: string;
  data: RestaurantDashboardData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

export function useRestaurantDashboard(): UseRestaurantDashboardState {
  const initialRestaurantId = React.useMemo(() => String(getRestaurantProfile()?.id || "").trim(), []);
  const initialData = React.useMemo(
    () => (initialRestaurantId ? getCachedRestaurantDashboardData(initialRestaurantId) : null),
    [initialRestaurantId]
  );
  const [restaurantId, setRestaurantId] = React.useState(initialData?.restaurant.id || initialRestaurantId);
  const [data, setData] = React.useState<RestaurantDashboardData | null>(initialData);
  const [loading, setLoading] = React.useState(!initialData);
  const [error, setError] = React.useState("");
  const refreshSequenceRef = React.useRef(0);
  const mountedRef = React.useRef(true);
  const dataRef = React.useRef<RestaurantDashboardData | null>(initialData);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = React.useCallback(async () => {
    const refreshId = ++refreshSequenceRef.current;
    setLoading(!dataRef.current);
    setError("");
    try {
      const activeRestaurantId = dataRef.current?.restaurant.id || getRestaurantProfile()?.id || (await getActiveRestaurantId());
      const payload = await getRestaurantDashboardData(activeRestaurantId);
      if (!mountedRef.current || refreshId !== refreshSequenceRef.current) return;
      setRestaurantId(activeRestaurantId);
      setData(payload);
      dataRef.current = payload;
    } catch (err) {
      if (!mountedRef.current || refreshId !== refreshSequenceRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      if (!dataRef.current) {
        setData(null);
      }
    } finally {
      if (mountedRef.current && refreshId === refreshSequenceRef.current) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { restaurantId, data, loading, error, refresh };
}
