import * as React from "react";
import { CreditCard, ReceiptText } from "lucide-react";
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
import { Input } from "../components/ui/Input";
import { UbhonaSelect, UbhonaSelectItem } from "../components/ui/ubhona-select";
import { useRestaurantOrders } from "../hooks/use-restaurant-orders";
import { printPaymentReceipt } from "../lib/print";
import { setLocalStorefrontOrderPayment, type OrderPaymentMethod } from "../lib/orders";
import { canCurrentUser } from "../lib/roles";
import type { PrintOrder } from "../lib/print";
import type { Order } from "../types/dashboard";
import type { RestaurantProfile } from "../lib/restaurant";

type PaymentDraft = {
  method: OrderPaymentMethod;
  paymentStatus: string;
  transactionId: string;
};

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function toPaymentPrintOrder(order: Order, restaurantName: string): PrintOrder {
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
    })),
    subtotal: order.subtotal,
    total: order.total,
    notes: order.customerNotes || undefined,
    payment: {
      status: order.paymentStatus || "pending",
      method: order.paymentMethod || "manual_mpesa",
      transactionId: order.paymentReference || undefined,
      paidAmount: order.paymentStatus === "paid" ? order.total : undefined,
    },
  };
}

function getDefaultDraft(order: Order): PaymentDraft {
  return {
    method: order.paymentMethod || "manual_mpesa",
    paymentStatus: order.paymentStatus || "unpaid",
    transactionId: order.paymentReference || "",
  };
}

export default function CashierDeskPage() {
  const { restaurantId, restaurant, orders, loading, error, refresh, updateStatus } = useRestaurantOrders();
  const [drafts, setDrafts] = React.useState<Record<string, PaymentDraft>>({});
  const [submittingOrderId, setSubmittingOrderId] = React.useState("");
  const canPrintPayment = canCurrentUser("printPaymentReceipt");

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

  React.useEffect(() => {
    setDrafts((previous) => {
      const next: Record<string, PaymentDraft> = { ...previous };
      for (const order of orders) {
        if (!next[order.id]) {
          next[order.id] = getDefaultDraft(order);
        }
      }
      return next;
    });
  }, [orders]);

  const cashierOrders = React.useMemo(() => {
    return orders
      .filter((order) => order.status === "ready" || order.status === "confirmed" || order.status === "preparing")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [orders]);

  const onDraftChange = (orderId: string, patch: Partial<PaymentDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {
          method: "manual_mpesa",
          paymentStatus: "unpaid",
          transactionId: "",
        }),
        ...patch,
      },
    }));
  };

  const applyPayment = async (order: Order) => {
    if (!restaurantId) return;
    const draft = drafts[order.id] || getDefaultDraft(order);
    setSubmittingOrderId(order.id);
    try {
      setLocalStorefrontOrderPayment(order.id, restaurantId, {
        paymentMethod: draft.method,
        paymentStatus: draft.paymentStatus,
        paymentReference: draft.transactionId || order.paymentReference || order.id,
      });
      await refresh();
    } finally {
      setSubmittingOrderId("");
    }
  };

  const markPaidAndComplete = async (order: Order) => {
    if (!restaurantId) return;
    const draft = drafts[order.id] || getDefaultDraft(order);
    setSubmittingOrderId(order.id);
    try {
      setLocalStorefrontOrderPayment(order.id, restaurantId, {
        paymentMethod: draft.method,
        paymentStatus: "paid",
        paymentReference: draft.transactionId || order.paymentReference || order.id,
      });
      if (canPrintPayment) {
        const printOrder: Order = {
          ...order,
          paymentMethod: draft.method,
          paymentStatus: "paid",
          paymentReference: draft.transactionId || order.paymentReference || order.id,
        };
        void printPaymentReceipt(
          toPaymentPrintOrder(printOrder, restaurant?.name || "Ubhona Restaurant"),
          { trigger: "auto" }
        );
      }
      await updateStatus(order.id, "completed");
      await refresh();
    } finally {
      setSubmittingOrderId("");
    }
  };

  const printReceipt = (order: Order) => {
    void printPaymentReceipt(toPaymentPrintOrder(order, restaurant?.name || "Ubhona Restaurant"));
  };

  return (
    <DashboardLayout
      profile={profile}
      title="Cashier"
      subtitle="Receive payments, print receipts, and close completed orders."
      actions={
        <Button size="sm" variant="secondary" onClick={() => void refresh()}>
          Refresh
        </Button>
      }
    >
      <PageContainer>
      <DashboardPanel>
        <SectionHeader title="Cashier Queue" subtitle="Orders ready for payment handling and completion." />
        <ActionBar className="mb-0">
          <div className="flex items-center gap-2">
            <Badge variant="accent">Ready + Active Orders</Badge>
            <Badge variant="neutral">Restaurant Scoped</Badge>
          </div>
          <div className="text-xs text-white/60">
            {cashierOrders.length} order{cashierOrders.length === 1 ? "" : "s"}
          </div>
        </ActionBar>
      </DashboardPanel>

      {loading ? (
        <DashboardPanel>
          <div className="space-y-2">
            <div className="h-3 w-48 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-64 animate-pulse rounded bg-white/10" />
          </div>
        </DashboardPanel>
      ) : null}

      {error ? <EmptyStateCard message={error} /> : null}

      {!loading && !error && !cashierOrders.length ? (
        <DashboardPanel>
          <EmptyStateCard message="No active cashier orders. Waiting for ready tickets." />
        </DashboardPanel>
      ) : null}

      {!loading && !error && cashierOrders.length ? (
        <ContentGrid columns="two">
          {cashierOrders.map((order) => {
            const draft = drafts[order.id] || getDefaultDraft(order);
            const processing = submittingOrderId === order.id;
            return (
              <article key={order.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-white/70">{order.id}</div>
                    <div className="text-xs text-white/60">
                      {new Date(order.createdAt).toLocaleString("en-KE")}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
                  <div className="text-sm font-semibold text-[#FBF6EE]">
                    {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || "Guest"}
                  </div>
                  <div className="text-xs text-white/60">
                    {order.customerName || "Guest"}
                    {order.customerPhone ? ` | ${order.customerPhone}` : ""}
                  </div>
                </div>

                <div className="mb-3 space-y-1.5">
                  {order.items.map((item) => (
                    <div key={`${order.id}-${item.dishId}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm">
                      <span className="font-semibold text-[#FBF6EE]">{item.quantity}x {item.name}</span>
                      <span className="text-white/70">{formatKsh(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="mb-3 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-white/65">Payment</div>
                    <Badge variant={draft.paymentStatus === "paid" ? "success" : "warning"}>
                      {draft.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-white/70">
                      Method
                      <UbhonaSelect
                        id={`cashier-method-${order.id}`}
                        name={`cashierMethod-${order.id}`}
                        value={draft.method}
                        onValueChange={(value) =>
                          onDraftChange(order.id, { method: value as OrderPaymentMethod })
                        }
                        className="mt-1"
                      >
                        <UbhonaSelectItem value="manual_mpesa">Manual M-Pesa</UbhonaSelectItem>
                        <UbhonaSelectItem value="stk_push">STK Push</UbhonaSelectItem>
                      </UbhonaSelect>
                    </label>
                    <label className="text-xs text-white/70">
                      Status
                      <UbhonaSelect
                        id={`cashier-status-${order.id}`}
                        name={`cashierStatus-${order.id}`}
                        value={draft.paymentStatus}
                        onValueChange={(value) => onDraftChange(order.id, { paymentStatus: value })}
                        className="mt-1"
                      >
                        <UbhonaSelectItem value="unpaid">Unpaid</UbhonaSelectItem>
                        <UbhonaSelectItem value="pending">Pending</UbhonaSelectItem>
                        <UbhonaSelectItem value="paid">Paid</UbhonaSelectItem>
                      </UbhonaSelect>
                    </label>
                  </div>
                  <label className="mt-2 block text-xs text-white/70">
                    Transaction ID / Reference
                    <Input
                      id={`cashier-tx-${order.id}`}
                      name={`cashierTx-${order.id}`}
                      className="mt-1"
                      value={draft.transactionId}
                      onChange={(event) => onDraftChange(order.id, { transactionId: event.target.value })}
                      placeholder="e.g. QXE123ABC"
                    />
                  </label>
                </div>

                <ActionBar className="mb-0">
                  <div className="text-sm font-black text-orange-300">{formatKsh(order.total)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={processing}
                      onClick={() => void applyPayment(order)}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Save Payment
                    </Button>
                    {canPrintPayment ? (
                      <Button size="sm" variant="outline" onClick={() => printReceipt(order)}>
                        <ReceiptText className="h-3.5 w-3.5" />
                        Print Receipt
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={processing}
                      onClick={() => void markPaidAndComplete(order)}
                    >
                      Mark Completed
                    </Button>
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
