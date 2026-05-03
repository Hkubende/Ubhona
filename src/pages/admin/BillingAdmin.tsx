import * as React from "react";
import { ArrowLeft, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAdminBillingOverview,
  getAdminMetrics,
  getAdminRestaurants,
  type AdminBillingOverviewRow,
  type AdminMetrics,
  type AdminRestaurant,
} from "../../lib/admin";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function BillingAdmin() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = React.useState<AdminMetrics | null>(null);
  const [restaurants, setRestaurants] = React.useState<AdminRestaurant[]>([]);
  const [billingOverview, setBillingOverview] = React.useState<AdminBillingOverviewRow[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    Promise.all([getAdminMetrics(), getAdminRestaurants(), getAdminBillingOverview()])
      .then(([metricsData, restaurantsData, overviewData]) => {
        setMetrics(metricsData);
        setRestaurants(restaurantsData);
        setBillingOverview(overviewData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load billing admin."));
  }, []);

  return (
    <div className="min-h-screen bg-app-bg text-text-primary">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="ui-surface mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5 backdrop-blur-xl">
          <div>
            <div className="text-2xl font-black">
              <span className="text-primary">Billing</span> Admin
            </div>
            <div className="text-sm text-text-secondary/70">Subscription and revenue oversight</div>
          </div>
          <button
            onClick={() => navigate("/admin")}
            className="ui-button-secondary inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin Home
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <div className="ui-panel-inset rounded-3xl p-4">
            <div className="text-xs text-text-secondary/60">Total Revenue</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">{metrics ? formatKsh(metrics.totalRevenue) : "-"}</div>
          </div>
          <div className="ui-panel-inset rounded-3xl p-4">
            <div className="text-xs text-text-secondary/60">Orders (24h)</div>
            <div className="mt-2 text-2xl font-black text-orange-300">{metrics?.recentOrders24h ?? "-"}</div>
          </div>
          <div className="ui-panel-inset rounded-3xl p-4">
            <div className="text-xs text-text-secondary/60">Failed Payments</div>
            <div className="mt-2 text-2xl font-black text-red-300">{metrics?.failedPayments ?? "-"}</div>
          </div>
          <div className="ui-panel-inset rounded-3xl p-4">
            <div className="text-xs text-text-secondary/60">Restaurants</div>
            <div className="mt-2 text-2xl font-black text-cyan-300">{metrics?.restaurants ?? "-"}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ui-surface rounded-3xl p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-wide text-text-secondary/70">Plan Distribution</div>
            <div className="space-y-2 text-sm">
              {(metrics?.planBreakdown || []).map((row) => (
                <div key={row.plan} className="ui-panel-inset flex items-center justify-between rounded-2xl px-3 py-2">
                  <span className="font-semibold">{row.plan}</span>
                  <span className="text-orange-300">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ui-surface rounded-3xl p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-wide text-text-secondary/70">Status Distribution</div>
            <div className="space-y-2 text-sm">
              {(metrics?.statusBreakdown || []).map((row) => (
                <div key={row.status} className="ui-panel-inset flex items-center justify-between rounded-2xl px-3 py-2">
                  <span className="font-semibold">{row.status}</span>
                  <span className="text-cyan-300">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ui-surface mt-6 rounded-3xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-text-secondary/70">
            <Receipt className="h-4 w-4" />
            Billing Watchlist
          </div>
          <div className="space-y-2">
            {restaurants
              .filter((row) => ["past_due", "cancelled", "expired"].includes(row.subscriptionStatus))
              .map((row) => (
                <div key={row.id} className="ui-panel-inset rounded-2xl px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-orange-300">{row.subscriptionPlan}</div>
                  </div>
                  <div className="text-xs text-text-secondary/70">Status: {row.subscriptionStatus}</div>
                </div>
              ))}
          </div>
        </div>

        <div className="ui-surface mt-6 rounded-3xl p-4">
          <div className="mb-3 text-sm font-black uppercase tracking-wide text-text-secondary/70">Billing Operations Snapshot</div>
          <div className="space-y-2">
            {billingOverview.map((row) => (
              <div key={row.restaurantId} className="ui-panel-inset rounded-2xl px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{row.restaurantName}</div>
                  <div className="text-orange-300">{row.currentPlan}</div>
                </div>
                <div className="mt-1 grid gap-1 text-xs text-text-secondary/72 md:grid-cols-2">
                  <div>Status: {row.subscriptionStatus}</div>
                  <div>Trial end: {row.trialEndDate || "n/a"}</div>
                  <div>
                    Latest invoice: {row.latestInvoice ? `${row.latestInvoice.status} • ${formatKsh(row.latestInvoice.amount)}` : "n/a"}
                  </div>
                  <div>
                    Latest payment: {row.latestPayment ? `${row.latestPayment.status} • ${row.latestPayment.provider}` : "n/a"}
                  </div>
                  <div>Last method: {row.lastPaymentMethod || "n/a"}</div>
                  <div>Outstanding: {formatKsh(row.outstandingBalance)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
