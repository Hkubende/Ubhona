import * as React from "react";
import { ArrowLeft, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAdminMetrics, getAdminRestaurants, type AdminMetrics, type AdminRestaurant } from "../../lib/admin";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function BillingAdmin() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = React.useState<AdminMetrics | null>(null);
  const [restaurants, setRestaurants] = React.useState<AdminRestaurant[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    Promise.all([getAdminMetrics(), getAdminRestaurants()])
      .then(([metricsData, restaurantsData]) => {
        setMetrics(metricsData);
        setRestaurants(restaurantsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load billing admin."));
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <div>
            <div className="text-2xl font-black">
              <span className="text-orange-400">Billing</span> Admin
            </div>
            <div className="text-sm text-white/60">Subscription and revenue oversight</div>
          </div>
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold hover:bg-white/[0.08]"
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
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Total Revenue</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">
              {metrics ? formatKsh(metrics.totalRevenue) : "-"}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Orders (24h)</div>
            <div className="mt-2 text-2xl font-black text-orange-300">{metrics?.recentOrders24h ?? "-"}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Failed Payments</div>
            <div className="mt-2 text-2xl font-black text-red-300">{metrics?.failedPayments ?? "-"}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-white/55">Restaurants</div>
            <div className="mt-2 text-2xl font-black text-cyan-300">{metrics?.restaurants ?? "-"}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-wide text-white/70">Plan Distribution</div>
            <div className="space-y-2 text-sm">
              {(metrics?.planBreakdown || []).map((row) => (
                <div key={row.plan} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                  <span className="font-semibold">{row.plan}</span>
                  <span className="text-orange-300">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 text-sm font-black uppercase tracking-wide text-white/70">Status Distribution</div>
            <div className="space-y-2 text-sm">
              {(metrics?.statusBreakdown || []).map((row) => (
                <div key={row.status} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                  <span className="font-semibold">{row.status}</span>
                  <span className="text-cyan-300">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white/70">
            <Receipt className="h-4 w-4" />
            Billing Watchlist
          </div>
          <div className="space-y-2">
            {restaurants
              .filter((row) => ["past_due", "canceled", "suspended"].includes(row.subscriptionStatus))
              .map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-orange-300">{row.subscriptionPlan}</div>
                  </div>
                  <div className="text-xs text-white/60">Status: {row.subscriptionStatus}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
