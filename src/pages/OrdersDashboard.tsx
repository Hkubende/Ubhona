import * as React from "react";
import { CheckCheck, ClipboardList, ReceiptText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  DataTable,
  PageContainer,
  DashboardPanel,
  EmptyStateCard,
  SectionHeader,
  StatusBadge,
} from "../components/dashboard/dashboard-primitives";
import { Badge } from "../components/ui/Badge";
import { Button, buttonVariants } from "../components/ui/Button";
import { UbhonaActionMenu } from "../components/ui/ubhona-action-menu";
import { useRestaurantOrders } from "../hooks/use-restaurant-orders";
import { spacing, tokens } from "../design-system";
import { cn } from "../lib/utils";
import type { OrderStatus } from "../types/dashboard";
import type { RestaurantProfile } from "../lib/restaurant";
import type { Order } from "../types/dashboard";
import type { PrintOrder } from "../lib/print";
import { canCurrentUser, canPerformAction } from "../lib/roles";
import { getOrderHistory, type ActivityItem } from "../lib/activity";
import {
  printCustomerReceipt,
  printKitchenTicket,
  printPaymentReceipt,
} from "../lib/print";
import { ActivityFeed } from "../components/dashboard/activity-feed";

const FILTER_OPTIONS: Array<OrderStatus | "all"> = [
  "all",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
};

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function toPrintOrder(order: Order, restaurantName: string): PrintOrder {
  return {
    id: order.id,
    restaurant: {
      name: restaurantName,
      footerText: "Powered by Ubhona",
    },
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    takenByWaiterName: order.takenByWaiterName,
    tableNumber: order.tableNumber,
    notes: order.customerNotes,
    items: order.items.map((item) => ({
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
    subtotal: order.subtotal,
    total: order.total,
    payment: {
      status: order.paymentStatus || "pending",
      method: order.paymentMethod || "manual_mpesa",
      transactionId: order.transactionId || order.paymentReference,
      paidAmount: order.paymentStatus === "paid" ? order.total : undefined,
    },
  };
}

export default function OrdersDashboard() {
  const navigate = useNavigate();
  const {
    restaurant,
    orders,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    updateStatus,
  } = useRestaurantOrders();

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
      themeSecondary: "#34d399",
      shortDescription: restaurant.description,
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [restaurant]);

  const restaurantName = restaurant?.name || "Ubhona Restaurant";
  const canCreateOrder = canPerformAction("create_order");
  const canUpdateOrders = canPerformAction("update_service_order_status");
  const canPrintKitchen = canCurrentUser("printKitchenTicket");
  const canPrintCustomer = canCurrentUser("printCustomerReceipt");
  const canPrintPayment = canCurrentUser("printPaymentReceipt");
  const [selectedOrderId, setSelectedOrderId] = React.useState("");
  const [orderHistory, setOrderHistory] = React.useState<ActivityItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const insights = React.useMemo(() => {
    const pending = orders.filter((order) => ["pending", "confirmed", "preparing"].includes(order.status)).length;
    const ready = orders.filter((order) => order.status === "ready").length;
    const completed = orders.filter((order) => order.status === "completed").length;
    const cancelled = orders.filter((order) => order.status === "cancelled").length;
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    return { pending, ready, completed, cancelled, revenue };
  }, [orders]);

  React.useEffect(() => {
    if (!orders.length) {
      setSelectedOrderId("");
      setOrderHistory([]);
      return;
    }
    if (!selectedOrderId || !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  React.useEffect(() => {
    if (!selectedOrderId) {
      setOrderHistory([]);
      return;
    }
    let mounted = true;
    setHistoryLoading(true);
    void getOrderHistory(selectedOrderId, 20)
      .then((rows) => {
        if (mounted) setOrderHistory(rows);
      })
      .catch(() => {
        if (mounted) setOrderHistory([]);
      })
      .finally(() => {
        if (mounted) setHistoryLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedOrderId]);

  const handleKitchenPrint = React.useCallback(
    (order: Order) => {
      void printKitchenTicket(toPrintOrder(order, restaurantName));
    },
    [restaurantName]
  );

  const handleCustomerReceiptPrint = React.useCallback(
    (order: Order) => {
      void printCustomerReceipt(toPrintOrder(order, restaurantName));
    },
    [restaurantName]
  );

  const handlePaymentReceiptPrint = React.useCallback(
    (order: Order) => {
      void printPaymentReceipt(toPrintOrder(order, restaurantName));
    },
    [restaurantName]
  );

  return (
    <DashboardLayout
      profile={profile}
      title="Orders"
      subtitle="Track incoming orders and update fulfillment statuses."
      actions={
        canCreateOrder ? (
          <Link
            to="/dashboard/orders/new"
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            New Order
          </Link>
        ) : null
      }
    >
      <PageContainer>
      <DashboardPanel className="space-y-3">
        <SectionHeader title="Order Filters" subtitle="Filter by fulfillment stage." />
        <div className={`flex flex-wrap ${spacing.gapSm}`}>
          {FILTER_OPTIONS.map((status) => {
            const active = statusFilter === status;
            return (
              <Button
                key={status}
                size="sm"
                variant={active ? "primary" : "secondary"}
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            );
          })}
        </div>
      </DashboardPanel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(250px,0.9fr)]">
      <DashboardPanel className="space-y-4">
        <SectionHeader title="Orders List" subtitle="Operational queue optimized for quick scanning and status updates." />
        {loading ? (
          <div className={spacing.stackSm}>
            <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/10" />
          </div>
        ) : null}
        {error ? <EmptyStateCard message={error} /> : null}
        {!loading && !error && orders.length ? (
          <>
            <div className="space-y-2.5 md:hidden">
              {orders.map((order) => (
                <div key={order.id} className={cn(tokens.classes.panelInset, "space-y-2.5 p-3.5")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] text-text-secondary/82">{order.id}</div>
                      <div className="mt-1 font-semibold text-text-primary">{order.customerName || "Guest"}</div>
                      <div className="text-xs text-text-secondary/65">{order.customerPhone || "No phone"}</div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="text-xs text-text-secondary/78">
                    {order.items.length} {order.items.length === 1 ? "item" : "items"} - {formatKsh(order.total)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_FLOW[order.status] ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void updateStatus(order.id, STATUS_FLOW[order.status] as OrderStatus)}
                        className="h-7 rounded-lg px-2.5 py-1 text-[11px] capitalize"
                        disabled={!canUpdateOrders}
                      >
                        Mark {STATUS_FLOW[order.status]}
                      </Button>
                    ) : (
                      <Badge variant="success">Completed</Badge>
                    )}
                    <UbhonaActionMenu
                      items={[
                        {
                          key: "view-history",
                          label: "View History",
                          onSelect: () => setSelectedOrderId(order.id),
                        },
                        ...FILTER_OPTIONS.filter(
                          (option): option is OrderStatus => option !== "all" && option !== order.status
                        ).map((status) => ({
                          key: `set-${status}`,
                          label: `Set ${status}`,
                          onSelect: () => void updateStatus(order.id, status),
                          disabled: !canUpdateOrders,
                        })),
                        ...(canPrintKitchen ? [{
                          key: "print-kitchen",
                          label: "Print Kitchen Ticket",
                          icon: <ClipboardList className="h-3.5 w-3.5" />,
                          onSelect: () => handleKitchenPrint(order),
                        }] : []),
                        ...(canPrintCustomer ? [{
                          key: "print-customer",
                          label: "Print Customer Receipt",
                          icon: <ReceiptText className="h-3.5 w-3.5" />,
                          onSelect: () => handleCustomerReceiptPrint(order),
                        }] : []),
                        ...(canPrintPayment ? [{
                          key: "print-payment",
                          label: "Print Payment Receipt",
                          icon: <CheckCheck className="h-3.5 w-3.5" />,
                          onSelect: () => handlePaymentReceiptPrint(order),
                        }] : []),
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>

            <DataTable className="hidden md:block">
              <table className="min-w-full text-sm">
                <thead className={tokens.classes.tableHeader}>
                  <tr>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Items</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className={tokens.classes.tableRow}>
                      <td className="px-3 py-2">
                        <div className="font-mono text-[11px] text-text-secondary/85">{order.id}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold tracking-[-0.01em] text-text-primary">{order.customerName || "Guest"}</div>
                        <div className="text-xs text-text-secondary/72">{order.customerPhone || "No phone"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs text-text-secondary/88">
                          {order.items.length} {order.items.length === 1 ? "item" : "items"}
                        </div>
                        <div className="mt-1 line-clamp-1 text-[11px] text-text-secondary/68">
                          {order.items.slice(0, 2).map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                          {order.items.length > 2 ? ", ..." : ""}
                        </div>
                        {(order.takenByWaiterName || order.source) ? (
                          <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-text-secondary/52">
                            {order.takenByWaiterName ? `By ${order.takenByWaiterName}` : ""}
                            {order.takenByWaiterName && order.source ? " - " : ""}
                            {order.source || ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-text-primary">{formatKsh(order.total)}</td>
                      <td className="px-3 py-2 text-[11px] text-text-secondary/62">
                        {new Date(order.createdAt).toLocaleString("en-KE")}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {STATUS_FLOW[order.status] ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => void updateStatus(order.id, STATUS_FLOW[order.status] as OrderStatus)}
                              className="h-7 rounded-lg px-2.5 py-1 text-[11px] capitalize"
                              disabled={!canUpdateOrders}
                            >
                              Mark {STATUS_FLOW[order.status]}
                            </Button>
                          ) : (
                            <Badge variant="success" className="h-7">Completed</Badge>
                          )}
                          <UbhonaActionMenu
                            items={[
                              {
                                key: "view-history",
                                label: "View History",
                                onSelect: () => setSelectedOrderId(order.id),
                              },
                              ...FILTER_OPTIONS.filter(
                                (option): option is OrderStatus => option !== "all" && option !== order.status
                              ).map((status) => ({
                                key: `set-${status}`,
                                label: `Set ${status}`,
                                onSelect: () => void updateStatus(order.id, status),
                                disabled: !canUpdateOrders,
                              })),
                              ...(canPrintKitchen ? [{
                                key: "print-kitchen",
                                label: "Print Kitchen Ticket",
                                icon: <ClipboardList className="h-3.5 w-3.5" />,
                                onSelect: () => handleKitchenPrint(order),
                              }] : []),
                              ...(canPrintCustomer ? [{
                                key: "print-customer",
                                label: "Print Customer Receipt",
                                icon: <ReceiptText className="h-3.5 w-3.5" />,
                                onSelect: () => handleCustomerReceiptPrint(order),
                              }] : []),
                              ...(canPrintPayment ? [{
                                key: "print-payment",
                                label: "Print Payment Receipt",
                                icon: <CheckCheck className="h-3.5 w-3.5" />,
                                onSelect: () => handlePaymentReceiptPrint(order),
                              }] : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </>
        ) : null}
        {!loading && !error && !orders.length ? (
          <EmptyStateCard
            message="No orders for this filter."
            actionLabel="Create New Order"
            onAction={() => navigate("/dashboard/orders/new")}
          />
        ) : null}
      </DashboardPanel>

      <DashboardPanel className="space-y-3">
        <SectionHeader title="Queue Insights" subtitle="Small operational snapshot for shift decisions." />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <div className={cn(tokens.classes.panelInset, "flex items-center justify-between px-3 py-2")}>
            <span className="text-sm text-text-secondary/78">Active Queue</span>
            <span className="text-sm font-semibold text-text-primary">{insights.pending}</span>
          </div>
          <div className={cn(tokens.classes.panelInset, "flex items-center justify-between px-3 py-2")}>
            <span className="text-sm text-text-secondary/78">Ready Pickup</span>
            <span className="text-sm font-semibold text-[#F2BA8E]">{insights.ready}</span>
          </div>
          <div className={cn(tokens.classes.panelInset, "flex items-center justify-between px-3 py-2")}>
            <span className="text-sm text-text-secondary/78">Completed</span>
            <span className="text-sm font-semibold text-success">{insights.completed}</span>
          </div>
          <div className={cn(tokens.classes.panelInset, "flex items-center justify-between px-3 py-2")}>
            <span className="text-sm text-text-secondary/78">Cancelled</span>
            <span className="text-sm font-semibold text-red-300">{insights.cancelled}</span>
          </div>
          <div className={cn(tokens.classes.panelInset, "flex items-center justify-between px-3 py-2 sm:col-span-2 xl:col-span-1")}>
            <span className="text-sm text-text-secondary/78">Gross Value</span>
            <span className="text-sm font-semibold text-text-primary">{formatKsh(insights.revenue)}</span>
          </div>
        </div>
      </DashboardPanel>
      </div>
      <ActivityFeed
        title="Order History"
        subtitle={
          selectedOrderId
            ? `Activity timeline for ${selectedOrderId}.`
            : "Select an order to view status and payment history."
        }
        items={orderHistory}
        loading={historyLoading}
        emptyMessage="No history entries recorded for this order yet."
      />
      </PageContainer>
    </DashboardLayout>
  );
}
