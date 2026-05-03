import { runWithPublicStorefrontDbContext } from "../db-rls.js";
import { prisma } from "../prisma.js";
import { findRestaurantDocumentByKey, upsertRestaurantDocument } from "./tenant-document.service.js";
import { getBillingProvider } from "./billing-provider.service.js";
import { recordActivityEvent } from "./activity.service.js";
import { BILLING_PROVIDER_CALLBACK_SYSTEM_ACTOR_KEY, BILLING_PROVIDER_CALLBACK_SYSTEM_ROLE } from "./system-actors.js";
import type {
  BillingCycle,
  BillingEvent,
  BillingEventType,
  BillingInvoice,
  BillingPayment,
  FeatureEntitlement,
  PaymentProvider,
  PlanDefinition,
  PlanFeatureKey,
  PlanLimitKey,
  RestaurantBillingState,
  SubscriptionStatus,
} from "./billing.types.js";

const BILLING_DOC_PREFIX = "billing-state:";

type RestaurantRecord = {
  id: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: Date;
  trialEndsAt: Date | null;
  renewalDate: Date | null;
};
export type BillingRestaurantRecord = RestaurantRecord;

const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 0,
    currency: "KES",
    billingCycle: "monthly",
    features: {
      analytics: false,
      ar: false,
      customBranding: false,
      advancedAnalytics: false,
      printing: true,
      waiterAccounts: false,
      staffAccounts: false,
      multiBranch: false,
    },
    limits: { dishes: 25, ordersPerMonth: 200 },
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 4999,
    currency: "KES",
    billingCycle: "monthly",
    features: {
      analytics: true,
      ar: true,
      customBranding: true,
      advancedAnalytics: false,
      printing: true,
      waiterAccounts: true,
      staffAccounts: false,
      multiBranch: false,
    },
    limits: { dishes: null, ordersPerMonth: null },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 11999,
    currency: "KES",
    billingCycle: "monthly",
    features: {
      analytics: true,
      ar: true,
      customBranding: true,
      advancedAnalytics: true,
      printing: true,
      waiterAccounts: true,
      staffAccounts: true,
      multiBranch: true,
    },
    limits: { dishes: null, ordersPerMonth: null },
  },
};

const FEATURE_KEYS: PlanFeatureKey[] = [
  "analytics",
  "ar",
  "customBranding",
  "advancedAnalytics",
  "printing",
  "waiterAccounts",
  "staffAccounts",
  "multiBranch",
];
const LIMIT_KEYS: PlanLimitKey[] = ["dishes", "ordersPerMonth"];
const FEATURE_GATE_ALLOWED_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

function nowIso() {
  return new Date().toISOString();
}

function plusDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function monthStart(date = new Date()) {
  const copy = new Date(date);
  copy.setUTCDate(1);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function monthEnd(date = new Date()) {
  const start = monthStart(date);
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCMilliseconds(-1);
  return next;
}

function normalizePlanId(planId: unknown) {
  const plan = String(planId || "").trim().toLowerCase();
  if (plan === "enterprise") return "pro";
  if (plan === "growth" || plan === "pro") return plan;
  return "starter";
}

function normalizeSubscriptionStatus(status: unknown): SubscriptionStatus {
  const value = String(status || "").trim().toLowerCase();
  if (value === "active" || value === "past_due" || value === "cancelled" || value === "expired") return value;
  return "trialing";
}

function billingKey(restaurantId: string) {
  return `${BILLING_DOC_PREFIX}${restaurantId}`;
}

function randomToken() {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}

function parseBillingState(value: unknown): RestaurantBillingState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<RestaurantBillingState>;
  if (!row.restaurantId || !row.subscription || !Array.isArray(row.entitlements)) return null;
  return row as RestaurantBillingState;
}

async function loadBillingState(restaurantId: string) {
  return runWithPublicStorefrontDbContext(restaurantId, async () => {
    const doc = await findRestaurantDocumentByKey({
      restaurantId,
      key: billingKey(restaurantId),
    });
    return doc ? parseBillingState(doc.payload) : null;
  });
}

async function saveBillingState(state: RestaurantBillingState) {
  await runWithPublicStorefrontDbContext(state.restaurantId, async () => {
    await upsertRestaurantDocument({
      restaurantId: state.restaurantId,
      key: billingKey(state.restaurantId),
      payload: state as unknown as object,
    });
  });
}

async function computeUsage(restaurantId: string) {
  // Billing recomputation runs as a system aggregate job, so it uses a
  // synthetic tenant-bound context rather than an authenticated app actor.
  return runWithPublicStorefrontDbContext(restaurantId, async () => {
    const [dishes, ordersThisMonth] = await Promise.all([
      prisma.dish.count(),
      prisma.order.count({
        where: {
          createdAt: {
            gte: monthStart(),
            lte: monthEnd(),
          },
        },
      }),
    ]);
    return { dishes, ordersPerMonth: ordersThisMonth } satisfies Record<PlanLimitKey, number>;
  });
}

function buildEntitlements(restaurantId: string, planId: string, usage: Record<PlanLimitKey, number>) {
  const plan = PLAN_DEFINITIONS[planId] || PLAN_DEFINITIONS.starter;
  const entitlements: FeatureEntitlement[] = [];
  for (const key of FEATURE_KEYS) {
    entitlements.push({
      restaurantId,
      planId: plan.id,
      featureKey: key,
      enabled: Boolean(plan.features[key]),
      usageLimit: null,
      currentUsage: 0,
    });
  }
  for (const key of LIMIT_KEYS) {
    entitlements.push({
      restaurantId,
      planId: plan.id,
      featureKey: key,
      enabled: true,
      usageLimit: plan.limits[key],
      currentUsage: usage[key] || 0,
    });
  }
  return entitlements;
}

function upsertEvent(state: RestaurantBillingState, event: BillingEvent) {
  if (state.events.some((row) => row.eventKey === event.eventKey)) return false;
  state.events = [event, ...state.events].slice(0, 150);
  return true;
}

function getSubscriptionId(state: RestaurantBillingState) {
  return `${state.restaurantId}:${state.subscription.planId}`;
}

async function persistSubscriptionProjection(state: RestaurantBillingState) {
  await prisma.restaurant.update({
    where: { id: state.restaurantId },
    data: {
      subscriptionPlan: state.subscription.planId,
      subscriptionStatus: state.subscription.status,
      trialEndsAt: state.subscription.trialEndsAt ? new Date(state.subscription.trialEndsAt) : null,
      renewalDate: state.subscription.currentPeriodEnd ? new Date(state.subscription.currentPeriodEnd) : null,
    },
  });
}

function setInvoiceStatus(invoice: BillingInvoice, status: BillingInvoice["status"]) {
  const now = nowIso();
  if (status === "paid") return { ...invoice, status, paidAt: now };
  return { ...invoice, status };
}

function projectPaymentEventToState(
  state: RestaurantBillingState,
  input: {
    paymentId?: string;
    invoiceId?: string;
    paymentStatus?: BillingPayment["status"];
    resultCode?: string | null;
    resultDescription?: string | null;
    callbackPayload?: Record<string, unknown> | null;
    providerReference?: string | null;
    checkoutRequestId?: string | null;
    merchantRequestId?: string | null;
  }
) {
  const now = nowIso();
  if (input.paymentId) {
    state.payments = state.payments.map((payment) =>
      payment.id !== input.paymentId
        ? payment
        : {
            ...payment,
            status: input.paymentStatus || payment.status,
            resultCode: input.resultCode ?? payment.resultCode,
            resultDescription: input.resultDescription ?? payment.resultDescription,
            providerReference: input.providerReference ?? payment.providerReference,
            checkoutRequestId: input.checkoutRequestId ?? payment.checkoutRequestId,
            merchantRequestId: input.merchantRequestId ?? payment.merchantRequestId,
            callbackPayload: input.callbackPayload ?? payment.callbackPayload,
            reconciliationStatus:
              input.paymentStatus === "succeeded" || input.paymentStatus === "failed"
                ? "reconciled"
                : payment.reconciliationStatus,
            completedAt:
              input.paymentStatus === "succeeded" || input.paymentStatus === "failed" ? now : payment.completedAt,
          }
    );
  }
  if (input.invoiceId) {
    if (input.paymentStatus === "succeeded") {
      state.invoices = state.invoices.map((invoice) =>
        invoice.id === input.invoiceId ? setInvoiceStatus(invoice, "paid") : invoice
      );
      state.subscription.status = "active";
      state.subscription.currentPeriodStart = now;
      state.subscription.currentPeriodEnd =
        state.subscription.billingCycle === "annual" ? plusDaysIso(365) : plusDaysIso(30);
    } else if (input.paymentStatus === "failed" || input.paymentStatus === "timeout" || input.paymentStatus === "cancelled") {
      state.invoices = state.invoices.map((invoice) =>
        invoice.id === input.invoiceId ? setInvoiceStatus(invoice, "failed") : invoice
      );
      state.subscription.status = "past_due";
    }
  }
}

export function getPlanDefinition(planId: string) {
  return PLAN_DEFINITIONS[normalizePlanId(planId)];
}

export async function ensureBillingStateForRestaurant(restaurant: RestaurantRecord) {
  const existing = await loadBillingState(restaurant.id);
  if (existing) {
    const usage = await computeUsage(restaurant.id);
    existing.entitlements = buildEntitlements(restaurant.id, existing.subscription.planId, usage);
    await saveBillingState(existing);
    return existing;
  }

  const planId = normalizePlanId(restaurant.subscriptionPlan);
  const usage = await computeUsage(restaurant.id);
  const state: RestaurantBillingState = {
    restaurantId: restaurant.id,
    subscription: {
      restaurantId: restaurant.id,
      planId,
      status: normalizeSubscriptionStatus(restaurant.subscriptionStatus),
      billingCycle: "monthly",
      startedAt: restaurant.createdAt.toISOString(),
      trialEndsAt: restaurant.trialEndsAt?.toISOString() || plusDaysIso(14),
      currentPeriodStart: monthStart().toISOString(),
      currentPeriodEnd: monthEnd().toISOString(),
      cancelledAt: null,
      paymentProvider: "manual",
      externalSubscriptionId: null,
    },
    entitlements: buildEntitlements(restaurant.id, planId, usage),
    invoices: [],
    payments: [],
    events: [],
  };
  await saveBillingState(state);
  return state;
}

export async function getRestaurantBillingSnapshot(restaurant: RestaurantRecord) {
  const state = await ensureBillingStateForRestaurant(restaurant);
  return {
    subscription: state.subscription,
    plan: getPlanDefinition(state.subscription.planId),
    entitlements: state.entitlements,
    invoices: state.invoices,
    payments: state.payments,
    events: state.events,
  };
}

export async function getCurrentSubscription(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      createdAt: true,
      trialEndsAt: true,
      renewalDate: true,
    },
  });
  if (!restaurant) throw new Error("Restaurant not found.");
  const state = await ensureBillingStateForRestaurant(restaurant);
  return state.subscription;
}

export async function getEntitlements(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      createdAt: true,
      trialEndsAt: true,
      renewalDate: true,
    },
  });
  if (!restaurant) throw new Error("Restaurant not found.");
  const state = await ensureBillingStateForRestaurant(restaurant);
  return state.entitlements;
}

export async function canUseFeature(restaurantId: string, featureKey: PlanFeatureKey) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      createdAt: true,
      trialEndsAt: true,
      renewalDate: true,
    },
  });
  if (!restaurant) throw new Error("Restaurant not found.");
  const state = await ensureBillingStateForRestaurant(restaurant);
  const hasActiveSubscription = FEATURE_GATE_ALLOWED_STATUSES.includes(state.subscription.status);
  if (!hasActiveSubscription) return false;
  return Boolean(state.entitlements.find((item) => item.featureKey === featureKey)?.enabled);
}

export async function isRestaurantFeatureEnabled(restaurant: RestaurantRecord, featureKey: PlanFeatureKey) {
  const state = await ensureBillingStateForRestaurant(restaurant);
  const hasActiveSubscription = FEATURE_GATE_ALLOWED_STATUSES.includes(state.subscription.status);
  if (!hasActiveSubscription) return false;
  return Boolean(state.entitlements.find((item) => item.featureKey === featureKey)?.enabled);
}

export async function getUsageStatus(restaurantId: string, key: PlanLimitKey) {
  const entitlements = await getEntitlements(restaurantId);
  const limit = entitlements.find((item) => item.featureKey === key);
  const usageLimit = limit?.usageLimit ?? null;
  const currentUsage = limit?.currentUsage ?? 0;
  return {
    usageLimit,
    currentUsage,
    reached: usageLimit != null && currentUsage >= usageLimit,
    remaining: usageLimit == null ? null : Math.max(0, usageLimit - currentUsage),
  };
}

export async function getRestaurantLimitStatus(restaurant: RestaurantRecord, key: PlanLimitKey) {
  const state = await ensureBillingStateForRestaurant(restaurant);
  const limit = state.entitlements.find((item) => item.featureKey === key);
  const usageLimit = limit?.usageLimit ?? null;
  const currentUsage = limit?.currentUsage ?? 0;
  return {
    usageLimit,
    currentUsage,
    reached: usageLimit != null && currentUsage >= usageLimit,
    remaining: usageLimit == null ? null : Math.max(0, usageLimit - currentUsage),
  };
}

export async function applyPlanEntitlements(planId: string, restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      createdAt: true,
      trialEndsAt: true,
      renewalDate: true,
    },
  });
  if (!restaurant) throw new Error("Restaurant not found.");
  const state = await ensureBillingStateForRestaurant(restaurant);
  const usage = await computeUsage(restaurantId);
  state.subscription.planId = normalizePlanId(planId);
  state.entitlements = buildEntitlements(restaurantId, state.subscription.planId, usage);
  await saveBillingState(state);
  await persistSubscriptionProjection(state);
  return state.entitlements;
}

export async function revokePlanEntitlements(restaurantId: string) {
  return applyPlanEntitlements("starter", restaurantId);
}

export async function incrementRestaurantUsage(restaurant: RestaurantRecord, key: PlanLimitKey, amount = 1) {
  if (!Number.isFinite(amount) || amount <= 0) return getRestaurantLimitStatus(restaurant, key);
  const state = await ensureBillingStateForRestaurant(restaurant);
  state.entitlements = state.entitlements.map((item) =>
    item.featureKey === key ? { ...item, currentUsage: Math.max(0, item.currentUsage + amount) } : item
  );
  await saveBillingState(state);
  return getRestaurantLimitStatus(restaurant, key);
}

export async function decrementRestaurantUsage(restaurant: RestaurantRecord, key: PlanLimitKey, amount = 1) {
  if (!Number.isFinite(amount) || amount <= 0) return getRestaurantLimitStatus(restaurant, key);
  const state = await ensureBillingStateForRestaurant(restaurant);
  state.entitlements = state.entitlements.map((item) =>
    item.featureKey === key ? { ...item, currentUsage: Math.max(0, item.currentUsage - amount) } : item
  );
  await saveBillingState(state);
  return getRestaurantLimitStatus(restaurant, key);
}

export async function upgradeRestaurantPlan(input: {
  restaurant: RestaurantRecord;
  planId: string;
  billingCycle?: BillingCycle;
  provider?: PaymentProvider;
}) {
  const plan = getPlanDefinition(input.planId);
  const state = await ensureBillingStateForRestaurant(input.restaurant);
  const now = nowIso();
  const cycle = input.billingCycle || "monthly";
  const provider = input.provider || state.subscription.paymentProvider || "manual";
  state.subscription.planId = plan.id;
  state.subscription.billingCycle = cycle;
  state.subscription.paymentProvider = provider;
  state.subscription.currentPeriodStart = now;
  state.subscription.currentPeriodEnd = cycle === "annual" ? plusDaysIso(365) : plusDaysIso(30);
  state.subscription.status = plan.price > 0 ? "past_due" : "active";
  state.subscription.cancelledAt = null;

  const usage = await computeUsage(input.restaurant.id);
  state.entitlements = buildEntitlements(input.restaurant.id, plan.id, usage);

  if (plan.price > 0) {
    const invoice: BillingInvoice = {
      id: `inv_${Date.now().toString(36)}`,
      restaurantId: input.restaurant.id,
      subscriptionId: getSubscriptionId(state),
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency,
      status: "pending",
      issuedAt: now,
      paidAt: null,
      dueAt: plusDaysIso(7),
      paymentReference: `UBHONA-${randomToken()}`,
      provider,
      notes: "Subscription upgrade invoice.",
    };
    state.invoices = [invoice, ...state.invoices.filter((row) => row.status !== "pending")].slice(0, 80);
  }

  await saveBillingState(state);
  await persistSubscriptionProjection(state);
  return state;
}

export async function initiateInvoicePayment(input: {
  restaurant: RestaurantRecord;
  invoiceId: string;
  provider: PaymentProvider;
  method: string;
  customerPhone?: string;
}) {
  const state = await ensureBillingStateForRestaurant(input.restaurant);
  const invoice = state.invoices.find((row) => row.id === input.invoiceId);
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "paid") throw new Error("Invoice already paid.");

  const provider = getBillingProvider(input.provider);
  const result = await provider.initiatePayment({
    restaurantId: input.restaurant.id,
    invoice,
    amount: invoice.amount,
    currency: invoice.currency,
    customerPhone: input.customerPhone,
  });

  const payment: BillingPayment = {
    id: `pay_${Date.now().toString(36)}`,
    restaurantId: input.restaurant.id,
    invoiceId: invoice.id,
    method: input.method,
    provider: input.provider,
    amount: invoice.amount,
    status: result.internalStatus,
    transactionReference: result.transactionReference,
    providerReference: result.providerReference,
    merchantRequestId: result.merchantRequestId,
    checkoutRequestId: result.checkoutRequestId,
    phoneNumber: input.customerPhone || null,
    resultCode: result.resultCode || null,
    resultDescription: result.resultDescription || null,
    callbackPayload: null,
    reconciliationStatus: "pending",
    createdAt: nowIso(),
    completedAt: result.internalStatus === "succeeded" || result.internalStatus === "failed" ? nowIso() : null,
  };
  state.payments = [payment, ...state.payments].slice(0, 120);
  state.invoices = state.invoices.map((row) =>
    row.id === invoice.id ? { ...row, status: result.internalStatus === "succeeded" ? "paid" : "pending" } : row
  );

  const event: BillingEvent = {
    id: `evt_${Date.now().toString(36)}`,
    restaurantId: input.restaurant.id,
    provider: input.provider,
    eventType: "payment_initiated",
    createdAt: nowIso(),
    eventKey: `payment-initiated:${payment.id}`,
    payload: {
      invoiceId: invoice.id,
      paymentId: payment.id,
      transactionReference: payment.transactionReference,
      providerReference: payment.providerReference,
    },
  };
  upsertEvent(state, event);

  projectPaymentEventToState(state, {
    paymentId: payment.id,
    invoiceId: invoice.id,
    paymentStatus: payment.status,
    providerReference: payment.providerReference,
    checkoutRequestId: payment.checkoutRequestId,
    merchantRequestId: payment.merchantRequestId,
    resultCode: payment.resultCode,
    resultDescription: payment.resultDescription,
  });

  await saveBillingState(state);
  await persistSubscriptionProjection(state);
  return payment;
}

export async function reconcileBillingPayment(input: {
  restaurant: RestaurantRecord;
  paymentId: string;
}) {
  const state = await ensureBillingStateForRestaurant(input.restaurant);
  const payment = state.payments.find((row) => row.id === input.paymentId);
  if (!payment) throw new Error("Payment not found.");
  const provider = getBillingProvider(payment.provider);
  const reconciliation = await provider.reconcilePayment({
    paymentReference: payment.providerReference || payment.transactionReference,
    transactionReference: payment.transactionReference,
  });
  projectPaymentEventToState(state, {
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    paymentStatus: reconciliation.internalStatus,
    providerReference: reconciliation.providerReference,
    resultCode: reconciliation.resultCode || null,
    resultDescription: reconciliation.resultDescription || null,
    callbackPayload: reconciliation.raw,
  });
  const event: BillingEvent = {
    id: `evt_${Date.now().toString(36)}`,
    restaurantId: input.restaurant.id,
    provider: payment.provider,
    eventType:
      reconciliation.internalStatus === "succeeded"
        ? "payment_completed"
        : reconciliation.internalStatus === "failed"
          ? "payment_failed"
          : "payment_reconciled",
    createdAt: nowIso(),
    eventKey: `payment-reconciled:${payment.id}:${reconciliation.internalStatus}`,
    payload: { paymentId: payment.id, reconciliation },
  };
  upsertEvent(state, event);
  await saveBillingState(state);
  await persistSubscriptionProjection(state);
  return state;
}

export async function applyBillingEvent(input: {
  restaurant: RestaurantRecord;
  provider: PaymentProvider;
  eventType: BillingEventType;
  payload: Record<string, unknown>;
  eventKey?: string;
}) {
  const state = await ensureBillingStateForRestaurant(input.restaurant);
  const now = nowIso();
  const event: BillingEvent = {
    id: `evt_${Date.now().toString(36)}`,
    restaurantId: input.restaurant.id,
    provider: input.provider,
    eventType: input.eventType,
    createdAt: now,
    eventKey: input.eventKey || `${input.provider}:${input.eventType}:${String(input.payload.paymentId || now)}`,
    payload: input.payload,
  };
  if (!upsertEvent(state, event)) return state;

  const paymentId = String(input.payload.paymentId || "");
  const invoiceId = String(input.payload.invoiceId || "");
  if (input.eventType === "payment_completed" || input.eventType === "invoice_paid" || input.eventType === "payment_succeeded") {
    projectPaymentEventToState(state, {
      paymentId: paymentId || undefined,
      invoiceId: invoiceId || undefined,
      paymentStatus: "succeeded",
      resultCode: String(input.payload.resultCode || "0"),
      resultDescription: String(input.payload.resultDescription || "Payment successful."),
      callbackPayload: input.payload,
      providerReference: String(input.payload.providerReference || "") || null,
      checkoutRequestId: String(input.payload.checkoutRequestId || "") || null,
      merchantRequestId: String(input.payload.merchantRequestId || "") || null,
    });
  } else if (
    input.eventType === "payment_failed" ||
    input.eventType === "payment_timeout" ||
    input.eventType === "payment_cancelled"
  ) {
    projectPaymentEventToState(state, {
      paymentId: paymentId || undefined,
      invoiceId: invoiceId || undefined,
      paymentStatus:
        input.eventType === "payment_timeout"
          ? "timeout"
          : input.eventType === "payment_cancelled"
            ? "cancelled"
            : "failed",
      resultCode: String(input.payload.resultCode || ""),
      resultDescription: String(input.payload.resultDescription || ""),
      callbackPayload: input.payload,
      providerReference: String(input.payload.providerReference || "") || null,
      checkoutRequestId: String(input.payload.checkoutRequestId || "") || null,
      merchantRequestId: String(input.payload.merchantRequestId || "") || null,
    });
  } else if (input.eventType === "subscription_activated" || input.eventType === "subscription_renewed") {
    state.subscription.status = "active";
    state.subscription.currentPeriodStart = now;
    state.subscription.currentPeriodEnd = state.subscription.billingCycle === "annual" ? plusDaysIso(365) : plusDaysIso(30);
  } else if (input.eventType === "subscription_cancelled") {
    state.subscription.status = "cancelled";
    state.subscription.cancelledAt = now;
  } else if (input.eventType === "trial_expired") {
    state.subscription.status = "expired";
    state.entitlements = buildEntitlements(state.restaurantId, "starter", await computeUsage(state.restaurantId));
  }

  await saveBillingState(state);
  await persistSubscriptionProjection(state);
  return state;
}

function buildProviderCallbackEventKey(input: {
  provider: PaymentProvider;
  eventType: BillingEventType;
  callbackEventKey?: string | null;
  paymentId?: string | null;
  invoiceId?: string | null;
  transactionReference?: string | null;
  checkoutRequestId?: string | null;
}) {
  if (input.callbackEventKey) return input.callbackEventKey;
  return [
    input.provider,
    input.eventType,
    input.paymentId || input.invoiceId || input.transactionReference || input.checkoutRequestId || "callback",
  ].join(":");
}

export async function applyProviderCallback(input: {
  provider: PaymentProvider;
  payload: Record<string, unknown>;
  restaurantId?: string;
}) {
  const provider = getBillingProvider(input.provider);
  const callback = await provider.handleCallback(input.payload);

  let restaurant: RestaurantRecord | null = null;
  if (input.restaurantId) {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: {
        id: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        createdAt: true,
        trialEndsAt: true,
        renewalDate: true,
      },
    });
  }
  if (!restaurant) {
    const payloadRestaurantId = String((input.payload.restaurantId as string) || "").trim();
    if (payloadRestaurantId) {
      restaurant = await prisma.restaurant.findUnique({
        where: { id: payloadRestaurantId },
        select: {
          id: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          createdAt: true,
          trialEndsAt: true,
          renewalDate: true,
        },
      });
    }
  }
  if (!restaurant) throw new Error("Restaurant not found for callback.");

  const state = await ensureBillingStateForRestaurant(restaurant);
  const payment = state.payments.find(
    (row) =>
      row.transactionReference === callback.transactionReference ||
      (callback.providerReference && row.providerReference === callback.providerReference) ||
      (callback.checkoutRequestId && row.checkoutRequestId === callback.checkoutRequestId)
  );
  const resolvedInvoiceId = payment?.invoiceId || String(input.payload.invoiceId || "");
  const eventType =
    callback.internalStatus === "succeeded"
      ? "payment_completed"
      : callback.internalStatus === "timeout"
        ? "payment_timeout"
        : callback.internalStatus === "cancelled"
          ? "payment_cancelled"
          : callback.internalStatus === "failed"
            ? "payment_failed"
            : "payment_reconciled";
  const eventKey = buildProviderCallbackEventKey({
    provider: input.provider,
    eventType,
    callbackEventKey: callback.eventKey,
    paymentId: payment?.id,
    invoiceId: resolvedInvoiceId || null,
    transactionReference: callback.transactionReference,
    checkoutRequestId: callback.checkoutRequestId,
  });
  const eventPayload = {
    ...callback.payload,
    paymentId: payment?.id,
    invoiceId: resolvedInvoiceId || undefined,
    transactionReference: callback.transactionReference,
    providerReference: callback.providerReference,
    merchantRequestId: callback.merchantRequestId,
    checkoutRequestId: callback.checkoutRequestId,
    resultCode: callback.resultCode,
    resultDescription: callback.resultDescription,
  };
  const alreadyRecorded = state.events.some((row) => row.eventKey === eventKey);

  // Only the top-level provider callback ingress gets explicit system audit coverage.
  // The lower-level billing projector stays audit-free to avoid duplicate rows for
  // the same billing event being persisted through different call sites.
  const nextState = await applyBillingEvent({
    restaurant,
    provider: input.provider,
    eventType,
    eventKey,
    payload: eventPayload,
  });

  if (!alreadyRecorded) {
    await recordActivityEvent({
      systemActorKey: BILLING_PROVIDER_CALLBACK_SYSTEM_ACTOR_KEY,
      actorRole: BILLING_PROVIDER_CALLBACK_SYSTEM_ROLE,
      action: "billing_provider_callback_processed",
      entityType: payment?.id ? "billing_payment" : resolvedInvoiceId ? "billing_invoice" : "billing_event",
      entityId: payment?.id || resolvedInvoiceId || eventKey,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      source: "billing_provider_callback",
      metadata: {
        provider: input.provider,
        billingEventType: eventType,
        paymentId: payment?.id || null,
        invoiceId: resolvedInvoiceId || null,
        transactionReference: callback.transactionReference || null,
        providerReference: callback.providerReference || null,
        merchantRequestId: callback.merchantRequestId || null,
        checkoutRequestId: callback.checkoutRequestId || null,
        resultCode: callback.resultCode || null,
        resultDescription: callback.resultDescription || null,
        eventKey,
      },
    });
  }

  return nextState;
}

export async function markInvoiceManualPayment(input: {
  restaurant: RestaurantRecord;
  invoiceId: string;
  notes?: string;
  actorUserId?: string;
}) {
  const state = await ensureBillingStateForRestaurant(input.restaurant);
  const invoice = state.invoices.find((row) => row.id === input.invoiceId);
  if (!invoice) throw new Error("Invoice not found.");

  const payment: BillingPayment = {
    id: `pay_${Date.now().toString(36)}`,
    restaurantId: input.restaurant.id,
    invoiceId: invoice.id,
    method: "manual",
    provider: "manual",
    amount: invoice.amount,
    status: "requires_verification",
    transactionReference: `MANUAL-${invoice.paymentReference}-${randomToken()}`,
    providerReference: null,
    merchantRequestId: null,
    checkoutRequestId: null,
    phoneNumber: null,
    resultCode: null,
    resultDescription: input.notes || "Marked pending manual verification.",
    callbackPayload: null,
    reconciliationStatus: "pending",
    createdAt: nowIso(),
    completedAt: null,
  };
  state.payments = [payment, ...state.payments].slice(0, 120);
  state.invoices = state.invoices.map((row) =>
    row.id === invoice.id ? { ...row, status: "pending", notes: input.notes || row.notes } : row
  );
  upsertEvent(state, {
    id: `evt_${Date.now().toString(36)}`,
    restaurantId: input.restaurant.id,
    provider: "manual",
    eventType: "payment_initiated",
    createdAt: nowIso(),
    eventKey: `manual-mark:${invoice.id}:${payment.id}`,
    payload: { invoiceId: invoice.id, paymentId: payment.id, notes: input.notes || null, actorUserId: input.actorUserId || null },
  });
  await saveBillingState(state);
  return payment;
}

export async function confirmManualPayment(input: {
  restaurant: RestaurantRecord;
  invoiceId: string;
  paymentId?: string;
  notes?: string;
  actorUserId?: string;
}) {
  const state = await ensureBillingStateForRestaurant(input.restaurant);
  const invoice = state.invoices.find((row) => row.id === input.invoiceId);
  if (!invoice) throw new Error("Invoice not found.");
  const payment =
    state.payments.find((row) => row.id === input.paymentId) ||
    state.payments.find((row) => row.invoiceId === input.invoiceId && row.provider === "manual");
  if (!payment) throw new Error("Manual payment record not found.");

  projectPaymentEventToState(state, {
    paymentId: payment.id,
    invoiceId: invoice.id,
    paymentStatus: "succeeded",
    resultCode: "MANUAL_VERIFIED",
    resultDescription: input.notes || "Manual payment verified by admin.",
    callbackPayload: {
      actorUserId: input.actorUserId || null,
      notes: input.notes || null,
    },
  });
  upsertEvent(state, {
    id: `evt_${Date.now().toString(36)}`,
    restaurantId: input.restaurant.id,
    provider: "manual",
    eventType: "invoice_paid",
    createdAt: nowIso(),
    eventKey: `manual-verified:${invoice.id}:${payment.id}`,
    payload: {
      invoiceId: invoice.id,
      paymentId: payment.id,
      actorUserId: input.actorUserId || null,
      notes: input.notes || null,
    },
  });
  await saveBillingState(state);
  await persistSubscriptionProjection(state);
  return state;
}

export async function setDevBillingState(input: {
  restaurant: RestaurantRecord;
  planId?: string;
  status?: SubscriptionStatus;
  resetUsage?: boolean;
  resetInvoices?: boolean;
}) {
  const state = await ensureBillingStateForRestaurant(input.restaurant);
  if (input.planId) state.subscription.planId = normalizePlanId(input.planId);
  if (input.status) state.subscription.status = input.status;
  if (input.resetInvoices) {
    state.invoices = [];
    state.payments = [];
    state.events = [];
  }
  const usage = input.resetUsage
    ? ({ dishes: 0, ordersPerMonth: 0 } satisfies Record<PlanLimitKey, number>)
    : await computeUsage(input.restaurant.id);
  state.entitlements = buildEntitlements(input.restaurant.id, state.subscription.planId, usage);
  await saveBillingState(state);
  await persistSubscriptionProjection(state);
  return state;
}
