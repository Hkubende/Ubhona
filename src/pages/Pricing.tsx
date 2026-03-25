import * as React from "react";
import { ArrowLeft, Check, Clock3, ShieldAlert, Sparkles } from "lucide-react";
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
import {
  getBillingSnapshot,
  initiateInvoicePayment,
  markInvoiceManualFallback,
  reconcileBillingPayment,
  upgradePlanViaBilling,
} from "../lib/billing";
import { invoiceStatusMeta, paymentStatusMeta, subscriptionStatusMeta } from "../lib/billing-ui";

const PLAN_ORDER: SubscriptionPlan[] = ["starter", "growth", "pro"];

const PLAN_TITLES: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};

const PLAN_PRICES: Record<SubscriptionPlan, string> = {
  starter: "Free",
  growth: "KSh 4,999 / month",
  pro: "KSh 11,999 / month",
};

const PLAN_POINTS: Record<SubscriptionPlan, string[]> = {
  starter: ["Up to 25 dishes", "Up to 200 orders/month", "Powered by Ubhona footer"],
  growth: ["Unlimited dishes + orders", "AR + analytics", "Remove Ubhona branding"],
  pro: ["Everything in Growth", "Advanced analytics", "Staff accounts and multi-branch readiness"],
};

export default function Pricing() {
  const navigate = useNavigate();
  const [restaurantProfile, setRestaurantProfile] = React.useState<RestaurantProfile | null>(null);
  const [busyPlan, setBusyPlan] = React.useState<SubscriptionPlan | null>(null);
  const [busyInvoiceId, setBusyInvoiceId] = React.useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const [billing, setBilling] = React.useState<Awaited<ReturnType<typeof getBillingSnapshot>>>(null);

  React.useEffect(() => {
    void Promise.all([syncRestaurantProfile(), getBillingSnapshot()]).then(([profile, snapshot]) => {
      setRestaurantProfile(profile || getRestaurantProfile());
      setBilling(snapshot);
    });
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
      let updated: RestaurantProfile;
      try {
        await upgradePlanViaBilling({ planId: plan, provider: "manual" });
        const profile = await syncRestaurantProfile();
        updated = profile || getRestaurantProfile()!;
      } catch {
        updated = await updateSubscriptionPlan(plan);
      }
      setRestaurantProfile(updated);
      setBilling(await getBillingSnapshot());
      setNotice(`Plan updated to ${PLAN_TITLES[plan]}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update plan.");
    } finally {
      setBusyPlan(null);
    }
  };

  const openInvoice = billing?.invoices.find((invoice) => invoice.status === "pending" || invoice.status === "draft");
  const latestPayment = billing?.payments?.[0] || null;
  const statusMeta = subscriptionStatusMeta(billing?.subscription.status || current.status);
  const latestPaymentMeta = latestPayment ? paymentStatusMeta(latestPayment.status) : null;
  const openInvoiceMeta = openInvoice ? invoiceStatusMeta(openInvoice.status) : null;

  const onPayInvoice = async () => {
    if (!openInvoice) return;
    setBusyInvoiceId(openInvoice.id);
    setError("");
    setNotice("");
    try {
      await initiateInvoicePayment({
        invoiceId: openInvoice.id,
        provider: "mpesa",
        method: "mpesa_stk",
        customerPhone: customerPhone || undefined,
      });
      setBilling(await getBillingSnapshot());
      setNotice("M-Pesa prompt initiated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate payment.");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const onManualFallback = async () => {
    if (!openInvoice) return;
    setBusyInvoiceId(openInvoice.id);
    setError("");
    setNotice("");
    try {
      await markInvoiceManualFallback({ invoiceId: openInvoice.id, notes: "Requested from pricing page fallback." });
      setBilling(await getBillingSnapshot());
      setNotice("Manual fallback started. Invoice is pending verification.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start manual fallback.");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const onReconcileLatest = async () => {
    if (!latestPayment?.id) return;
    setBusyInvoiceId(latestPayment.id);
    setError("");
    setNotice("");
    try {
      await reconcileBillingPayment(latestPayment.id);
      setBilling(await getBillingSnapshot());
      setNotice("Payment reconciliation executed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconcile payment.");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#F7F1E8]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-[#0D0B0B] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
          <div>
            <div className="text-2xl font-black">
              <span className="text-[#FF6A1A]">Ubhona</span> Billing & Plans
            </div>
            <div className="mt-1 text-sm text-[#B8AEA3]">
              Current plan: <span className="font-semibold text-[#F7F1E8]">{current.label}</span>
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
        {billing ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-[#141010] px-4 py-3 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
              <span className="text-xs text-[#B8AEA3]">{statusMeta.hint}</span>
            </div>
            {latestPayment ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-white/65">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${latestPaymentMeta?.className || "border-white/15"}`}>
                  {latestPaymentMeta?.label || latestPayment.status}
                </span>
                <span>
                  Last payment via <span className="font-semibold text-white">{latestPayment.provider.toUpperCase()}</span>
                </span>
                {latestPaymentMeta ? <span className="text-xs text-[#B8AEA3]">{latestPaymentMeta.hint}</span> : null}
              </div>
            ) : null}
            {openInvoice ? (
              <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${openInvoiceMeta?.className || "border-white/15"}`}>
                    {openInvoiceMeta?.label || openInvoice.status}
                  </span>
                  <span className="text-white/70">
                    Invoice {openInvoice.paymentReference}: {openInvoice.currency} {openInvoice.amount.toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-[#B8AEA3]">
                  Use M-Pesa STK for instant activation. If prompt fails, switch to manual fallback.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    className="w-full max-w-[220px] rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs outline-none"
                    placeholder="M-Pesa phone (+2547XXXXXXXX)"
                  />
                  <button
                    onClick={() => void onPayInvoice()}
                    disabled={busyInvoiceId === openInvoice.id}
                    className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                  >
                    {busyInvoiceId === openInvoice.id ? "Processing..." : "Pay with M-Pesa STK"}
                  </button>
                  <button
                    onClick={() => void onManualFallback()}
                    disabled={busyInvoiceId === openInvoice.id}
                    className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.1] disabled:opacity-60"
                  >
                    Manual fallback
                  </button>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/60">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F58A1F]" />
                  If STK is unavailable, manual fallback keeps invoice pending until verified by support/admin.
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-200">
                <Sparkles className="h-4 w-4" />
                No open invoices. Plan is currently settled.
              </div>
            )}
            {latestPayment && latestPayment.status === "pending" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-[#F7F1E8]">
                  <Clock3 className="h-3.5 w-3.5 text-[#F58A1F]" />
                  Payment pending. Run reconciliation:
                </span>
                <button
                  onClick={() => void onReconcileLatest()}
                  disabled={busyInvoiceId === latestPayment.id}
                  className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.1] disabled:opacity-60"
                >
                  Reconcile
                </button>
              </div>
            ) : null}
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
                <div className="mb-1 flex items-center justify-between gap-2 text-xl font-black">
                  <span>{PLAN_TITLES[plan]}</span>
                  {active ? (
                    <span className="rounded-full border border-[#FF6A1A]/30 bg-[#FF6A1A]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#F7F1E8]">
                      Active
                    </span>
                  ) : null}
                </div>
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
