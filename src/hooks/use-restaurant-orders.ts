import * as React from "react";
import { getActiveRestaurantId, getDashboardRestaurant, getOrders, setOrderStatus } from "../lib/dashboard-data";
import type { Order, OrderStatus, Restaurant } from "../types/dashboard";

type UseRestaurantOrdersState = {
  restaurantId: string;
  restaurant: Restaurant | null;
  orders: Order[];
  loading: boolean;
  error: string;
  statusFilter: OrderStatus | "all";
  setStatusFilter: React.Dispatch<React.SetStateAction<OrderStatus | "all">>;
  refresh: () => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
};

export function useRestaurantOrders(): UseRestaurantOrdersState {
  const [restaurantId, setRestaurantId] = React.useState("");
  const [restaurant, setRestaurant] = React.useState<Restaurant | null>(null);
  const [allOrders, setAllOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<OrderStatus | "all">("all");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeRestaurantId = await getActiveRestaurantId();
      setRestaurantId(activeRestaurantId);
      const [restaurantData, ordersData] = await Promise.all([
        getDashboardRestaurant(activeRestaurantId),
        getOrders(activeRestaurantId),
      ]);
      setRestaurant(restaurantData);
      setAllOrders(ordersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
      setRestaurant(null);
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = React.useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (!restaurantId) return;
      setError("");
      try {
        const next = await setOrderStatus(restaurantId, orderId, status);
        setAllOrders(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update order status.");
      }
    },
    [restaurantId]
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const orders = React.useMemo(() => {
    if (statusFilter === "all") return allOrders;
    return allOrders.filter((order) => order.status === statusFilter);
  }, [allOrders, statusFilter]);

  return {
    restaurantId,
    restaurant,
    orders,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refresh,
    updateStatus,
  };
}
