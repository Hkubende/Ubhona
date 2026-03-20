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
import type { OrderStatus } from "../types/dashboard";
import type { RestaurantProfile } from "../lib/restaurant";
import type { Order } from "../types/dashboard";
import type { PrintOrder } from "../lib/print";
import {
  printCustomerReceipt,
  printKitchenTicket,
  printPaymentReceipt,
} from "../lib/print";

const FILTER_OPTIONS: Array<OrderStatus | "all"> = [
  "all",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
];

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
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
      themePrimary: restaurant.primaryColor || "#E4572E",
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
        <Link
          to="/dashboard/orders/new"
          className={buttonVariants({ variant: "primary", size: "sm" })}
        >
          New Order
        </Link>
      }
    >
      <PageContainer>
      <DashboardPanel>
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

      <DashboardPanel>
        <SectionHeader title="Orders List" subtitle="Pending through completed orders for this restaurant." />
        {loading ? (
          <div className={spacing.stackSm}>
            <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/10" />
          </div>
        ) : null}
        {error ? <EmptyStateCard message={error} /> : null}
        {!loading && !error && orders.length ? (
          <DataTable>
            <table className="min-w-full text-sm">
              <thead className={tokens.classes.tableHeader}>
                <tr>
                  <th className="px-3 py-2.5">Reference</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Taken By</th>
                  <th className="px-3 py-2.5">Items</th>
                  <th className="px-3 py-2.5">Total</th>
                  <th className="px-3 py-2.5">Created</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Next Step</th>
                  <th className="px-3 py-2.5">Print</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={tokens.classes.tableRow}>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs text-text-secondary/85">{order.id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-text-primary">{order.customerName || "Guest"}</div>
                      <div className="text-xs text-text-secondary/68">{order.customerPhone || "No phone"}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs text-text-secondary/82">{order.takenByWaiterName || "-"}</div>
                      <Badge variant="neutral" className="mt-1 capitalize text-[10px]">{order.source || "customer"}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs text-text-secondary/88">
                        {order.items.length} {order.items.length === 1 ? "item" : "items"}
                      </div>
                      <div className="mt-1 text-[11px] text-text-secondary/62">
                        {order.items.slice(0, 2).map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                        {order.items.length > 2 ? ", ..." : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{formatKsh(order.total)}</td>
                    <td className="px-3 py-2.5 text-[11px] text-text-secondary/58">
                      {new Date(order.createdAt).toLocaleString("en-KE")}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {STATUS_FLOW[order.status] ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => void updateStatus(order.id, STATUS_FLOW[order.status] as OrderStatus)}
                            className="h-7 rounded-lg px-2 py-1 text-[11px] capitalize"
                          >
                            Mark {STATUS_FLOW[order.status]}
                          </Button>
                        ) : (
                          <Badge variant="success">Completed</Badge>
                        )}
                        {FILTER_OPTIONS.filter((option): option is OrderStatus => option !== "all" && option !== order.status).map((status) => (
                          <Button
                            key={`${order.id}-${status}`}
                            size="sm"
                            variant="outline"
                            onClick={() => void updateStatus(order.id, status)}
                            className="h-7 rounded-lg px-2 py-1 text-[11px] capitalize"
                          >
                            {status}
                          </Button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <UbhonaActionMenu
                        items={[
                          {
                            key: "print-kitchen",
                            label: "Print Kitchen Ticket",
                            icon: <ClipboardList className="h-3.5 w-3.5" />,
                            onSelect: () => handleKitchenPrint(order),
                          },
                          {
                            key: "print-customer",
                            label: "Print Customer Receipt",
                            icon: <ReceiptText className="h-3.5 w-3.5" />,
                            onSelect: () => handleCustomerReceiptPrint(order),
                          },
                          {
                            key: "print-payment",
                            label: "Print Payment Receipt",
                            icon: <CheckCheck className="h-3.5 w-3.5" />,
                            onSelect: () => handlePaymentReceiptPrint(order),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}
        {!loading && !error && !orders.length ? (
          <EmptyStateCard
            message="No orders for this filter."
            actionLabel="Create New Order"
            onAction={() => navigate("/dashboard/orders/new")}
          />
        ) : null}
      </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}

