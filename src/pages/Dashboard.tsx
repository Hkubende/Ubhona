import * as React from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, ShoppingBag } from "lucide-react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  PageContainer,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { spacing } from "../design-system";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import { getCurrentPlan, getRestaurantProfile, type RestaurantProfile } from "../lib/restaurant";
import { isFeatureAvailable } from "../lib/plan-gates";
import {
  KpiRow,
} from "../components/dashboard/overview/kpi-row";
import { RecentOrdersCard } from "../components/dashboard/overview/recent-orders-card";
import { PopularDishesCard } from "../components/dashboard/overview/popular-dishes-card";
import { RestaurantSummaryStrip } from "../components/dashboard/overview/restaurant-summary-strip";

function OverviewHeaderActions({
  _storefrontPath,
  _analyticsAvailable,
}: {
  _storefrontPath: string;
  _analyticsAvailable: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => navigate("/dashboard/menu")}
        className="rounded-full"
      >
        <PlusCircle className="h-4 w-4" />
        Add Dish
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate("/dashboard/orders/new")}
        className="rounded-full border-primary/80 bg-primary text-[#FBF6EE]"
      >
        <ShoppingBag className="h-4 w-4" />
        New Order
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useRestaurantDashboard();
  const storefrontPath = data?.restaurant.slug ? `/r/${data.restaurant.slug}` : "/r/demo";
  const persistedProfile = React.useMemo(() => getRestaurantProfile(), []);

  const profile = React.useMemo<RestaurantProfile | null>(() => {
    if (!data) return null;
    const fallbackPlan = persistedProfile?.subscriptionPlan || "starter";
    const fallbackStatus = persistedProfile?.subscriptionStatus || "active";
    return {
      id: data.restaurant.id,
      restaurantName: data.restaurant.name,
      slug: data.restaurant.slug,
      phone: data.restaurant.phone,
      email: data.restaurant.email,
      location: data.restaurant.location,
      logo: data.brandingSettings.logoUrl || data.restaurant.logoUrl,
      coverImage: data.brandingSettings.coverImageUrl || data.restaurant.coverImageUrl,
      themePrimary: data.brandingSettings.primaryColor || data.restaurant.primaryColor,
      themeSecondary: "#34d399",
      shortDescription: data.brandingSettings.description || data.restaurant.description,
      subscriptionPlan: data.restaurant.subscriptionPlan || fallbackPlan,
      subscriptionStatus: data.restaurant.subscriptionStatus || fallbackStatus,
      trialEndsAt: persistedProfile?.trialEndsAt || null,
      renewalDate: persistedProfile?.renewalDate || null,
      createdAt: persistedProfile?.createdAt || new Date().toISOString(),
    };
  }, [data, persistedProfile]);

  const currentPlan = React.useMemo(() => getCurrentPlan(profile), [profile]);
  const analyticsAvailable = React.useMemo(() => isFeatureAvailable("analytics", profile), [profile]);
  const pendingOrders = React.useMemo(
    () =>
      data?.orders.filter((order) => {
        const status = order.status.toLowerCase();
        return status === "pending" || status === "confirmed" || status === "preparing";
      }).length || 0,
    [data]
  );
  const orderStatusCounts = React.useMemo(() => {
    const counts = { preparing: 0, confirmed: 0, completed: 0 };
    data?.orders.forEach((order) => {
      const status = order.status.toLowerCase();
      if (status === "preparing") counts.preparing += 1;
      if (status === "confirmed") counts.confirmed += 1;
      if (status === "completed") counts.completed += 1;
    });
    return counts;
  }, [data]);
  const dishMetaById = React.useMemo(() => {
    const entries = (data?.dishes || []).map((dish) => [
      dish.id,
      { imageUrl: dish.imageUrl, price: dish.price },
    ]);
    return Object.fromEntries(entries);
  }, [data?.dishes]);

  return (
    <DashboardLayout
      profile={profile}
      title="Overview"
      subtitle="Daily operations snapshot and live service performance"
      actions={<OverviewHeaderActions storefrontPath={storefrontPath} analyticsAvailable={analyticsAvailable} />}
    >
      <PageContainer className={spacing.stackLg}>
      <RestaurantSummaryStrip
        restaurantName={data?.restaurant.name || "Restaurant Team"}
        logoUrl={data?.brandingSettings.logoUrl || data?.restaurant.logoUrl}
        planLabel={currentPlan.label}
        planStatus={currentPlan.status}
        categoryCount={data?.categories.length || 0}
        dishCount={data?.dishes.length || 0}
        pendingOrders={pendingOrders}
        loading={loading}
        error={error}
      />
      <KpiRow
        ordersToday={data?.analyticsSummary.ordersToday ?? 0}
        revenue={data?.analyticsSummary.revenue ?? 0}
        totalDishes={data?.analyticsSummary.totalDishes ?? 0}
        arOpens={data?.analyticsSummary.arOpens ?? 0}
      />

      <section>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <RecentOrdersCard
          recentOrders={data?.analyticsSummary.recentOrders || []}
          ordersToday={data?.analyticsSummary.ordersToday || 0}
          preparingCount={orderStatusCounts.preparing}
          confirmedCount={orderStatusCounts.confirmed}
          completedCount={orderStatusCounts.completed}
        />
        <PopularDishesCard
          popularDishes={data?.analyticsSummary.popularDishes || []}
          dishMetaById={dishMetaById}
        />
      </div>
      </section>
      </PageContainer>
    </DashboardLayout>
  );
}
