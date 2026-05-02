import * as React from "react";
import { getActiveRestaurantId, getAnalyticsSummary, getDashboardRestaurant } from "../lib/dashboard-data";
import {
  canUseFeature,
  getCurrentPlan,
  getFeatureGate,
  getRestaurantProfile,
  syncRestaurantProfile,
  type RestaurantProfile,
} from "../lib/restaurant";
import type { AnalyticsSummary, Restaurant } from "../types/dashboard";

type UseRestaurantAnalyticsState = {
  restaurantId: string;
  restaurant: Restaurant | null;
  summary: AnalyticsSummary | null;
  loading: boolean;
  error: string;
  planLabel: string;
  analyticsEnabled: boolean;
  gateMessage: string;
  refresh: () => Promise<void>;
  setRestaurantProfile: (profile: RestaurantProfile | null) => void;
};

export function useRestaurantAnalytics(): UseRestaurantAnalyticsState {
  const [restaurantId, setRestaurantId] = React.useState("");
  const [restaurant, setRestaurant] = React.useState<Restaurant | null>(null);
  const [summary, setSummary] = React.useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [profile, setProfile] = React.useState<RestaurantProfile | null>(null);

  const plan = React.useMemo(() => getCurrentPlan(profile), [profile]);
  const analyticsGate = React.useMemo(() => getFeatureGate("analytics", profile), [profile]);
  const analyticsEnabled = analyticsGate.enabled;

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeRestaurantId = await getActiveRestaurantId();
      setRestaurantId(activeRestaurantId);
      const resolvedProfile = (await syncRestaurantProfile()) || profile || getRestaurantProfile();
      if (resolvedProfile) {
        setProfile(resolvedProfile);
      }
      const enabled = canUseFeature("analytics", resolvedProfile || profile || getRestaurantProfile());
      const restaurantData = await getDashboardRestaurant(activeRestaurantId);
      setRestaurant(restaurantData);
      if (!enabled) {
        setSummary(null);
        return;
      }
      const analyticsData = await getAnalyticsSummary(activeRestaurantId);
      setSummary(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
      setRestaurant(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!analyticsEnabled) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [analyticsEnabled, refresh]);

  return {
    restaurantId,
    restaurant,
    summary,
    loading,
    error,
    planLabel: plan.label,
    analyticsEnabled,
    gateMessage: analyticsGate.message,
    refresh,
    setRestaurantProfile: setProfile,
  };
}
