import * as React from "react";
import { Link } from "react-router-dom";
import type { Order, PopularDish } from "../../types/dashboard";
import { Badge } from "../ui/Badge";
import { buttonVariants } from "../ui/Button";
import {
  ContentGrid,
  DashboardPanel,
  DataTable,
  EmptyStateCard,
  MetricCard,
  SectionHeader,
  StatusBadge,
} from "./dashboard-primitives";
import { Avatar } from "../ui/Avatar";
import { cn } from "../../lib/utils";
import { spacing, tokens, typography } from "../../design-system";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function compactOrderId(value: string) {
  return value.length > 14 ? `${value.slice(0, 12)}...` : value;
}

function getRestaurantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "UB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatPlanStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "trialing") return "Trial";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RestaurantSummaryStrip({
  restaurantName,
  logoUrl: _logoUrl,
  planLabel,
  planStatus,
  categoryCount,
  dishCount,
  pendingOrders,
  loading,
  error,
}: {
  restaurantName: string;
  logoUrl?: string;
  planLabel: string;
  planStatus: string;
  categoryCount: number;
  dishCount: number;
  pendingOrders: number;
  loading: boolean;
  error?: string;
}) {
  return (
    <DashboardPanel className="rounded-3xl px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-[linear-gradient(180deg,rgba(228,87,46,0.26),rgba(121,48,25,0.18))] text-sm font-semibold tracking-[0.14em] text-[#FBF6EE] shadow-[0_12px_24px_rgba(90,37,19,0.22)]">
              {getRestaurantInitials(restaurantName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-text-primary">{restaurantName}</h2>
                <Badge variant="accent" className="h-6 rounded-full px-2.5 text-[10px] uppercase tracking-[0.14em]">
                  {planLabel} ({formatPlanStatus(planStatus)})
                </Badge>
              </div>
              <p className={cn("mt-1", typography.body)}>
                One operational cockpit for menu quality, active queue, and service flow.
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0 space-y-2 self-start sm:self-center">
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <div className={tokens.classes.metricChip}>{categoryCount} categories</div>
            <div className={tokens.classes.metricChip}>{dishCount} dishes</div>
            <div className={tokens.classes.metricChip}>{pendingOrders} pending</div>
          </div>
          <div className="text-right">
            <Link
              to="/pricing"
              className="text-sm font-semibold text-text-secondary underline underline-offset-4 transition-colors hover:text-text-primary"
            >
              Manage Subscription
            </Link>
          </div>
        </div>
      </div>
      {error ? <div className="mt-3"><EmptyStateCard message={error} /></div> : null}
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-44 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-64 animate-pulse rounded bg-white/10" />
        </div>
      ) : null}
    </DashboardPanel>
  );
}

export function BusinessSnapshotRow({
  ordersToday,
  revenue,
  totalDishes,
  arOpens,
}: {
  ordersToday: number;
  revenue: number;
  totalDishes: number;
  arOpens: number;
}) {
  return (
    <section>
      <ContentGrid columns="metrics">
        <MetricCard label="Orders Today" value={String(ordersToday)} tone="orange" />
        <MetricCard label="Revenue Today" value={formatKsh(revenue)} tone="emerald" />
        <MetricCard label="Total Dishes" value={String(totalDishes)} />
        <MetricCard label="AR Opens" value={String(arOpens)} tone="sand" />
      </ContentGrid>
    </section>
  );
}

export function OrdersTablePanel({
  recentOrders,
  ordersToday,
  preparingCount,
  confirmedCount,
  completedCount,
  viewAllTo = "/dashboard/orders",
}: {
  recentOrders: Order[];
  ordersToday: number;
  preparingCount: number;
  confirmedCount: number;
  completedCount: number;
  viewAllTo?: string;
}) {
  return (
    <DashboardPanel>
      <SectionHeader
        title="Recent Orders"
        subtitle={`${ordersToday} today - ${preparingCount} preparing - ${confirmedCount} confirmed - ${completedCount} completed`}
        action={
          <Link to={viewAllTo} className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary/80 hover:text-text-primary">
            View All
          </Link>
        }
      />
      {recentOrders.length ? (
        <DataTable>
          <table className="min-w-full text-sm">
            <thead className={tokens.classes.tableHeader}>
              <tr>
                <th className="px-3 py-2.5">Order ID</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Total</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className={tokens.classes.tableRow}>
                  <td className="px-3 py-2.5 font-mono text-xs text-text-secondary/88" title={order.id}>
                    {compactOrderId(order.id)}
                  </td>
                  <td className="px-3 py-2.5">{order.customerName || "Guest"}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{formatKsh(order.total)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      ) : (
        <EmptyStateCard message="No recent orders yet." />
      )}
    </DashboardPanel>
  );
}

export function PopularDishesPanel({
  popularDishes,
  dishMetaById,
}: {
  popularDishes: PopularDish[];
  dishMetaById?: Record<string, { imageUrl?: string; price?: number }>;
}) {
  return (
    <DashboardPanel>
      <SectionHeader title="Popular Dishes" subtitle="Top menu performers and pricing at a glance." />
      {popularDishes.length ? (
        <div className={spacing.stackSm}>
          {popularDishes.map((dish) => (
            <div
              key={dish.dishId}
              className={cn(tokens.classes.panelInset, "px-3 py-2.5")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    src={dishMetaById?.[dish.dishId]?.imageUrl}
                    alt={dish.name}
                    fallback={dish.name.slice(0, 2)}
                    size="sm"
                    className="rounded-lg border-border/80"
                  />
                  <div>
                    <div className="font-semibold text-text-primary">{dish.name}</div>
                    <div className="text-xs text-text-secondary/68">{dish.count} orders this week</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-text-primary">
                    {formatKsh(dishMetaById?.[dish.dishId]?.price || 0)}
                  </div>
                  <div className="text-[11px] text-text-secondary/60">{formatKsh(dish.revenue || 0)} revenue</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyStateCard message="No popular dish stats available yet." />
      )}
      <div className="mt-2.5">
        <Link to="/dashboard/menu" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Open Menu Editor
        </Link>
      </div>
    </DashboardPanel>
  );
}

export function SystemStatusStrip({
  planLabel,
  pendingOrders,
  analyticsAvailable,
}: {
  planLabel: string;
  pendingOrders: number;
  analyticsAvailable: boolean;
}) {
  return (
    <DashboardPanel className="py-3">
      <SectionHeader title="System Status" subtitle="Low-priority operational context." />
      <div className={cn(tokens.classes.panelInset, "flex flex-wrap items-center justify-between gap-2 px-3 py-2.5")}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary/82">
          <span>
            Printer: <span className="font-semibold text-text-primary">Active</span>
          </span>
          <span className="h-1 w-1 rounded-full bg-text-secondary/50" />
          <span>
            Plan: <span className="font-semibold text-text-primary">{planLabel}</span>
          </span>
          <span className="h-1 w-1 rounded-full bg-text-secondary/50" />
          <span>
            Queue: <span className="font-semibold text-text-primary">{pendingOrders}</span> pending
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard/orders" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Orders Desk
          </Link>
          <Link to="/dashboard/printing" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Printing
          </Link>
          {!analyticsAvailable ? (
            <Link to="/pricing" className={buttonVariants({ variant: "warning", size: "sm" })}>
              Upgrade
            </Link>
          ) : null}
        </div>
      </div>
    </DashboardPanel>
  );
}
