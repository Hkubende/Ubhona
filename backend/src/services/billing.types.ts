export const BILLING_CYCLES = ["monthly", "annual"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "cancelled", "expired"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["mpesa", "manual", "stripe"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const BILLING_INVOICE_STATUSES = ["draft", "pending", "paid", "failed", "expired", "cancelled"] as const;
export type BillingInvoiceStatus = (typeof BILLING_INVOICE_STATUSES)[number];

export const BILLING_PAYMENT_STATUSES = [
  "initiated",
  "pending",
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
  "requires_verification",
] as const;
export type BillingPaymentStatus = (typeof BILLING_PAYMENT_STATUSES)[number];

export type PlanFeatureKey =
  | "analytics"
  | "ar"
  | "customBranding"
  | "advancedAnalytics"
  | "printing"
  | "waiterAccounts"
  | "staffAccounts"
  | "multiBranch";

export type PlanLimitKey = "dishes" | "ordersPerMonth";

export type PlanDefinition = {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  features: Record<PlanFeatureKey, boolean>;
  limits: Record<PlanLimitKey, number | null>;
};

export type RestaurantSubscription = {
  restaurantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startedAt: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  paymentProvider: PaymentProvider;
  externalSubscriptionId: string | null;
};

export type BillingInvoice = {
  id: string;
  restaurantId: string;
  subscriptionId: string;
  planId: string;
  amount: number;
  currency: string;
  status: BillingInvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  dueAt: string | null;
  paymentReference: string;
  provider: PaymentProvider;
  notes: string | null;
};

export type BillingPayment = {
  id: string;
  restaurantId: string;
  invoiceId: string;
  method: string;
  provider: PaymentProvider;
  amount: number;
  status: BillingPaymentStatus;
  transactionReference: string;
  providerReference: string | null;
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  phoneNumber: string | null;
  resultCode: string | null;
  resultDescription: string | null;
  callbackPayload: Record<string, unknown> | null;
  reconciliationStatus: "none" | "pending" | "reconciled";
  createdAt: string;
  completedAt: string | null;
};

export type FeatureEntitlement = {
  restaurantId: string;
  planId: string;
  featureKey: PlanFeatureKey | PlanLimitKey;
  enabled: boolean;
  usageLimit: number | null;
  currentUsage: number;
};

export type BillingEventType =
  | "payment_initiated"
  | "payment_completed"
  | "payment_reconciled"
  | "payment_timeout"
  | "payment_cancelled"
  | "payment_succeeded"
  | "payment_failed"
  | "invoice_paid"
  | "subscription_activated"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "trial_expired";

export type BillingEvent = {
  id: string;
  restaurantId: string;
  provider: PaymentProvider;
  eventType: BillingEventType;
  createdAt: string;
  eventKey: string;
  payload: Record<string, unknown>;
};

export type RestaurantBillingState = {
  restaurantId: string;
  subscription: RestaurantSubscription;
  entitlements: FeatureEntitlement[];
  invoices: BillingInvoice[];
  payments: BillingPayment[];
  events: BillingEvent[];
};
