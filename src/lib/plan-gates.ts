import {
  getFeatureGate,
  getPlanFeatureList,
  type PlanFeature,
  type RestaurantProfile,
} from "./restaurant";

export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  analytics: "Analytics",
  ar: "AR Previews",
  customBranding: "Custom Branding",
  advancedAnalytics: "Advanced Analytics",
  staffAccounts: "Staff Accounts",
  multiBranch: "Multi-Branch",
};

export function getPlanFeatureSummary(profile: RestaurantProfile | null) {
  return getPlanFeatureList(profile).map((gate) => ({
    ...gate,
    label: PLAN_FEATURE_LABELS[gate.feature],
  }));
}

export function isFeatureAvailable(feature: PlanFeature, profile: RestaurantProfile | null) {
  return getFeatureGate(feature, profile).enabled;
}
