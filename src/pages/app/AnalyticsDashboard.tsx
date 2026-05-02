import * as React from "react";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/dashboard/dashboard-layout";
import {
  ContentGrid,
  DashboardPanel,
  DataTable,
  EmptyStateCard,
  MetricCard,
  PageContainer,
  SectionHeader,
} from "../../components/dashboard/dashboard-primitives";
import { Badge } from "../../components/ui/Badge";
import { buttonVariants } from "../../components/ui/Button";
import { useRestaurantAnalytics } from "../../hooks/use-restaurant-analytics";
import { getRestaurantProfile, syncRestaurantProfile, type RestaurantProfile } from "../../lib/restaurant";
import { cn } from "../../lib/utils";
import { spacing, tokens } from "../../design-system";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function AnalyticsDashboard() {
  const {
    restaurant,
    summary,
    loading,
    error,
    planLabel,
    analyticsEnabled,
    gateMessage,
    setRestaurantProfile,
  } = useRestaurantAnalytics();

  React.useEffect(() => {
    void syncRestaurantProfile().then((profile) => {
      setRestaurantProfile(profile || getRestaurantProfile());
    });
  }, [setRestaurantProfile]);

  const profile = React.useMemo<RestaurantProfile | null>(() => {
    if (!restaurant) return getRestaurantProfile();
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

  const chartSeries = React.useMemo(() => {
    const base = summary?.popularDishes || [];
    return base.slice(0, 6).map((dish) => ({
      name: dish.name,
      value: dish.count,
      revenue: dish.revenue || 0,
    }));
  }, [summary?.popularDishes]);

  const maxCount = React.useMemo(
    () => Math.max(...chartSeries.map((point) => point.value), 1),
    [chartSeries]
  );

  if (!analyticsEnabled) {
    return (
      <DashboardLayout
        profile={profile}
        title="Analytics"
        subtitle="Understand dish performance, AR engagement, and order momentum."
      >
        <PageContainer>
          <DashboardPanel>
            <div className="ui-action-surface rounded-[24px] border border-amber-300/18 px-5 py-5">
              <div className="flex items-center gap-2">
                <Badge variant="warning">Plan gated</Badge>
                <div className="ubhona-summary-eyebrow text-white/48">
                  Analytics access
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <div className="ui-panel-inset grid h-10 w-10 place-items-center rounded-[16px]">
                  <Lock className="h-4 w-4 text-amber-200" />
                </div>
                <div>
                  <div className="font-semibold tracking-[-0.01em] text-amber-50">Analytics locked on {planLabel}</div>
                  <p className="mt-1 text-sm leading-6 text-white/72">{gateMessage}</p>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to="/pricing"
                  className={`mt-3 ${buttonVariants({ variant: "primary", size: "sm" })}`}
                >
                  Compare Plans
                </Link>
              </div>
            </div>
          </DashboardPanel>
        </PageContainer>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      profile={profile}
      title="Analytics"
      subtitle="Understand dish performance, AR engagement, and order momentum."
    >
      <PageContainer>
      <div className="ubhona-summary-grid">
        <MetricCard label="Dish Views" value={String(summary?.totalDishViews ?? 0)} />
        <MetricCard label="AR Opens" value={String(summary?.arOpens ?? 0)} tone="sand" />
        <MetricCard label="Add to Cart" value={String(summary?.totalAddToCart ?? 0)} tone="orange" />
        <MetricCard label="Orders Placed" value={String(summary?.totalOrdersPlaced ?? 0)} tone="emerald" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <DashboardPanel>
          <SectionHeader
            title="Order Volume Trend"
            subtitle="Main analytics chart for current top-performing dishes."
          />
          {chartSeries.length ? (
            <div className={cn(tokens.classes.panelInset, "space-y-3 p-4")}>
              {chartSeries.map((point) => (
                <div key={point.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-text-secondary/80">
                    <span className="truncate pr-2 text-text-primary">{point.name}</span>
                    <span>{point.value} orders</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover"
                      style={{ width: `${Math.max((point.value / maxCount) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateCard message="No trend data yet. Orders will populate chart bars." />
          )}
        </DashboardPanel>

        <DashboardPanel>
          <SectionHeader
            title="Engagement Mix"
            subtitle="Secondary chart: conversion behavior snapshot."
          />
          <div className="grid gap-3">
            <div className={cn(tokens.classes.panelInset, "p-4")}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary/72">
                AR Opens vs Orders
              </div>
              <div className="flex items-end gap-2">
                <div className="w-full">
                  <div className="mb-1 text-[11px] text-text-secondary/70">AR Opens</div>
                  <div
                    className="h-2 rounded-full bg-success/70"
                    style={{
                      width: `${Math.min(
                        100,
                        ((summary?.arOpens ?? 0) / Math.max(summary?.totalDishViews ?? 1, 1)) * 100 * 2
                      )}%`,
                    }}
                  />
                </div>
                <div className="w-full">
                  <div className="mb-1 text-[11px] text-text-secondary/70">Orders</div>
                  <div
                    className="h-2 rounded-full bg-primary/80"
                    style={{
                      width: `${Math.min(
                        100,
                        ((summary?.totalOrdersPlaced ?? 0) / Math.max(summary?.totalDishViews ?? 1, 1)) * 100 * 2
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className={cn(tokens.classes.panelInset, "p-4 text-sm text-text-secondary/80")}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary/72">
                Quick Signal
              </div>
              <p>
                {summary?.totalDishViews
                  ? `${Math.round(((summary?.totalOrdersPlaced ?? 0) / Math.max(summary?.totalDishViews ?? 1, 1)) * 100)}% of dish views currently convert to orders.`
                  : "No traffic yet to compute conversion signals."}
              </p>
            </div>
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel>
        <SectionHeader title="Performance Table" subtitle="Most recent checkout activity with fulfillment state." />
        {loading ? (
          <div className={spacing.stackSm}>
            <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-56 animate-pulse rounded bg-white/10" />
          </div>
        ) : null}
        {error ? <EmptyStateCard message={error} /> : null}
        {!loading && !error && summary?.recentOrders.length ? (
          <DataTable>
            <table className="min-w-full text-sm">
              <thead className={tokens.classes.tableHeader}>
                <tr>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentOrders.map((order) => (
                  <tr key={order.id} className={tokens.classes.tableRow}>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary/82">{order.id}</td>
                    <td className="px-3 py-2.5 font-semibold text-text-primary">{order.customerName || "Guest"}</td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary/70 capitalize">{order.status}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{formatKsh(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        ) : null}
        {!loading && !error && !summary?.recentOrders.length ? (
          <EmptyStateCard message="No orders yet for this restaurant. Order metrics will appear after first checkout." />
        ) : null}
      </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}
