import * as React from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getAdminRestaurants,
  updateAdminRestaurantStatus,
  type AdminRestaurant,
} from "../../lib/admin";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function RestaurantsAdmin() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = React.useState<AdminRestaurant[]>([]);
  const [q, setQ] = React.useState("");
  const [plan, setPlan] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const refresh = React.useCallback(async () => {
    try {
      setError("");
      const rows = await getAdminRestaurants({ q, plan, status });
      setRestaurants(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurants.");
    }
  }, [q, plan, status]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const setRestaurantStatus = async (id: string, next: "active" | "suspended") => {
    try {
      await updateAdminRestaurantStatus(id, next);
      setNotice(`Restaurant status updated to ${next}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <div>
            <div className="text-2xl font-black">
              <span className="text-orange-400">Restaurants</span> Admin
            </div>
            <div className="text-sm text-white/60">Platform-wide restaurant management</div>
          </div>
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin Home
          </button>
        </div>

        {notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-4 grid gap-3 md:grid-cols-[1.2fr_0.4fr_0.4fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search name, slug, email, phone..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-2 pl-10 pr-3 text-sm outline-none"
            />
          </div>
          <select
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none"
          >
            <option value="">All plans</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="suspended">Suspended</option>
            <option value="canceled">Canceled</option>
          </select>
          <button
            onClick={() => void refresh()}
            className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-3 py-3">Restaurant</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Plan / Status</th>
                  <th className="px-3 py-3">Usage</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((restaurant) => (
                  <tr key={restaurant.id} className="border-t border-white/10 text-sm">
                    <td className="px-3 py-3">
                      <div className="font-bold text-white">{restaurant.name}</div>
                      <div className="text-xs text-white/55">@{restaurant.slug}</div>
                      <div className="text-xs text-white/55">{restaurant.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{restaurant.owner.name}</div>
                      <div className="text-xs text-white/55">{restaurant.owner.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-orange-300">{restaurant.subscriptionPlan}</div>
                      <div className="text-xs text-white/60">{restaurant.subscriptionStatus}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-white/70">
                      <div>Dishes: {restaurant.usage.dishes}</div>
                      <div>Orders: {restaurant.usage.orders}</div>
                      <div>Analytics: {restaurant.usage.analyticsEvents}</div>
                      <div>Revenue: {formatKsh(restaurant.usage.revenue)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void setRestaurantStatus(restaurant.id, "active")}
                          className="rounded-xl border border-emerald-400/35 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-200"
                        >
                          Reactivate
                        </button>
                        <button
                          onClick={() => void setRestaurantStatus(restaurant.id, "suspended")}
                          className="rounded-xl border border-red-400/35 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-200"
                        >
                          Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!restaurants.length ? (
            <div className="p-5 text-sm text-white/60">No restaurants match current filters.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
