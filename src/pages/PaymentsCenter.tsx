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
import { estimateTransactionFee, getRestaurantUsage, DEFAULT_TRANSACTION_FEE_RATE } from "../lib/growth";
import { getBillingSnapshot, type BillingSnapshot } from "../lib/billing";
import { invoiceStatusMeta, paymentStatusMeta, subscriptionStatusMeta } from "../lib/billing-ui";

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
      themePrimary: restaurant.primaryColor || "#FF6A1A",
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
  const projectedFees = paidOrders.reduce((sum, order) => sum + estimateTransactionFee(order.total), 0);
  const [billing, setBilling] = React.useState<BillingSnapshot | null>(null);
  React.useEffect(() => {
    void getBillingSnapshot().then((snapshot) => setBilling(snapshot));
  }, []);
  const usage = React.useMemo(
    () => (restaurant ? getRestaurantUsage(restaurant.id) : null),
    [restaurant]
  );
  const subscriptionMeta = subscriptionStatusMeta(billing?.subscription.status || profile?.subscriptionStatus || "trialing");
  const latestPayment = billing?.payments[0] || null;
  const latestPaymentMeta = latestPayment ? paymentStatusMeta(latestPayment.status) : null;
  const openInvoice = billing?.invoices.find((invoice) => invoice.status !== "paid") || null;
  const openInvoiceMeta = openInvoice ? invoiceStatusMeta(openInvoice.status) : null;

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
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            Projected transaction fees ({(DEFAULT_TRANSACTION_FEE_RATE * 100).toFixed(1)}%): {formatKsh(projectedFees)}
          </span>
          {usage ? (
            <>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                Tracked orders this month: {usage.ordersCount}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                Active days this month: {usage.activeDays.length}
              </span>
            </>
          ) : null}
        </div>
      </DashboardPanel>

      <DashboardPanel>
        <SectionHeader title="Payment Workflow" subtitle="M-Pesa and manual billing state for subscription operations." />
        <ActionBar>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{subscriptionMeta.label}</Badge>
            <Badge variant="neutral">{billing?.subscription.paymentProvider?.toUpperCase() || "MANUAL"}</Badge>
          </div>
          <Link to="/dashboard/settings">
            <Button variant="secondary" size="sm">Payment Settings</Button>
          </Link>
        </ActionBar>
        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : (
          <div className="space-y-2">
            <p className={typography.body}>
              Subscription billing is backend-driven. M-Pesa pending/success/failure and manual verification states are reflected here.
            </p>
            {billing ? (
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/78">
                  <div>Plan: {billing.plan.name}</div>
                  <div className="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/90">
                    {subscriptionMeta.label}
                  </div>
                  <div>Trial ends: {billing.subscription.trialEndsAt || "n/a"}</div>
                  <div>Current period ends: {billing.subscription.currentPeriodEnd || "n/a"}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/78">
                  <div>Invoices: {billing.invoices.length}</div>
                  <div>Payments: {billing.payments.length}</div>
                  <div>Open invoices: {billing.invoices.filter((item) => item.status !== "paid").length}</div>
                  <div>Last payment: {latestPaymentMeta?.label || "n/a"}</div>
                </div>
              </div>
            ) : null}
            {openInvoice ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/78">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${openInvoiceMeta?.className || "border-white/15"}`}>
                    {openInvoiceMeta?.label || openInvoice.status}
                  </span>
                  <span>
                    Invoice {openInvoice.paymentReference} - {openInvoice.currency} {openInvoice.amount.toLocaleString("en-KE")}
                  </span>
                </div>
                <div className="mt-1 text-white/60">Settle from Pricing with M-Pesa STK or manual fallback.</div>
              </div>
            ) : null}
            {latestPayment ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/78">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${latestPaymentMeta?.className || "border-white/15"}`}>
                    {latestPaymentMeta?.label || latestPayment.status}
                  </span>
                  <span>Provider: {latestPayment.provider.toUpperCase()}</span>
                  <span>Reference: {latestPayment.providerReference || latestPayment.transactionReference}</span>
                </div>
                {latestPaymentMeta ? <div className="mt-1 text-white/60">{latestPaymentMeta.hint}</div> : null}
              </div>
            ) : null}
          </div>
        )}
      </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}
