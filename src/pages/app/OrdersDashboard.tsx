import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  loadOrders,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from "../../lib/orders";
import { getRestaurantProfile } from "../../lib/restaurant";
import OrderCard from "../../components/orders/OrderCard";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.png`;

const FILTER_OPTIONS: Array<OrderStatus | "all"> = [
  "all",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
];

export default function OrdersDashboard() {
  const navigate = useNavigate();
  const restaurant = getRestaurantProfile();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<OrderStatus | "all">("all");
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);

  const refreshOrders = React.useCallback(async () => {
    if (!restaurant?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await loadOrders({
        restaurantId: restaurant.id,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [restaurant?.id, statusFilter]);

  React.useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshOrders();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [refreshOrders]);

  const applyStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, nextStatus);
      setNotice(`Order ${orderId} updated to ${nextStatus}.`);
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order status.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="Ubhona" className="h-11 w-11 rounded-2xl object-cover" />
            <div>
              <div className="text-xl font-black">
                Incoming <span className="text-orange-400">Orders</span>
              </div>
              <div className="text-xs text-white/60">{restaurant?.restaurantName || "Restaurant"} order stream</div>
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>

        <div className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-white/60">Filter</div>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    active
                      ? "border-orange-400/35 bg-orange-500/20 text-orange-200"
                      : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-white/60">Loading orders...</div>
          ) : null}
          {!loading && orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-white/55">
              No orders for this filter.
            </div>
          ) : null}
          {!loading &&
            orders.map((order) => {
              const expanded = expandedOrderId === order.id;
              return (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={expanded}
                  onToggleExpanded={() => setExpandedOrderId(expanded ? null : order.id)}
                  onSetStatus={(status) => {
                    void applyStatus(order.id, status);
                  }}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
}
