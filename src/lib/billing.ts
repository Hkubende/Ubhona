import { ApiError, api } from "./api";
import {
  getCurrentPlan,
  getRestaurantProfile,
  type SubscriptionPlan,
  type RestaurantProfile,
} from "./restaurant";

export type BillingSnapshot = {
  subscription: {
    planId: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    paymentProvider: string;
  };
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    billingCycle: string;
  };
  entitlements: Array<{
    featureKey: string;
    enabled: boolean;
    usageLimit: number | null;
    currentUsage: number;
  }>;
  invoices: Array<{
    id: string;
    planId: string;
    amount: number;
    currency: string;
    status: string;
    issuedAt: string;
    paidAt: string | null;
    dueAt: string | null;
    paymentReference: string;
    provider: string;
    notes: string | null;
  }>;
  payments: Array<{
    id: string;
    invoiceId: string;
    amount: number;
    provider: string;
    method: string;
    status: string;
    transactionReference: string;
    providerReference: string | null;
    merchantRequestId: string | null;
    checkoutRequestId: string | null;
    phoneNumber: string | null;
    resultCode: string | null;
    resultDescription: string | null;
    reconciliationStatus: string;
    createdAt: string;
    completedAt: string | null;
  }>;
};

export async function getBillingSnapshot(): Promise<BillingSnapshot | null> {
  try {
    return await api.get<BillingSnapshot>("/billing/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    const profile = getRestaurantProfile();
    const current = getCurrentPlan(profile);
    return {
      subscription: {
        planId: current.plan,
        status: current.status,
        trialEndsAt: current.trialEndsAt || null,
        currentPeriodEnd: current.renewalDate || null,
        paymentProvider: "manual",
      },
      plan: {
        id: current.plan,
        name: current.label,
        price: 0,
        currency: "KES",
        billingCycle: "monthly",
      },
      entitlements: [],
      invoices: [],
      payments: [],
    };
  }
}

export async function upgradePlanViaBilling(input: {
  planId: SubscriptionPlan;
  billingCycle?: "monthly" | "annual";
  provider?: "mpesa" | "manual" | "stripe";
}) {
  return api.post<{
    subscription: BillingSnapshot["subscription"];
    entitlements: BillingSnapshot["entitlements"];
    invoices: BillingSnapshot["invoices"];
  }>("/billing/upgrade", input);
}

export async function initiateInvoicePayment(input: {
  invoiceId: string;
  provider?: "mpesa" | "manual" | "stripe";
  method?: string;
  customerPhone?: string;
}) {
  return api.post<{ ok: boolean; payment: BillingSnapshot["payments"][number] }>(
    `/billing/invoices/${encodeURIComponent(input.invoiceId)}/pay`,
    {
      provider: input.provider || "mpesa",
      method: input.method || input.provider || "mpesa",
      customerPhone: input.customerPhone,
    }
  );
}

export async function markInvoiceManualFallback(input: { invoiceId: string; notes?: string }) {
  return api.post<{ ok: boolean; payment: BillingSnapshot["payments"][number]; message: string }>(
    `/billing/invoices/${encodeURIComponent(input.invoiceId)}/manual-mark`,
    { notes: input.notes || "Manual payment fallback initiated." }
  );
}

export async function reconcileBillingPayment(paymentId: string) {
  return api.post<{
    ok: boolean;
    subscription: BillingSnapshot["subscription"];
    invoices: BillingSnapshot["invoices"];
    payments: BillingSnapshot["payments"];
  }>(`/billing/payments/${encodeURIComponent(paymentId)}/reconcile`, {});
}

export async function simulateBillingEvent(input: {
  eventType: "payment_completed" | "payment_failed" | "payment_timeout" | "payment_cancelled" | "subscription_renewed" | "trial_expired";
  paymentId?: string;
  invoiceId?: string;
}) {
  return api.post("/billing/dev/simulate", input);
}

export async function resetDevBillingState(input?: {
  planId?: "starter" | "growth" | "pro";
  status?: "trialing" | "active" | "past_due" | "cancelled" | "expired";
  resetUsage?: boolean;
  resetInvoices?: boolean;
}) {
  return api.post("/billing/dev/reset", input || {});
}

export function mergeBillingIntoProfile(
  profile: RestaurantProfile | null,
  billing: BillingSnapshot | null
): RestaurantProfile | null {
  if (!profile || !billing) return profile;
  return {
    ...profile,
    subscriptionPlan: (billing.subscription.planId as SubscriptionPlan) || profile.subscriptionPlan,
    subscriptionStatus: billing.subscription.status as RestaurantProfile["subscriptionStatus"],
    trialEndsAt: billing.subscription.trialEndsAt,
    renewalDate: billing.subscription.currentPeriodEnd,
    entitlements: billing.entitlements.map((item) => ({
      featureKey: item.featureKey,
      enabled: item.enabled,
      usageLimit: item.usageLimit,
      currentUsage: item.currentUsage,
    })),
  };
}
