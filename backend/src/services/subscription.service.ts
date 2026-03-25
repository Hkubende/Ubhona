export const SUBSCRIPTION_PLANS = ["starter", "growth", "pro"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "cancelled", "expired"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLAN_FEATURES = {
  starter: {
    dishLimit: 25,
    monthlyOrderLimit: 200,
    analytics: false,
    ar: false,
    customBranding: false,
    advancedAnalytics: false,
    printing: true,
    waiterAccounts: false,
    staffAccounts: false,
    multiBranch: false,
  },
  growth: {
    dishLimit: null,
    monthlyOrderLimit: null,
    analytics: true,
    ar: true,
    customBranding: true,
    advancedAnalytics: false,
    printing: true,
    waiterAccounts: true,
    staffAccounts: false,
    multiBranch: false,
  },
  pro: {
    dishLimit: null,
    monthlyOrderLimit: null,
    analytics: true,
    ar: true,
    customBranding: true,
    advancedAnalytics: true,
    printing: true,
    waiterAccounts: true,
    staffAccounts: true,
    multiBranch: true,
  },
} as const;

export type PlanFeatureKey = keyof (typeof PLAN_FEATURES)["starter"];

export function normalizePlan(value: unknown): SubscriptionPlan {
  const plan = String(value || "").trim().toLowerCase();
  if (plan === "enterprise") return "pro";
  return SUBSCRIPTION_PLANS.includes(plan as SubscriptionPlan) ? (plan as SubscriptionPlan) : "starter";
}

export function getPlanFeatures(plan: unknown) {
  return PLAN_FEATURES[normalizePlan(plan)];
}

export function hasPlanFeature(plan: unknown, feature: PlanFeatureKey) {
  return Boolean(getPlanFeatures(plan)[feature]);
}

export function getDishLimit(plan: unknown) {
  return getPlanFeatures(plan).dishLimit;
}

type SubscriptionRestaurantSummary = {
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  renewalDate: Date | null;
};

export function mapSubscriptionSummary(restaurant: SubscriptionRestaurantSummary) {
  return {
    plan: normalizePlan(restaurant.subscriptionPlan),
    status: String(restaurant.subscriptionStatus || "trialing").replace("canceled", "cancelled"),
    trialEndsAt: restaurant.trialEndsAt ? restaurant.trialEndsAt.toISOString() : null,
    renewalDate: restaurant.renewalDate ? restaurant.renewalDate.toISOString() : null,
    features: getPlanFeatures(restaurant.subscriptionPlan),
  };
}
