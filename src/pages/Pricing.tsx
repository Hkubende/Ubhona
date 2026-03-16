import * as React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentPlan,
  getRestaurantProfile,
  syncRestaurantProfile,
  updateSubscriptionPlan,
  type RestaurantProfile,
  type SubscriptionPlan,
  PLAN_CONFIG,
} from "../lib/restaurant";

const PLAN_ORDER: SubscriptionPlan[] = ["starter", "pro", "enterprise"];

const PLAN_TITLES: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_PRICES: Record<SubscriptionPlan, string> = {
  starter: "Free trial",
  pro: "KSh 4,999 / month",
  enterprise: "Contact sales",
};

const PLAN_POINTS: Record<SubscriptionPlan, string[]> = {
  starter: ["Up to 25 dishes", "Basic storefront branding", "Orders and checkout"],
  pro: ["Unlimited dishes", "AR + analytics", "Custom branding controls"],
  enterprise: ["Everything in Pro", "Staff accounts (foundation)", "Multi-branch (foundation)"],
};

export default function Pricing() {
  const navigate = useNavigate();
  const [restaurantProfile, setRestaurantProfile] = React.useState<RestaurantProfile | null>(null);
  const [busyPlan, setBusyPlan] = React.useState<SubscriptionPlan | null>(null);
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void syncRestaurantProfile().then((profile) => setRestaurantProfile(profile || getRestaurantProfile()));
  }, []);

  const current = React.useMemo(() => getCurrentPlan(restaurantProfile), [restaurantProfile]);

  const onChangePlan = async (plan: SubscriptionPlan) => {
    if (!restaurantProfile) {
      setError("Create restaurant profile first.");
      return;
    }
    if (current.plan === plan) return;
    setBusyPlan(plan);
    setError("");
    setNotice("");
    try {
      const updated = await updateSubscriptionPlan(plan);
      setRestaurantProfile(updated);
      setNotice(`Plan updated to ${PLAN_TITLES[plan]}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update plan.");
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <div>
            <div className="text-2xl font-black">
              <span className="text-orange-400">Ubhona</span> Pricing
            </div>
            <div className="text-sm text-white/60">
              Current plan: {current.label} ({current.status})
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
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

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => {
            const active = current.plan === plan;
            const config = PLAN_CONFIG[plan];
            return (
              <div
                key={plan}
                className={`rounded-3xl border p-5 ${
                  active
                    ? "border-orange-400/45 bg-orange-500/10"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="mb-1 text-xl font-black">{PLAN_TITLES[plan]}</div>
                <div className="mb-3 text-sm text-white/60">{PLAN_PRICES[plan]}</div>
                <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70">
                  Dish limit: {config.dishLimit == null ? "Unlimited" : config.dishLimit}
                </div>
                <ul className="space-y-2 text-sm text-white/85">
                  {PLAN_POINTS[plan].map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => void onChangePlan(plan)}
                  disabled={active || busyPlan === plan}
                  className={`mt-5 w-full rounded-2xl px-4 py-2.5 text-sm font-bold ${
                    active
                      ? "border border-white/15 bg-white/10 text-white/70"
                      : "bg-orange-500 text-black hover:bg-orange-400"
                  } disabled:opacity-60`}
                >
                  {active ? "Current Plan" : busyPlan === plan ? "Updating..." : `Choose ${PLAN_TITLES[plan]}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
