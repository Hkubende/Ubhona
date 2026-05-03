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
import { useSeoMetadata } from "../lib/seo";

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

function formatMoney(amount: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentMethodLabel(method: string | null | undefined, provider: string | null | undefined) {
  const methodLabel = String(method || "").replaceAll("_", " ").trim();
  const providerLabel = String(provider || "").trim();
  if (!methodLabel && !providerLabel) return "Not configured";
  if (!methodLabel) return providerLabel.toUpperCase();
  if (!providerLabel) return methodLabel.replace(/\b\w/g, (match) => match.toUpperCase());
  return `${methodLabel.replace(/\b\w/g, (match) => match.toUpperCase())} via ${providerLabel.toUpperCase()}`;
}

export default function Pricing() {
  const navigate = useNavigate();
  const [restaurantProfile, setRestaurantProfile] = React.useState<RestaurantProfile | null>(null);
  const [busyPlan, setBusyPlan] = React.useState<SubscriptionPlan | null>(null);
  const [busyInvoiceId, setBusyInvoiceId] = React.useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const [billing, setBilling] = React.useState<Awaited<ReturnType<typeof getBillingSnapshot>>>(null);

  useSeoMetadata({
    title: "Pricing",
    description:
      "Compare Ubhona plans for AR menus, ordering, analytics, branding, and restaurant operations, from starter rollout to multi-branch growth.",
    path: "/pricing",
  });

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      const profile = await syncRestaurantProfile();
      const snapshot = await getBillingSnapshot();
      if (!mounted) return;
      setRestaurantProfile(profile || getRestaurantProfile());
      setBilling(snapshot);
    })();
    return () => {
      mounted = false;
    };
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

  const openInvoice = billing?.invoices.find((invoice) => invoice.status !== "paid") || null;
  const latestPayment = billing?.payments?.[0] || null;
  const statusMeta = subscriptionStatusMeta(billing?.subscription.status || current.status);
  const latestPaymentMeta = latestPayment ? paymentStatusMeta(latestPayment.status) : null;
  const openInvoiceMeta = openInvoice ? invoiceStatusMeta(openInvoice.status) : null;
  const invoices = billing?.invoices || [];
  const payments = billing?.payments || [];
  const nextBillingDate = openInvoice?.dueAt || billing?.subscription.currentPeriodEnd || billing?.subscription.trialEndsAt || null;
  const nextBillingAmount = openInvoice?.amount ?? billing?.plan.price ?? 0;
  const nextBillingCurrency = openInvoice?.currency || billing?.plan.currency || "KES";
  const paymentMethodSummary = latestPayment
    ? paymentMethodLabel(latestPayment.method, latestPayment.provider)
    : paymentMethodLabel(openInvoice?.provider || billing?.subscription.paymentProvider, billing?.subscription.paymentProvider);
  const isTrialing = (billing?.subscription.status || current.status) === "trialing";
  const billingIssueActive =
    statusMeta.label === "Action Required" ||
    Boolean(openInvoice) ||
    latestPaymentMeta?.label === "Payment Failed" ||
    latestPaymentMeta?.label === "Pending Confirmation";
  const plansRef = React.useRef<HTMLDivElement | null>(null);
  const historyRef = React.useRef<HTMLDivElement | null>(null);

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
    <div className="min-h-screen bg-app-bg text-text-primary">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="ui-surface mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
          <div>
            <div className="text-2xl font-black">
              <span className="text-primary">Ubhona</span> Billing & Plans
            </div>
            <div className="mt-1 text-sm text-text-secondary/72">
              Review subscription status, next billing action, and invoice history for your restaurant.
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="ui-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {billing ? (
          <div className="mb-5 space-y-4">
            <div className="ui-panel-inset rounded-3xl px-4 py-4 text-sm text-text-primary">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black">Billing Overview</div>
                  <div className="mt-1 text-sm text-text-secondary/72">
                    Clear visibility into your subscription, billing state, and next required action.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                  <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary/85">
                    {billing.plan.name}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-text-secondary/66">Current Plan</div>
                  <div className="mt-2 text-lg font-bold text-text-primary">{billing.plan.name}</div>
                  <div className="mt-1 text-xs text-text-secondary/72">{PLAN_PRICES[current.plan]}</div>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-text-secondary/66">Next Billing Date</div>
                  <div className="mt-2 text-lg font-bold text-text-primary">{formatDateLabel(nextBillingDate)}</div>
                  <div className="mt-1 text-xs text-text-secondary/72">
                    {billing.subscription.trialEndsAt
                      ? "Trial boundary or first paid billing checkpoint."
                      : openInvoice
                        ? "Due date for the current live invoice."
                        : "Upcoming billing checkpoint when paid billing is active."}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-text-secondary/66">Next Amount</div>
                  <div className="mt-2 text-lg font-bold text-text-primary">{formatMoney(nextBillingAmount, nextBillingCurrency)}</div>
                  <div className="mt-1 text-xs text-text-secondary/72">
                    {openInvoice
                      ? "Live invoice awaiting settlement."
                      : isTrialing
                        ? "Shown for plan planning. A charge is created only when paid billing starts."
                        : "Expected recurring plan amount."}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-text-secondary/66">Payment Method</div>
                  <div className="mt-2 text-lg font-bold text-text-primary">{paymentMethodSummary}</div>
                  <div className="mt-1 text-xs text-text-secondary/72">
                    {latestPayment ? `Last used on ${formatDateLabel(latestPayment.completedAt || latestPayment.createdAt)}.` : "No live billing method recorded yet."}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => navigate("/dashboard/settings")}
                  className="ui-button-secondary rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  Update Billing Method
                </button>
                <button
                  onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="ui-button-secondary rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  View Invoices
                </button>
                <button
                  onClick={() => plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="ui-button-secondary rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  Manage Subscription
                </button>
                {billingIssueActive ? (
                  <button
                    onClick={() => {
                      if (openInvoice) {
                        void onPayInvoice();
                        return;
                      }
                      historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="ui-button-primary rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    Resolve Billing Issue
                  </button>
                ) : null}
              </div>
            </div>

            <div className="ui-panel-inset rounded-2xl px-4 py-3 text-sm text-text-primary">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
                <span className="text-xs text-text-secondary/72">{statusMeta.hint}</span>
              </div>
              {!openInvoice && !latestPayment ? (
                <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-text-secondary/78">
                  {isTrialing
                    ? "Billing history will appear after the first live invoice or payment event. Your restaurant is currently on a free or trial state, so no paid billing action is required today."
                    : "Billing history will appear here after the next live invoice or payment event. No billing action is required right now."}
                </div>
              ) : null}
            </div>
            {latestPayment ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-text-secondary/72">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${latestPaymentMeta?.className || "border-white/15"}`}>
                  {latestPaymentMeta?.label || latestPayment.status}
                </span>
                <span>
                  Last payment via <span className="font-semibold text-text-primary">{latestPayment.provider.toUpperCase()}</span>
                </span>
                {latestPaymentMeta ? <span className="text-xs text-text-secondary/72">{latestPaymentMeta.hint}</span> : null}
              </div>
            ) : null}
            {openInvoice ? (
              <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${openInvoiceMeta?.className || "border-white/15"}`}>
                    {openInvoiceMeta?.label || openInvoice.status}
                  </span>
                  <span className="text-text-secondary/78">
                    Invoice {openInvoice.paymentReference}: {openInvoice.currency} {openInvoice.amount.toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-text-secondary/72">
                  Use M-Pesa STK when live billing is available. If the prompt fails or the provider does not confirm, switch to manual fallback.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    className="ui-input-control w-full max-w-[220px] rounded-xl px-3 py-1.5 text-xs outline-none"
                    placeholder="M-Pesa phone (+2547XXXXXXXX)"
                  />
                  <button
                    onClick={() => void onPayInvoice()}
                    disabled={busyInvoiceId === openInvoice.id}
                    className="ui-button-primary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    {busyInvoiceId === openInvoice.id ? "Processing..." : "Pay with M-Pesa STK"}
                  </button>
                  <button
                    onClick={() => void onManualFallback()}
                    disabled={busyInvoiceId === openInvoice.id}
                    className="ui-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    Manual fallback
                  </button>
                </div>
                <div className="flex items-start gap-2 text-xs text-text-secondary/68">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  Manual fallback does not mark the invoice paid immediately. It keeps the invoice pending until support or admin verification is completed.
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-200">
                <Sparkles className="h-4 w-4" />
                {isTrialing ? "No open invoices. Free or trial access is active." : "No open invoices. The current paid billing state is settled."}
              </div>
            )}
            {latestPayment && latestPayment.status === "pending" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-text-primary">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  Payment pending. Run reconciliation:
                </span>
                <button
                  onClick={() => void onReconcileLatest()}
                  disabled={busyInvoiceId === latestPayment.id}
                  className="ui-button-secondary rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  Reconcile
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={plansRef} className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => {
            const active = current.plan === plan;
            const config = PLAN_CONFIG[plan];
            return (
              <div
                key={plan}
                className={`rounded-3xl border p-5 ${
                  active
                    ? "border-primary/35 bg-primary/10"
                    : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xl font-black">
                  <span>{PLAN_TITLES[plan]}</span>
                  {active ? (
                    <span className="rounded-full border border-primary/25 bg-primary/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-primary">
                      Active
                    </span>
                  ) : null}
                </div>
                <div className="mb-3 text-sm text-text-secondary/68">{PLAN_PRICES[plan]}</div>
                <div className="mb-3 rounded-2xl border border-border bg-[color:var(--ui-note-icon-bg)] px-3 py-2 text-xs text-text-secondary/78">
                  Dish limit: {config.dishLimit == null ? "Unlimited" : config.dishLimit}
                </div>
                <ul className="space-y-2 text-sm text-text-primary">
                  {PLAN_POINTS[plan].map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => void onChangePlan(plan)}
                  disabled={active || busyPlan === plan}
                  className={`mt-5 w-full rounded-2xl px-4 py-2.5 text-sm font-bold ${
                    active
                      ? "border border-border bg-[color:var(--ui-note-icon-bg)] text-text-secondary/78"
                      : "ui-button-primary"
                  } disabled:opacity-60`}
                >
                  {active ? "Current Plan" : busyPlan === plan ? "Updating..." : `Choose ${PLAN_TITLES[plan]}`}
                </button>
              </div>
            );
          })}
        </div>

        <div ref={historyRef} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="ui-surface rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-black text-text-primary">Invoice History</div>
                <div className="mt-1 text-sm text-text-secondary/72">
                  Every invoice raised for this restaurant, including payment state and due dates.
                </div>
              </div>
              <div className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary/78">
                {invoices.length} invoices
              </div>
            </div>
            {invoices.length ? (
              <div className="mt-4 space-y-3">
                {invoices.map((invoice) => {
                  const meta = invoiceStatusMeta(invoice.status);
                  return (
                    <div key={invoice.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-text-primary">{invoice.paymentReference}</div>
                          <div className="mt-1 text-xs text-text-secondary/72">
                            Issued {formatDateLabel(invoice.issuedAt)} • Due {formatDateLabel(invoice.dueAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}>
                            {meta.label}
                          </span>
                          <span className="text-sm font-semibold text-text-primary">{formatMoney(invoice.amount, invoice.currency)}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary/72">
                        <span>Provider: <span className="font-semibold text-text-primary">{invoice.provider.toUpperCase()}</span></span>
                        <span>Paid: <span className="font-semibold text-text-primary">{formatDateLabel(invoice.paidAt)}</span></span>
                        {invoice.notes ? <span>Notes: {invoice.notes}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-text-secondary/78">
                No invoices yet. Once billing starts for a paid plan or renewal cycle, invoice records will appear here with due dates and payment outcomes.
              </div>
            )}
          </div>

          <div className="ui-surface rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-black text-text-primary">Payment Activity</div>
                <div className="mt-1 text-sm text-text-secondary/72">
                  Recent payment attempts, provider references, and reconciliation state.
                </div>
              </div>
              <div className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary/78">
                {payments.length} payments
              </div>
            </div>
            {payments.length ? (
              <div className="mt-4 space-y-3">
                {payments.map((payment) => {
                  const meta = paymentStatusMeta(payment.status);
                  return (
                    <div key={payment.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-text-primary">{payment.transactionReference}</div>
                          <div className="mt-1 text-xs text-text-secondary/72">
                            {paymentMethodLabel(payment.method, payment.provider)}
                          </div>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">
                        {formatMoney(payment.amount, billing?.plan.currency || "KES")}
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-text-secondary/72">
                        <div>Created: {formatDateTimeLabel(payment.createdAt)}</div>
                        <div>Completed: {formatDateTimeLabel(payment.completedAt)}</div>
                        <div>Reconciliation: <span className="font-semibold text-text-primary">{payment.reconciliationStatus || "pending"}</span></div>
                        {payment.providerReference ? <div>Provider ref: {payment.providerReference}</div> : null}
                        {payment.resultDescription ? <div>{payment.resultDescription}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-text-secondary/78">
                No payments recorded yet. The first M-Pesa or manual billing event will appear here with confirmation details and support-friendly references.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
