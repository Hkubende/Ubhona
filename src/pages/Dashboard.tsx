import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, ShoppingBag } from "lucide-react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  PageContainer,
  DashboardPanel,
  MetricCard,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { spacing } from "../design-system";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import { getCurrentPlan, getRestaurantProfile, type RestaurantProfile } from "../lib/restaurant";
import { isFeatureAvailable } from "../lib/plan-gates";
import { getRemainingStarterAllowance, getRestaurantUsage } from "../lib/growth";
import { getLaunchSignupFunnel, type LaunchSignupFunnel } from "../lib/analytics";
import { canPerformAction, getPrimaryDashboardRole } from "../lib/roles";
import { getActivityHistory, type ActivityItem } from "../lib/activity";
import {
  KpiRow,
} from "../components/dashboard/overview/kpi-row";
import { RecentOrdersCard } from "../components/dashboard/overview/recent-orders-card";
import { PopularDishesCard } from "../components/dashboard/overview/popular-dishes-card";
import { RestaurantSummaryStrip } from "../components/dashboard/overview/restaurant-summary-strip";
import { ActivityFeed } from "../components/dashboard/activity-feed";
import { OnboardingChecklist } from "../components/dashboard/onboarding-checklist";

function OverviewHeaderActions({
  storefrontPath,
  analyticsAvailable,
}: {
  storefrontPath: string;
  analyticsAvailable: boolean;
}) {
  void storefrontPath;
  void analyticsAvailable;
  const navigate = useNavigate();
  const canManageMenu = canPerformAction("manage_menu");
  const canCreateOrder = canPerformAction("create_order");

  if (!canManageMenu && !canCreateOrder) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canManageMenu ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/dashboard/menu")}
          className="rounded-full"
        >
          <PlusCircle className="h-4 w-4" />
          Add Dish
        </Button>
      ) : null}
      {canCreateOrder ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate("/dashboard/orders/new")}
          className="rounded-full border-primary/80 bg-primary text-[#FBF6EE]"
        >
          <ShoppingBag className="h-4 w-4" />
          New Order
        </Button>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useRestaurantDashboard();
  const [activityLoading, setActivityLoading] = React.useState(true);
  const [activityItems, setActivityItems] = React.useState<ActivityItem[]>([]);
  const [launchFunnel, setLaunchFunnel] = React.useState<LaunchSignupFunnel | null>(null);
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
  const usage = React.useMemo(
    () => (profile ? getRestaurantUsage(profile.id) : null),
    [profile]
  );
  const allowance = React.useMemo(
    () => (profile ? getRemainingStarterAllowance(profile.id) : null),
    [profile]
  );
  const analyticsAvailable = React.useMemo(() => isFeatureAvailable("analytics", profile), [profile]);
  const starterLimitWarning = React.useMemo(() => {
    if (currentPlan.plan !== "starter" || !allowance) return false;
    return (allowance.monthlyOrdersRemaining ?? 9999) <= 30 || (allowance.dishesRemaining ?? 9999) <= 5;
  }, [allowance, currentPlan.plan]);
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
  const stockSummary = React.useMemo(() => {
    const result = { lowStock: 0, unavailable: 0, hidden: 0 };
    (data?.dishes || []).forEach((dish) => {
      if (dish.stock?.availability_status === "low_stock") result.lowStock += 1;
      if (dish.stock?.availability_status === "unavailable") result.unavailable += 1;
      if (dish.stock?.hidden_from_public_menu) result.hidden += 1;
    });
    return result;
  }, [data?.dishes]);
  const role = getPrimaryDashboardRole();
  const roleSubtitle =
    role === "owner" || role === "admin"
      ? "Business-wide operations, growth signals, and revenue visibility."
      : "Operational control center for service flow, team performance, and shift execution.";
  const onboardingItems = React.useMemo(() => {
    const hasProfileBasics = Boolean(
      data?.restaurant.name &&
      (data?.restaurant.location || data?.restaurant.phone)
    );
    const hasCategories = (data?.categories.length || 0) > 0;
    const hasDishes = (data?.dishes.length || 0) > 0;
    const hasStorefront = Boolean(data?.restaurant.slug && hasDishes);
    const hasOrders = (data?.orders.length || 0) > 0;

    return [
      {
        id: "profile",
        title: "Confirm restaurant details",
        description: hasProfileBasics
          ? "Restaurant name and basic contact details are already in place."
          : "Add location and contact details so staff and customers know where and how to reach you.",
        complete: hasProfileBasics,
        to: "/dashboard/settings",
        ctaLabel: hasProfileBasics ? "Review" : "Complete",
      },
      {
        id: "menu",
        title: "Build your menu",
        description: hasDishes
          ? `${data?.dishes.length || 0} dishes are already available to manage.`
          : hasCategories
            ? "Categories are ready. Add the first live dish next."
            : "Create categories and add the first dish customers will see.",
        complete: hasDishes,
        to: "/dashboard/menu",
        ctaLabel: hasDishes ? "Manage Menu" : "Add Dishes",
      },
      {
        id: "storefront",
        title: "Verify customer ordering path",
        description: hasStorefront
          ? "Your storefront link is ready for sharing and testing."
          : "Publish at least one dish so the storefront can accept real customer traffic.",
        complete: hasStorefront,
        to: storefrontPath,
        ctaLabel: hasStorefront ? "Open Storefront" : "Preview Storefront",
      },
      {
        id: "orders",
        title: "Run the first order workflow",
        description: hasOrders
          ? `${data?.orders.length || 0} order${(data?.orders.length || 0) === 1 ? "" : "s"} recorded so far.`
          : "Create a manual order or place a test storefront order to verify kitchen and payment flow.",
        complete: hasOrders,
        to: canPerformAction("create_order") ? "/dashboard/orders/new" : "/dashboard/orders",
        ctaLabel: hasOrders ? "Open Orders" : "Start Order",
      },
    ];
  }, [data, storefrontPath]);
  const showOnboardingChecklist = onboardingItems.some((item) => !item.complete);

  React.useEffect(() => {
    let mounted = true;
    setActivityLoading(true);
    void getActivityHistory({ limit: 6 })
      .then((rows) => {
        if (mounted) setActivityItems(rows);
      })
      .catch(() => {
        if (mounted) setActivityItems([]);
      })
      .finally(() => {
        if (mounted) setActivityLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [data?.restaurant.id]);

  React.useEffect(() => {
    setLaunchFunnel(getLaunchSignupFunnel(30));
  }, []);

  return (
    <DashboardLayout
      profile={profile}
      title="Overview"
      subtitle={roleSubtitle}
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
      {usage ? (
        <div className="flex flex-wrap gap-2 text-xs text-white/72">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            Monthly orders tracked: {usage.ordersCount}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            Active days this month: {usage.activeDays.length}
          </span>
          {currentPlan.plan === "starter" && allowance?.monthlyOrdersRemaining != null ? (
            <span className="rounded-full border border-[#FF6A1A]/35 bg-[#FF6A1A]/10 px-3 py-1 text-[#F7F1E8]">
              Starter orders remaining: {allowance.monthlyOrdersRemaining}
            </span>
          ) : null}
        </div>
      ) : null}
      {stockSummary.lowStock > 0 || stockSummary.unavailable > 0 || stockSummary.hidden > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-white/72">
          {stockSummary.lowStock > 0 ? (
            <span className="rounded-full border border-[#FF6A1A]/35 bg-[#FF6A1A]/10 px-3 py-1 text-[#F7F1E8]">
              Low-stock dishes: {stockSummary.lowStock}
            </span>
          ) : null}
          {stockSummary.unavailable > 0 ? (
            <span className="rounded-full border border-[#D36A59]/35 bg-[#D36A59]/10 px-3 py-1 text-[#F7F1E8]">
              Unavailable dishes: {stockSummary.unavailable}
            </span>
          ) : null}
          {stockSummary.hidden > 0 ? (
            <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1">
              Hidden from public menu: {stockSummary.hidden}
            </span>
          ) : null}
        </div>
      ) : null}
      {starterLimitWarning ? (
        <div className="rounded-2xl border border-[#FF6A1A]/35 bg-[#FF6A1A]/10 px-3 py-2 text-sm text-[#F7F1E8]">
          <div className="font-semibold">Starter limits approaching</div>
          <div className="text-xs text-[#F7F1E8]/85">
            Remaining this month: {allowance.monthlyOrdersRemaining ?? "Unlimited"} orders,{" "}
            {allowance.dishesRemaining ?? "Unlimited"} dish slots.
          </div>
          <Link to="/pricing" className="mt-2 inline-block text-xs font-bold text-[#F7F1E8] underline underline-offset-2">
            Upgrade plan
          </Link>
        </div>
      ) : null}
      {showOnboardingChecklist ? (
        <DashboardPanel>
          <OnboardingChecklist items={onboardingItems} />
        </DashboardPanel>
      ) : null}
      {launchFunnel && Object.values(launchFunnel.totals).some((value) => value > 0) ? (
        <DashboardPanel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-text-primary">Launch Funnel</div>
              <div className="mt-1 text-sm text-text-secondary/72">
                Marketing-to-signup flow from the last {launchFunnel.periodDays} days.
              </div>
            </div>
            <div className="rounded-full border border-border bg-white/[0.04] px-3 py-1 text-xs text-text-secondary/72">
              Local prelaunch readout
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Landing Visits" value={String(launchFunnel.totals.landingVisits)} />
            <MetricCard label="CTA Clicks" value={String(launchFunnel.totals.ctaClicks)} tone="sand" />
            <MetricCard label="Signup Starts" value={String(launchFunnel.totals.signupStarts)} tone="orange" />
            <MetricCard label="Signups" value={String(launchFunnel.totals.signupCompletions)} tone="emerald" />
            <MetricCard label="Onboarding Starts" value={String(launchFunnel.totals.onboardingStarts)} tone="sand" />
            <MetricCard label="Onboarding Complete" value={String(launchFunnel.totals.onboardingCompletions)} tone="emerald" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/72">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Visit to CTA: {Math.round(launchFunnel.rates.ctaClickRate)}%
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              CTA to signup start: {Math.round(launchFunnel.rates.signupStartRate)}%
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Signup completion: {Math.round(launchFunnel.rates.signupCompletionRate)}%
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Onboarding completion: {Math.round(launchFunnel.rates.onboardingCompletionRate)}%
            </span>
          </div>
        </DashboardPanel>
      ) : null}
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
      <section>
        <ActivityFeed
          title="Activity"
          subtitle="Recent operational changes across menu, orders, and settings."
          items={activityItems}
          loading={activityLoading}
          emptyMessage="Activity will appear here after operational changes."
        />
      </section>
      </PageContainer>
    </DashboardLayout>
  );
}
