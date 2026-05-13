import * as React from "react";
import { getActiveRestaurantId, getDashboardRestaurant, getOrders } from "../lib/dashboard-data";
import type { Order, OrderStatus, Restaurant } from "../types/dashboard";
import { platformStore } from "../state/platform-store";
import { updateOrderStatusWorkflow } from "../services";
import { subscribeOrderRealtimeEvents } from "../lib/orders-realtime";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getPrimaryDashboardRole } from "../lib/roles";
import { emitAutomationEvent, getAutomationSettings, getCurrentBranchId, getOrderOverdueState } from "../services/automation-engine";

type UseRestaurantOrdersState = {
  restaurantId: string;
  restaurant: Restaurant | null;
  allOrders: Order[];
  orders: Order[];
  loading: boolean;
  error: string;
  statusFilter: OrderStatus | "all";
  setStatusFilter: React.Dispatch<React.SetStateAction<OrderStatus | "all">>;
  refresh: () => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  overdueOrderIds: string[];
  newOrderIds: string[];
  hasNewOrders: boolean;
  acknowledgeNewOrders: () => void;
  lastSyncedAt: string;
};

type UseRestaurantOrdersOptions = {
  enableRealtime?: boolean;
  pollingIntervalMs?: number;
  trackOverdue?: boolean;
};

export function useRestaurantOrders(options: UseRestaurantOrdersOptions = {}): UseRestaurantOrdersState {
  const { enableRealtime = true, pollingIntervalMs = 2000, trackOverdue = true } = options;
  const [restaurantId, setRestaurantId] = React.useState("");
  const [restaurant, setRestaurant] = React.useState<Restaurant | null>(null);
  const [allOrders, setAllOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<OrderStatus | "all">("all");
  const [overdueOrderIds, setOverdueOrderIds] = React.useState<string[]>([]);
  const [newOrderIds, setNewOrderIds] = React.useState<string[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = React.useState("");
  const overdueEventGuard = React.useRef<Record<string, true>>({});
  const knownOrderIdsRef = React.useRef<Set<string>>(new Set());
  const initializedOrdersRef = React.useRef(false);
  const refreshInFlightRef = React.useRef<Promise<void> | null>(null);
  const restaurantRef = React.useRef<Restaurant | null>(null);

  React.useEffect(() => {
    restaurantRef.current = restaurant;
  }, [restaurant]);

  const refresh = React.useCallback(async (options?: { silent?: boolean }) => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    if (!options?.silent) setLoading(true);
    if (!options?.silent) setError("");
    const pending = (async () => {
      try {
        const activeRestaurantId = await getActiveRestaurantId();
        setRestaurantId(activeRestaurantId);
        const currentRestaurant = restaurantRef.current;
        const shouldLoadRestaurant = !options?.silent || !currentRestaurant;
        const [restaurantData, ordersData] = await Promise.all([
          shouldLoadRestaurant ? getDashboardRestaurant(activeRestaurantId) : Promise.resolve(currentRestaurant),
          getOrders(activeRestaurantId),
        ]);
        if (restaurantData) setRestaurant(restaurantData);
        setAllOrders(ordersData);
        setLastSyncedAt(new Date().toISOString());
        platformStore.setSessionContext({
          restaurantId: activeRestaurantId,
          role: getPrimaryDashboardRole() || "manager",
        });
        for (const order of ordersData) {
          platformStore.upsertOrderStatus(order.id, order.status);
        }

        const nextIds = new Set(ordersData.map((order) => order.id));
        if (initializedOrdersRef.current && options?.silent) {
          const unseen = ordersData
            .filter((order) => !knownOrderIdsRef.current.has(order.id))
            .map((order) => order.id);
          if (unseen.length) {
            setNewOrderIds((current) => [...new Set([...unseen, ...current])]);
          }
        }
        knownOrderIdsRef.current = nextIds;
        initializedOrdersRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders.");
        if (!options?.silent) {
          setRestaurant(null);
          setAllOrders([]);
        }
      } finally {
        if (!options?.silent) setLoading(false);
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = pending;
    return pending;
  }, []);

  const acknowledgeNewOrders = React.useCallback(() => {
    setNewOrderIds([]);
  }, []);

  const updateStatus = React.useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (!restaurantId) return;
      setError("");
      try {
        await updateOrderStatusWorkflow({
          restaurantId,
          orderId,
          status,
          role: "manager",
        });
        const next = await getOrders(restaurantId);
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
    if (!restaurantId) return () => undefined;

    const unsubscribeRealtimeEvents = enableRealtime
      ? subscribeOrderRealtimeEvents(() => {
          void refresh({ silent: true });
        }, { restaurantId })
      : () => undefined;

    // Fallback short polling keeps remote changes fresh where push events are unavailable.
    const timer =
      pollingIntervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState !== "visible") return;
            void refresh({ silent: true });
          }, pollingIntervalMs)
        : null;

    const onVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      void refresh({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    let unsubscribeSupabase: (() => void) | null = null;
    if (enableRealtime && isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`orders-live-${restaurantId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => {
            void refresh({ silent: true });
          }
        )
        .subscribe();

      unsubscribeSupabase = () => {
        void supabase.removeChannel(channel);
      };
    }

    return () => {
      unsubscribeRealtimeEvents();
      if (timer != null) window.clearInterval(timer);
      if (unsubscribeSupabase) unsubscribeSupabase();
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [enableRealtime, pollingIntervalMs, refresh, restaurantId]);

  React.useEffect(() => {
    if (!trackOverdue || !restaurantId || !allOrders.length) {
      setOverdueOrderIds([]);
      return;
    }
    let mounted = true;
    void getAutomationSettings(getCurrentBranchId())
      .then(async (settings) => {
        if (!mounted) return;
        const overdueIds: string[] = [];
        for (const order of allOrders) {
          const result = getOrderOverdueState({
            createdAt: order.createdAt,
            status: order.status,
            overdueThresholdMinutes: settings.overdue_threshold_minutes,
          });
          if (!result.overdue) continue;
          overdueIds.push(order.id);
          const key = `${order.id}:${String(order.status).toLowerCase()}`;
          if (overdueEventGuard.current[key]) continue;
          overdueEventGuard.current[key] = true;
          await emitAutomationEvent({
            type: "ORDER_OVERDUE",
            context: {
              restaurantId,
              branchId: getCurrentBranchId(),
              role: getPrimaryDashboardRole() || "manager",
              order: {
                id: order.id,
                createdAt: order.createdAt,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                tableNumber: order.tableNumber,
                customerNotes: order.customerNotes,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                paymentReference: order.paymentReference,
                subtotal: order.subtotal,
                total: order.total,
                status: order.status,
                items: order.items.map((item) => ({
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                })),
              },
              metadata: { elapsedMinutes: result.elapsedMinutes },
            },
          });
        }
        setOverdueOrderIds(overdueIds);
      })
      .catch(() => {
        if (!mounted) return;
        setOverdueOrderIds([]);
      });
    return () => {
      mounted = false;
    };
  }, [allOrders, restaurantId, trackOverdue]);

  const orders = React.useMemo(() => {
    if (statusFilter === "all") return allOrders;
    return allOrders.filter((order) => order.status === statusFilter);
  }, [allOrders, statusFilter]);

  return {
    restaurantId,
    restaurant,
    allOrders,
    orders,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refresh,
    updateStatus,
    overdueOrderIds,
    newOrderIds,
    hasNewOrders: newOrderIds.length > 0,
    acknowledgeNewOrders,
    lastSyncedAt,
  };
}
