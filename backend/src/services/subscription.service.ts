import type { Restaurant } from "@prisma/client";

export const SUBSCRIPTION_PLANS = ["starter", "pro", "enterprise"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLAN_FEATURES = {
  starter: {
    dishLimit: 25,
    analytics: false,
    ar: false,
    customBranding: false,
    advancedAnalytics: false,
    staffAccounts: false,
    multiBranch: false,
  },
  pro: {
    dishLimit: null,
    analytics: true,
    ar: true,
    customBranding: true,
    advancedAnalytics: false,
    staffAccounts: false,
    multiBranch: false,
  },
  enterprise: {
    dishLimit: null,
    analytics: true,
    ar: true,
    customBranding: true,
    advancedAnalytics: true,
    staffAccounts: true,
    multiBranch: true,
  },
} as const;

export type PlanFeatureKey = keyof (typeof PLAN_FEATURES)["starter"];

export function normalizePlan(value: unknown): SubscriptionPlan {
  const plan = String(value || "").trim().toLowerCase();
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

export function mapSubscriptionSummary(restaurant: Restaurant) {
  return {
    plan: normalizePlan(restaurant.subscriptionPlan),
    status: String(restaurant.subscriptionStatus || "trialing"),
    trialEndsAt: restaurant.trialEndsAt ? restaurant.trialEndsAt.toISOString() : null,
    renewalDate: restaurant.renewalDate ? restaurant.renewalDate.toISOString() : null,
    features: getPlanFeatures(restaurant.subscriptionPlan),
  };
}
