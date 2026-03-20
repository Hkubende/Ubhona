import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ActionBar,
  ContentGrid,
  DashboardPanel,
  MetricCard,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useRestaurantOrders } from "../hooks/use-restaurant-orders";
import type { RestaurantProfile } from "../lib/restaurant";
import { typography } from "../design-system";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function PaymentsCenterPage() {
  const { restaurant, orders, loading, error } = useRestaurantOrders();

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

  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const unpaidOrders = orders.filter((order) => order.paymentStatus !== "paid");
  const paidTotal = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const pendingTotal = unpaidOrders.reduce((sum, order) => sum + order.total, 0);

  return (
    <DashboardLayout
      profile={profile}
      title="Payments"
      subtitle="Restaurant payment operations and settlement visibility."
      actions={
        <Link to="/dashboard/orders">
          <Button variant="primary" size="sm">Open Orders</Button>
        </Link>
      }
    >
      <PageContainer>
      <DashboardPanel>
        <SectionHeader title="Payment Snapshot" subtitle="Quick summary of paid and outstanding order balances." />
        {loading ? (
          <ContentGrid columns="three">
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
          </ContentGrid>
        ) : (
          <ContentGrid columns="three">
            <MetricCard label="Paid Orders" value={String(paidOrders.length)} tone="emerald" />
            <MetricCard label="Paid Total" value={formatKsh(paidTotal)} tone="sand" />
            <MetricCard label="Outstanding" value={formatKsh(pendingTotal)} tone="orange" />
          </ContentGrid>
        )}
      </DashboardPanel>

      <DashboardPanel>
        <SectionHeader title="Payment Workflow" subtitle="Placeholder foundation for settlement, reconciliation, and transaction logs." />
        <ActionBar>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">MVP Placeholder</Badge>
            <Badge variant="neutral">Backend Hook Ready</Badge>
          </div>
          <Link to="/dashboard/settings">
            <Button variant="secondary" size="sm">Payment Settings</Button>
          </Link>
        </ActionBar>
        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : (
          <p className={typography.body}>
            This section is prepared for payment method reconciliation, transaction export, and cashier closeout.
            Current order/payment status remains fully available in Orders.
          </p>
        )}
      </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}
