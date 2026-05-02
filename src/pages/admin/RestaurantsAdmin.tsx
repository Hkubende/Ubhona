import * as React from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UbhonaSelect, UbhonaSelectItem } from "../../components/ui/ubhona-select";
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
    <div className="min-h-screen bg-app-bg text-text-primary">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="ui-surface mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5 backdrop-blur-xl">
          <div>
            <div className="text-2xl font-black">
              <span className="text-primary">Restaurants</span> Admin
            </div>
            <div className="text-sm text-text-secondary/70">Platform-wide restaurant management</div>
          </div>
          <button
            onClick={() => navigate("/admin")}
            className="ui-button-secondary inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-bold"
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/45" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search name, slug, email, phone..."
              className="ui-input-control w-full rounded-2xl py-2 pl-10 pr-3 text-sm outline-none"
            />
          </div>
          <UbhonaSelect
            name="restaurantPlanFilter"
            value={plan || ALL_PLANS}
            onValueChange={(value) => setPlan(value === ALL_PLANS ? "" : value)}
            placeholder="All plans"
          >
            <UbhonaSelectItem value={ALL_PLANS}>All plans</UbhonaSelectItem>
            <UbhonaSelectItem value="starter">Starter</UbhonaSelectItem>
            <UbhonaSelectItem value="growth">Growth</UbhonaSelectItem>
            <UbhonaSelectItem value="pro">Pro</UbhonaSelectItem>
          </UbhonaSelect>
          <UbhonaSelect
            name="restaurantStatusFilter"
            value={status || ALL_STATUS}
            onValueChange={(value) => setStatus(value === ALL_STATUS ? "" : value)}
            placeholder="All statuses"
          >
            <UbhonaSelectItem value={ALL_STATUS}>All statuses</UbhonaSelectItem>
            <UbhonaSelectItem value="active">Active</UbhonaSelectItem>
            <UbhonaSelectItem value="trialing">Trialing</UbhonaSelectItem>
            <UbhonaSelectItem value="past_due">Past Due</UbhonaSelectItem>
            <UbhonaSelectItem value="suspended">Suspended</UbhonaSelectItem>
            <UbhonaSelectItem value="canceled">Canceled</UbhonaSelectItem>
          </UbhonaSelect>
          <button
            onClick={() => void refresh()}
            className="ui-button-primary rounded-2xl px-4 py-2 text-sm font-bold text-white"
          >
            Refresh
          </button>
        </div>

        <div className="ui-surface overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="ui-table-header text-left text-xs uppercase tracking-wide text-text-secondary/70">
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
                  <tr key={restaurant.id} className="border-t border-border text-sm">
                    <td className="px-3 py-3">
                      <div className="font-bold text-text-primary">{restaurant.name}</div>
                      <div className="text-xs text-text-secondary/60">@{restaurant.slug}</div>
                      <div className="text-xs text-text-secondary/60">{restaurant.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{restaurant.owner.name}</div>
                      <div className="text-xs text-text-secondary/60">{restaurant.owner.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-primary">{restaurant.subscriptionPlan}</div>
                      <div className="text-xs text-text-secondary/70">{restaurant.subscriptionStatus}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-text-secondary/78">
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
            <div className="p-5 text-sm text-text-secondary/70">No restaurants match current filters.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
  const ALL_PLANS = "__all_plans__";
  const ALL_STATUS = "__all_status__";
