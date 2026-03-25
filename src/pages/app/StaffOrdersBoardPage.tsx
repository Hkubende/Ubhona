import * as React from "react";
import { CheckCheck, Eye, Search, SquareArrowOutUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/dashboard/dashboard-layout";
import { Badge } from "../../components/ui/Badge";
import { Button, buttonVariants } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { UbhonaActionMenu } from "../../components/ui/ubhona-action-menu";
import { DataTable, EmptyStateCard, PageContainer, SectionHeader, StatusBadge } from "../../components/dashboard/dashboard-primitives";
import { useRestaurantOrders } from "../../hooks/use-restaurant-orders";
import { getDishUrl } from "../../lib/qr";
import { normalizeOrderStatus } from "../../lib/order-status";
import { canPerformAction } from "../../lib/roles";
import type { RestaurantProfile } from "../../lib/restaurant";
import type { Order, OrderStatus } from "../../types/dashboard";
import { cn } from "../../lib/utils";

const FILTER_OPTIONS: Array<"all" | "placed" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled"> = [
  "all",
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

function formatCreated(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function mapNextStatus(order: Order): OrderStatus | null {
  const status = normalizeOrderStatus(order.status);
  if (status === "placed") return "confirmed";
  if (status === "confirmed") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return "completed";
  return null;
}

function paymentBadgeVariant(status: string | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "success" as const;
  if (normalized === "pending") return "warning" as const;
  return "neutral" as const;
}

export default function StaffOrdersBoardPage() {
  const { restaurant, orders, loading, error, refresh, updateStatus, overdueOrderIds } = useRestaurantOrders();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<(typeof FILTER_OPTIONS)[number]>("all");
  const [tableFilter, setTableFilter] = React.useState("all");
  const [submittingOrderId, setSubmittingOrderId] = React.useState("");
  const canUpdateServiceOrders = canPerformAction("update_service_order_status");

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

  const tableOptions = React.useMemo(() => {
    const values = new Set<string>();
    for (const order of orders) {
      if (order.tableNumber) values.add(order.tableNumber);
    }
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [orders]);

  const filtered = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders
      .filter((order) => {
        const shared = normalizeOrderStatus(order.status);
        if (statusFilter !== "all" && shared !== statusFilter) return false;
        if (tableFilter !== "all" && (order.tableNumber || "") !== tableFilter) return false;
        if (!normalizedQuery) return true;
        return [
          order.id,
          order.customerName,
          order.customerPhone,
          order.tableNumber,
          order.takenByWaiterName,
          ...order.items.map((item) => item.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, query, statusFilter, tableFilter]);

  const readyCount = React.useMemo(
    () => filtered.filter((order) => normalizeOrderStatus(order.status) === "ready").length,
    [filtered]
  );

  const onAdvanceStatus = React.useCallback(
    async (order: Order) => {
      const nextStatus = mapNextStatus(order);
      if (!nextStatus) return;
      setSubmittingOrderId(order.id);
      try {
        await updateStatus(order.id, nextStatus);
      } finally {
        setSubmittingOrderId("");
      }
    },
    [updateStatus]
  );

  return (
    <DashboardLayout
      profile={profile}
      title="Staff Order Board"
      subtitle="Live service board for front-of-house tracking and fulfillment."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="success">Ready to Serve {readyCount}</Badge>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      }
    >
      <PageContainer className="space-y-4">
        <section className="rounded-3xl border border-white/10 bg-[#0D0B0B]/92 p-4">
          <SectionHeader title="Live Controls" subtitle="Search by order, customer, table, or dish. Filter to focus active service states." />
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/65" />
              <Input
                id="staff-orders-search"
                name="staffOrdersSearch"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reference, customer, table, waiter, or dish"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_OPTIONS.map((option) => {
                const active = statusFilter === option;
                return (
                  <Button
                    key={option}
                    size="sm"
                    variant={active ? "primary" : "secondary"}
                    className="h-8 rounded-lg px-2.5 py-1 text-[11px] capitalize"
                    onClick={() => setStatusFilter(option)}
                  >
                    {option}
                  </Button>
                );
              })}
            </div>
            <select
              id="staff-orders-table-filter"
              name="staffOrdersTableFilter"
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
              className="min-h-10 rounded-xl border border-white/12 bg-black/25 px-3 text-sm text-text-primary"
            >
              {tableOptions.map((option) => (
                <option key={option} value={option} className="bg-[#0D0B0B] text-text-primary">
                  {option === "all" ? "All tables" : `Table ${option}`}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-text-secondary/72">Loading order board...</div>
        ) : null}
        {error ? <EmptyStateCard message={error} /> : null}

        {!loading && !error ? (
          <section className="rounded-3xl border border-white/10 bg-[#0D0B0B]/92 p-3.5">
            {!filtered.length ? (
              <EmptyStateCard message="No orders match current filters." />
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {filtered.map((order) => {
                    const nextStatus = mapNextStatus(order);
                    const isReady = normalizeOrderStatus(order.status) === "ready";
                    const isOverdue = overdueOrderIds.includes(order.id);
                    return (
                      <article
                        key={order.id}
                        className={cn(
                          "rounded-2xl border bg-black/25 p-3",
                          isReady ? "border-success/35 shadow-[0_0_0_1px_rgba(46,230,166,0.15)]" : "border-white/10",
                          isOverdue && "border-[#FF6A1A]/45 bg-[#FF6A1A]/[0.08]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-[11px] text-text-secondary/82">{order.id}</p>
                            <p className="mt-0.5 text-sm font-semibold text-text-primary">
                              {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || "Guest"}
                            </p>
                            <p className="text-xs text-text-secondary/72">{formatCreated(order.createdAt)}</p>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={paymentBadgeVariant(order.paymentStatus)}>
                            Payment: {order.paymentStatus || "unpaid"}
                          </Badge>
                          {isOverdue ? <Badge variant="warning">Overdue</Badge> : null}
                          <span className="text-xs text-text-secondary/75">{order.items.length} items</span>
                          <span className="text-xs font-semibold text-text-primary">{formatCurrency(order.total)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {nextStatus ? (
                            <Button
                              size="sm"
                              variant={isReady ? "success" : "primary"}
                              disabled={submittingOrderId === order.id || !canUpdateServiceOrders}
                              onClick={() => void onAdvanceStatus(order)}
                            >
                              {isReady ? "Mark Served" : `Mark ${nextStatus}`}
                            </Button>
                          ) : null}
                          <UbhonaActionMenu
                            items={[
                              {
                                key: "open-order",
                                label: "Open Order Tracking",
                                icon: <Eye className="h-3.5 w-3.5" />,
                                onSelect: () => {
                                  window.open(`/order/${encodeURIComponent(order.id)}`, "_blank", "noopener,noreferrer");
                                },
                              },
                            ]}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>

                <DataTable className="hidden md:block">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-white/10 bg-black/30">
                      <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-text-secondary/72">
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2">Table / Customer</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Payment</th>
                        <th className="px-3 py-2">Waiter</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((order) => {
                        const nextStatus = mapNextStatus(order);
                        const isReady = normalizeOrderStatus(order.status) === "ready";
                        const isOverdue = overdueOrderIds.includes(order.id);
                        return (
                          <tr
                            key={order.id}
                            className={cn("border-b border-white/8", isReady && "bg-success/5", isOverdue && "bg-[#FF6A1A]/[0.07]")}
                          >
                            <td className="px-3 py-2">
                              <div className="font-mono text-[11px] text-text-secondary/82">{order.id}</div>
                              <div className="mt-0.5 text-[11px] text-text-secondary/65">{order.items.length} items</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-text-primary">
                                {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName || "Guest"}
                              </div>
                              <div className="text-xs text-text-secondary/72">{order.customerPhone || "No phone"}</div>
                            </td>
                            <td className="px-3 py-2 text-xs text-text-secondary/72">{formatCreated(order.createdAt)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <StatusBadge status={order.status} />
                                {isOverdue ? <Badge variant="warning">Overdue</Badge> : null}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={paymentBadgeVariant(order.paymentStatus)}>{order.paymentStatus || "unpaid"}</Badge>
                            </td>
                            <td className="px-3 py-2 text-xs text-text-secondary/80">
                              {order.takenByWaiterName || "Unassigned"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                {nextStatus ? (
                                  <Button
                                    size="sm"
                                    variant={isReady ? "success" : "primary"}
                                    className="h-7 rounded-lg px-2.5 py-1 text-[11px]"
                                    disabled={submittingOrderId === order.id || !canUpdateServiceOrders}
                                    onClick={() => void onAdvanceStatus(order)}
                                  >
                                    {isReady ? "Mark Served" : `Mark ${nextStatus}`}
                                  </Button>
                                ) : (
                                  <Badge variant="success">Closed</Badge>
                                )}
                                <UbhonaActionMenu
                                  items={[
                                    {
                                      key: "open-track",
                                      label: "Open Tracking",
                                      icon: <SquareArrowOutUpRight className="h-3.5 w-3.5" />,
                                      onSelect: () => {
                                        window.open(`/order/${encodeURIComponent(order.id)}`, "_blank", "noopener,noreferrer");
                                      },
                                    },
                                    {
                                      key: "view-dish",
                                      label: "View First Dish",
                                      icon: <CheckCheck className="h-3.5 w-3.5" />,
                                      onSelect: () => {
                                        const first = order.items[0];
                                        if (!first || !restaurant?.slug) return;
                                        const href = getDishUrl(restaurant.slug, first.dishId);
                                        window.open(href, "_blank", "noopener,noreferrer");
                                      },
                                    },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </DataTable>
              </>
            )}
          </section>
        ) : null}

        <div className="flex justify-end">
          <Link to="/dashboard/orders" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Full Orders Dashboard
          </Link>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
