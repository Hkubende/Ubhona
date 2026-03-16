import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import {
  getAnalyticsConversion,
  getAnalyticsSummary,
  getAnalyticsTopDishes,
  type AnalyticsConversion,
  type AnalyticsSummary,
  type AnalyticsTopDishes,
} from "../../lib/analytics";
import {
  canUseFeature,
  getCurrentPlan,
  getRestaurantProfile,
  syncRestaurantProfile,
  type RestaurantProfile,
} from "../../lib/restaurant";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.png`;

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [days, setDays] = React.useState(30);
  const [summary, setSummary] = React.useState<AnalyticsSummary | null>(null);
  const [topDishes, setTopDishes] = React.useState<AnalyticsTopDishes | null>(null);
  const [conversion, setConversion] = React.useState<AnalyticsConversion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [restaurantProfile, setRestaurantProfile] = React.useState<RestaurantProfile | null>(null);

  React.useEffect(() => {
    void syncRestaurantProfile().then((profile) => {
      setRestaurantProfile(profile || getRestaurantProfile());
    });
  }, []);

  const analyticsEnabled = React.useMemo(
    () => canUseFeature("analytics", restaurantProfile),
    [restaurantProfile]
  );
  const currentPlan = React.useMemo(() => getCurrentPlan(restaurantProfile), [restaurantProfile]);

  const refresh = React.useCallback(async () => {
    if (!analyticsEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [summaryData, topData, conversionData] = await Promise.all([
        getAnalyticsSummary(days),
        getAnalyticsTopDishes(days),
        getAnalyticsConversion(days),
      ]);
      setSummary(summaryData);
      setTopDishes(topData);
      setConversion(conversionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [analyticsEnabled, days]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="Ubhona" className="h-11 w-11 rounded-2xl object-cover" />
            <div>
              <div className="text-2xl font-black">
                <span className="text-orange-400">Analytics</span> Dashboard
              </div>
              <div className="text-sm text-white/60">Menu performance and conversion insights</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold hover:bg-white/[0.08]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </div>

        {loading ? <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-white/60">Loading analytics...</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {!loading && !analyticsEnabled ? (
          <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-6">
            <div className="mb-2 flex items-center gap-2 text-lg font-black text-amber-200">
              <Lock className="h-5 w-5" />
              Analytics Locked on {currentPlan.label}
            </div>
            <p className="text-sm text-white/75">
              Upgrade to Pro or Enterprise to unlock menu performance, AR engagement, and
              conversion analytics.
            </p>
            <button
              onClick={() => navigate("/pricing")}
              className="mt-4 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-orange-400"
            >
              Compare Plans
            </button>
          </div>
        ) : null}
        {!loading && !error && summary && topDishes && conversion ? (
          <>
            <div className="mb-6 grid gap-3 md:grid-cols-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-white/55">Page Views</div>
                <div className="mt-2 text-2xl font-black text-white">{summary.totals.pageViewCount}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-white/55">Dish Views</div>
                <div className="mt-2 text-2xl font-black text-orange-300">{summary.totals.dishViewCount}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-white/55">AR Opens</div>
                <div className="mt-2 text-2xl font-black text-cyan-300">{summary.totals.arOpenCount}</div>
                <div className="text-xs text-white/55">{formatPct(conversion.rates.arEngagementRate)} engagement</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-white/55">Add to Cart</div>
                <div className="mt-2 text-2xl font-black text-white">{summary.totals.addToCartCount}</div>
                <div className="text-xs text-white/55">{formatPct(conversion.rates.addToCartRate)} add-to-cart rate</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-white/55">Orders</div>
                <div className="mt-2 text-2xl font-black text-emerald-300">{summary.totals.orderCreatedCount}</div>
                <div className="text-xs text-white/55">Checkout starts: {summary.totals.checkoutStartCount}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-white/55">Conversion Rate</div>
                <div className="mt-2 text-2xl font-black text-orange-300">{formatPct(conversion.rates.orderConversionRate)}</div>
                <div className="text-xs text-white/55">
                  Payment success: {summary.totals.paymentSuccessCount} / failed: {summary.totals.paymentFailedCount}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">Most Viewed Dishes</div>
                {topDishes.mostViewedDishes.length ? (
                  <div className="space-y-2">
                    {topDishes.mostViewedDishes.map((row) => (
                      <div key={row.dishId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm">
                        <div className="font-semibold">{row.name}</div>
                        <div className="text-orange-300">{row.views} views</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/55">No view data yet.</div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">Most Ordered Dishes</div>
                {topDishes.mostOrderedDishes.length ? (
                  <div className="space-y-2">
                    {topDishes.mostOrderedDishes.map((row) => (
                      <div key={row.dishId} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-emerald-300">{row.quantity} sold</div>
                        </div>
                        <div className="mt-1 text-xs text-white/60">Revenue: {formatKsh(row.revenue)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/55">No order data yet.</div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
