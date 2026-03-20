import * as React from "react";
import { Clock3, Printer } from "lucide-react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ActionBar,
  ContentGrid,
  DashboardPanel,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
  StatusBadge,
} from "../components/dashboard/dashboard-primitives";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useRestaurantOrders } from "../hooks/use-restaurant-orders";
import { printKitchenTicket } from "../lib/print";
import { canCurrentUser } from "../lib/roles";
import type { PrintOrder } from "../lib/print";
import type { Order, OrderStatus } from "../types/dashboard";
import type { RestaurantProfile } from "../lib/restaurant";

const KITCHEN_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "ready"];

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function toKitchenPrintOrder(order: Order, restaurantName: string): PrintOrder {
  return {
    id: order.id,
    restaurant: {
      name: restaurantName,
      footerText: "Powered by Ubhona",
    },
    customerName: order.customerName || "Guest",
    customerPhone: order.customerPhone || undefined,
    takenByWaiterName: order.takenByWaiterName || undefined,
    tableNumber: order.tableNumber || undefined,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      notes: order.customerNotes || undefined,
    })),
    subtotal: order.subtotal,
    total: order.total,
    notes: order.customerNotes || undefined,
  };
}

function getNextKitchenStatus(status: OrderStatus): OrderStatus {
  if (status === "pending") return "confirmed";
  if (status === "confirmed") return "preparing";
  if (status === "preparing") return "ready";
  return "ready";
}

export default function KitchenDeskPage() {
  const { restaurant, orders, loading, error, refresh, updateStatus } = useRestaurantOrders();
  const [submittingOrderId, setSubmittingOrderId] = React.useState("");
  const canPrintKitchen = canCurrentUser("printKitchenTicket");
  const autoPrintedRef = React.useRef<Record<string, true>>({});

  const profile = React.useMemo<RestaurantProfile | null>(() => {
    if (!restaurant) return null;
    return {
      id: restaurant.id,
      restaurantName: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      email: restaurant.email,
      location: restaurant.location,
      logo: restaurant.logoUrl,
      coverImage: restaurant.coverImageUrl,
      themePrimary: restaurant.primaryColor || "#E4572E",
      themeSecondary: "#E8D8C3",
      shortDescription: restaurant.description,
      subscriptionPlan: restaurant.subscriptionPlan || "starter",
      subscriptionStatus: restaurant.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [restaurant]);

  const kitchenOrders = React.useMemo(() => {
    return orders
      .filter((order) => KITCHEN_STATUSES.includes(order.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [orders]);

  const onSetStatus = async (orderId: string, status: OrderStatus) => {
    setSubmittingOrderId(orderId);
    try {
      await updateStatus(orderId, status);
    } finally {
      setSubmittingOrderId("");
    }
  };

  const onPrintKitchen = (order: Order) => {
    void printKitchenTicket(toKitchenPrintOrder(order, restaurant?.name || "Ubhona Restaurant"));
  };

  React.useEffect(() => {
    if (!restaurant || !canPrintKitchen) return;
    const pendingOrders = kitchenOrders.filter((order) => order.status === "pending");
    for (const order of pendingOrders) {
      if (autoPrintedRef.current[order.id]) continue;
      autoPrintedRef.current[order.id] = true;
      void printKitchenTicket(toKitchenPrintOrder(order, restaurant.name), { trigger: "auto" });
    }
  }, [kitchenOrders, restaurant, canPrintKitchen]);

  return (
    <DashboardLayout
      profile={profile}
      title="Kitchen"
      subtitle="Preparation queue for incoming orders and ticket progress."
      actions={
        <Button size="sm" variant="secondary" onClick={() => void refresh()}>
          Refresh
        </Button>
      }
    >
      <PageContainer>
      <DashboardPanel>
        <SectionHeader
          title="Kitchen Queue"
          subtitle="Tickets in active preparation flow: pending, confirmed, preparing, and ready."
        />
        <ActionBar className="mb-0">
          <div className="flex flex-wrap gap-2">
            {KITCHEN_STATUSES.map((status) => (
              <Badge key={status} variant="neutral" className="capitalize">
                {status}
              </Badge>
            ))}
          </div>
          <div className="text-xs text-white/60">
            Showing {kitchenOrders.length} active {kitchenOrders.length === 1 ? "ticket" : "tickets"}
          </div>
        </ActionBar>
      </DashboardPanel>

      {loading ? (
        <DashboardPanel>
          <div className="space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-56 animate-pulse rounded bg-white/10" />
          </div>
        </DashboardPanel>
      ) : null}

      {error ? <EmptyStateCard message={error} /> : null}

      {!loading && !error && !kitchenOrders.length ? (
        <DashboardPanel>
          <EmptyStateCard message="No active kitchen tickets right now." />
        </DashboardPanel>
      ) : null}

      {!loading && !error && kitchenOrders.length ? (
        <ContentGrid columns="three">
          {kitchenOrders.map((order) => {
            const nextStatus = getNextKitchenStatus(order.status);
            const processing = submittingOrderId === order.id;
            return (
              <article key={order.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-white/70">{order.id}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-[#E8D8C3]/85">
                      <Clock3 className="h-3 w-3" />
                      {new Date(order.createdAt).toLocaleTimeString("en-KE")}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
                  <div className="text-sm font-semibold text-[#FBF6EE]">
                    {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || "Guest"}
                  </div>
                  <div className="text-xs text-white/60">
                    {order.customerName || "Guest"}
                    {order.customerPhone ? ` | ${order.customerPhone}` : ""}
                    {order.takenByWaiterName ? ` | ${order.takenByWaiterName}` : ""}
                  </div>
                  {order.customerNotes ? (
                    <div className="mt-1 text-xs text-amber-200/85">Notes: {order.customerNotes}</div>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  {order.items.map((item) => (
                    <div key={`${order.id}-${item.dishId}`} className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-base font-black text-[#FBF6EE]">{item.name}</div>
                        <div className="rounded-md bg-[#E4572E]/20 px-2 py-0.5 text-sm font-black text-orange-200">
                          x{item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <ActionBar className="mt-3 mb-0">
                  <div className="text-xs text-white/65">{formatKsh(order.total)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {canPrintKitchen ? (
                      <Button size="sm" variant="outline" onClick={() => onPrintKitchen(order)}>
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </Button>
                    ) : null}
                    {KITCHEN_STATUSES.map((status) => (
                      <Button
                        key={`${order.id}-${status}`}
                        size="sm"
                        variant={order.status === status ? "primary" : "secondary"}
                        className="capitalize"
                        disabled={processing}
                        onClick={() => void onSetStatus(order.id, status)}
                      >
                        {status}
                      </Button>
                    ))}
                    {order.status !== "ready" ? (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={processing}
                        onClick={() => void onSetStatus(order.id, nextStatus)}
                      >
                        Mark {nextStatus}
                      </Button>
                    ) : null}
                  </div>
                </ActionBar>
              </article>
            );
          })}
        </ContentGrid>
      ) : null}
      </PageContainer>
    </DashboardLayout>
  );
}
