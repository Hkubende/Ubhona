import * as React from "react";
import { Clock3, Printer, Volume2, VolumeX } from "lucide-react";
import { DashboardLayout } from "../../components/dashboard/dashboard-layout";
import { NewOrderAlert } from "../../components/dashboard/new-order-alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { UbhonaLoader } from "../../components/ui/ubhona-loader";
import { EmptyStateCard, PageContainer, SectionHeader } from "../../components/dashboard/dashboard-primitives";
import { useRestaurantOrders } from "../../hooks/use-restaurant-orders";
import { getSharedStatusLabel, normalizeOrderStatus } from "../../lib/order-status";
import { printKitchenTicket } from "../../lib/print";
import { canPerformAction } from "../../lib/roles";
import type { PrintOrder } from "../../lib/print";
import type { RestaurantProfile } from "../../lib/restaurant";
import type { Order, OrderStatus } from "../../types/dashboard";
import { cn } from "../../lib/utils";

type KitchenColumnId = "pending" | "preparing" | "ready";

function minutesElapsed(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function formatElapsed(createdAt: string) {
  const mins = minutesElapsed(createdAt);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

function formatCreatedTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
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
      dishId: item.dishId,
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

function mapOrderToColumn(order: Order): KitchenColumnId | null {
  const status = normalizeOrderStatus(order.status);
  if (status === "placed" || status === "confirmed") return "pending";
  if (status === "preparing") return "preparing";
  if (status === "ready") return "ready";
  return null;
}

function nextActionsForOrder(status: string): Array<{ label: string; status: OrderStatus; variant: "primary" | "secondary" | "success" }> {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "placed") {
    return [
      { label: "Confirm", status: "confirmed", variant: "secondary" },
      { label: "Start Preparing", status: "preparing", variant: "primary" },
    ];
  }
  if (normalized === "confirmed") {
    return [{ label: "Start Preparing", status: "preparing", variant: "primary" }];
  }
  if (normalized === "preparing") {
    return [{ label: "Mark Ready", status: "ready", variant: "success" }];
  }
  if (normalized === "ready") {
    return [{ label: "Mark Completed", status: "completed", variant: "success" }];
  }
  return [];
}

function urgencyStyles(order: Order) {
  const elapsed = minutesElapsed(order.createdAt);
  if (elapsed >= 25) {
    return {
      ring: "border-red-400/35 bg-red-500/10",
      badge: "danger" as const,
      label: "Delayed",
    };
  }
  if (elapsed >= 15) {
    return {
      ring: "border-primary/35 bg-primary/10",
      badge: "warning" as const,
      label: "Priority",
    };
  }
  return {
    ring: "border-white/10 bg-black/20",
    badge: "neutral" as const,
    label: "On Time",
  };
}

function KitchenTicketCard({
  order,
  processing,
  onSetStatus,
  onPrint,
  highlighted,
  canUpdateStatus,
  canPrint,
}: {
  order: Order;
  processing: boolean;
  onSetStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onPrint: (order: Order) => void;
  highlighted?: boolean;
  canUpdateStatus: boolean;
  canPrint: boolean;
}) {
  const actions = nextActionsForOrder(order.status);
  const urgency = urgencyStyles(order);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const status = normalizeOrderStatus(order.status);

  return (
    <article
      className={cn(
        "rounded-2xl border p-3.5 shadow-[0_14px_24px_rgba(0,0,0,0.28)] transition-colors",
        urgency.ring,
        highlighted && "border-primary/45 shadow-[0_0_0_1px_rgba(255,106,26,0.28),0_20px_32px_rgba(0,0,0,0.4)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-text-secondary/85">{order.id}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary/72">
            <Clock3 className="h-3 w-3" />
            Placed {formatCreatedTime(order.createdAt)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant={
              status === "ready"
                ? "success"
                : status === "preparing"
                  ? "accent"
                  : status === "confirmed"
                    ? "neutral"
                    : "warning"
            }
          >
            {getSharedStatusLabel(order.status)}
          </Badge>
          <Badge variant={urgency.badge}>{urgency.label}</Badge>
          <span className="text-xs font-semibold text-text-primary">{formatElapsed(order.createdAt)}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
        <div className="text-sm font-semibold text-text-primary">
          {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || "Walk-in Guest"}
        </div>
        <div className="text-xs text-text-secondary/75">
          {itemCount} items
          {order.takenByWaiterName ? ` • ${order.takenByWaiterName}` : ""}
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {order.items.map((item) => (
          <div key={`${order.id}-${item.dishId}`} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
            <div className="text-sm font-medium text-text-primary">
              <span className="mr-1.5 text-primary">{item.quantity}x</span>
              {item.name}
            </div>
            <span className="text-xs text-text-secondary/72">KSh {item.totalPrice.toLocaleString("en-KE")}</span>
          </div>
        ))}
      </div>

      {order.customerNotes ? (
        <div className="mt-2.5 rounded-lg border border-primary/28 bg-primary/8 px-2.5 py-2 text-xs text-text-secondary/92">
          Note: {order.customerNotes}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={`${order.id}-${action.status}`}
            size="sm"
            variant={action.variant}
            disabled={processing || !canUpdateStatus}
            onClick={() => void onSetStatus(order.id, action.status)}
          >
            {action.label}
          </Button>
        ))}
        {canPrint ? (
          <Button size="sm" variant="outline" disabled={processing} onClick={() => onPrint(order)}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function KitchenDisplayPage() {
  const {
    restaurant,
    orders,
    loading,
    error,
    refresh,
    updateStatus,
    newOrderIds,
    acknowledgeNewOrders,
    lastSyncedAt,
  } = useRestaurantOrders();
  const [submittingOrderId, setSubmittingOrderId] = React.useState("");
  const [soundEnabled, setSoundEnabled] = React.useState(false);
  const [highlightedIds, setHighlightedIds] = React.useState<Record<string, true>>({});
  const knownIdsRef = React.useRef<Set<string>>(new Set());
  const canUpdateKitchenStatus = canPerformAction("update_kitchen_status");
  const canPrintTicket = canPerformAction("print_ticket");

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
      themePrimary: restaurant.primaryColor || "#FF6A1A",
      themeSecondary: "#2EE6A6",
      shortDescription: restaurant.description,
      subscriptionPlan: restaurant.subscriptionPlan || "starter",
      subscriptionStatus: restaurant.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [restaurant]);

  const columns = React.useMemo(() => {
    const next: Record<KitchenColumnId, Order[]> = {
      pending: [],
      preparing: [],
      ready: [],
    };
    for (const order of orders) {
      const column = mapOrderToColumn(order);
      if (!column) continue;
      next[column].push(order);
    }
    for (const key of Object.keys(next) as KitchenColumnId[]) {
      next[key].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return next;
  }, [orders]);

  const onSetStatus = React.useCallback(
    async (orderId: string, status: OrderStatus) => {
      setSubmittingOrderId(orderId);
      try {
        await updateStatus(orderId, status);
      } finally {
        setSubmittingOrderId("");
      }
    },
    [updateStatus]
  );

  const onPrint = React.useCallback(
    (order: Order) => {
      void printKitchenTicket(toKitchenPrintOrder(order, restaurant?.name || "Ubhona Restaurant"));
    },
    [restaurant?.name]
  );

  React.useEffect(() => {
    if (!orders.length) return;
    const nextHighlights: Record<string, true> = {};
    for (const order of orders) {
      const isActive = mapOrderToColumn(order) === "pending";
      if (!isActive) continue;
      if (!knownIdsRef.current.has(order.id)) {
        nextHighlights[order.id] = true;
      }
      knownIdsRef.current.add(order.id);
    }
    if (!Object.keys(nextHighlights).length) return;
    setHighlightedIds((current) => ({ ...current, ...nextHighlights }));
    if (soundEnabled) {
      try {
        const audio = new Audio("/notification.mp3");
        void audio.play();
      } catch {
        // Sound is optional and should fail silently.
      }
    }
    const timeout = window.setTimeout(() => {
      setHighlightedIds({});
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [orders, soundEnabled]);

  return (
    <DashboardLayout
      profile={profile}
      title="Kitchen Display"
      subtitle="Live prep board for new, preparing, and ready tickets."
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSoundEnabled((current) => !current)}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            New Order Sound
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      }
    >
      <PageContainer className="space-y-4">
        <NewOrderAlert
          count={newOrderIds.length}
          lastSyncedAt={lastSyncedAt}
          onView={acknowledgeNewOrders}
          onDismiss={acknowledgeNewOrders}
        />
        <SectionHeader
          title="Kitchen Queue"
          subtitle="Tickets update live. Move tickets across states to keep service moving."
          action={
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="warning">Pending / New {columns.pending.length}</Badge>
              <Badge variant="accent">Preparing {columns.preparing.length}</Badge>
              <Badge variant="success">Ready {columns.ready.length}</Badge>
            </div>
          }
        />

        {loading ? <UbhonaLoader variant="inline" label="Loading kitchen tickets" /> : null}
        {error ? <EmptyStateCard message={error} /> : null}

        {!loading && !error ? (
          <section className="grid gap-4 xl:grid-cols-3">
            {([
              { id: "pending", title: "Pending / New", subtitle: "Confirm or send to prep", tone: "warning" as const },
              { id: "preparing", title: "Preparing", subtitle: "Work in progress", tone: "accent" as const },
              { id: "ready", title: "Ready", subtitle: "Ready to serve", tone: "success" as const },
            ] as Array<{ id: KitchenColumnId; title: string; subtitle: string; tone: "warning" | "accent" | "success" }>).map((column) => {
              const rows = columns[column.id];
              return (
                <div key={column.id} className="rounded-3xl border border-white/10 bg-[#0D0B0B]/92 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold tracking-[-0.02em] text-text-primary">{column.title}</h3>
                      <p className="text-xs text-text-secondary/72">{column.subtitle}</p>
                    </div>
                    <Badge variant={column.tone}>{rows.length}</Badge>
                  </div>
                  <div className="space-y-2.5">
                    {rows.length ? (
                      rows.map((order) => (
                        <KitchenTicketCard
                          key={order.id}
                          order={order}
                          processing={submittingOrderId === order.id}
                          onSetStatus={onSetStatus}
                          onPrint={onPrint}
                          highlighted={Boolean(highlightedIds[order.id])}
                          canUpdateStatus={canUpdateKitchenStatus}
                          canPrint={canPrintTicket}
                        />
                      ))
                    ) : (
                      <EmptyStateCard message={`No ${column.title.toLowerCase()} tickets.`} />
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}
      </PageContainer>
    </DashboardLayout>
  );
}
