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

  return (
    <DashboardLayout
      profile={profile}
      title="Analytics"
      subtitle="Understand dish performance, AR engagement, and order momentum."
    >
      <PageContainer>
      {!loading && !analyticsEnabled ? (
        <DashboardPanel>
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
            <Lock className="mt-0.5 h-4 w-4 text-amber-300" />
            <div>
              <div className="font-bold text-amber-100">Analytics locked on {planLabel}</div>
              <p className="mt-1 text-sm text-white/75">{gateMessage}</p>
              <Link
                to="/pricing"
                className={`mt-3 ${buttonVariants({ variant: "primary", size: "sm" })}`}
              >
                Compare Plans
              </Link>
            </div>
          </div>
        </DashboardPanel>
      ) : null}

      <ContentGrid columns="metrics">
        <MetricCard label="Dish Views" value={String(summary?.totalDishViews ?? 0)} />
        <MetricCard label="AR Opens" value={String(summary?.arOpens ?? 0)} tone="sand" />
        <MetricCard label="Add to Cart" value={String(summary?.totalAddToCart ?? 0)} tone="orange" />
        <MetricCard label="Orders Placed" value={String(summary?.totalOrdersPlaced ?? 0)} tone="emerald" />
      </ContentGrid>

      <ContentGrid columns="two">
        <DashboardPanel>
          <SectionHeader title="Top Dishes" subtitle="Most ordered menu items." />
          {summary?.popularDishes.length ? (
            <div className={spacing.stackSm}>
              {summary.popularDishes.map((dish) => (
                <div key={dish.dishId} className={cn(tokens.classes.panelInset, "px-3 py-2")}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-text-primary">{dish.name}</div>
                    <div className="text-sm text-text-secondary">{dish.count} orders</div>
                  </div>
                  <div className="text-xs text-text-secondary/68">Revenue {formatKsh(dish.revenue || 0)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateCard message="No top dish analytics yet." />
          )}
        </DashboardPanel>
        <DashboardPanel>
          <SectionHeader title="Trend Blocks" subtitle="Placeholder cards ready for backend chart integration." />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn(tokens.classes.panelInset, "p-4 text-sm text-text-secondary/72")}>
              AR Engagement summary placeholder
            </div>
            <div className={cn(tokens.classes.panelInset, "p-4 text-sm text-text-secondary/72")}>
              Order trends summary placeholder
            </div>
          </div>
        </DashboardPanel>
      </ContentGrid>

      <DashboardPanel>
        <SectionHeader title="Recent Orders" subtitle="Most recent checkout activity from storefront." />
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
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentOrders.map((order) => (
                  <tr key={order.id} className={tokens.classes.tableRow}>
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
