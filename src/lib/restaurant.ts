import { api } from "./api";

export type RestaurantProfile = {
  id: string;
  restaurantName: string;
  slug: string;
  phone: string;
  email: string;
  location: string;
  logo?: string;
  coverImage?: string;
  themePrimary?: string;
  themeSecondary?: string;
  shortDescription?: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string | null;
  renewalDate?: string | null;
  createdAt: string;
};

export type SubscriptionPlan = "starter" | "pro" | "enterprise";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "suspended";
export type PlanFeature =
  | "analytics"
  | "ar"
  | "customBranding"
  | "advancedAnalytics"
  | "staffAccounts"
  | "multiBranch";

type PlanConfig = {
  label: string;
  dishLimit: number | null;
  features: Record<PlanFeature, boolean>;
};

export type RestaurantBrandingTheme = {
  primary: string;
  secondary: string;
};

const PROFILE_KEY = "mv_restaurant_profile_v1";
const DEFAULT_PRIMARY = "#f97316";
const DEFAULT_SECONDARY = "#34d399";

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  starter: {
    label: "Starter",
    dishLimit: 25,
    features: {
      analytics: false,
      ar: false,
      customBranding: false,
      advancedAnalytics: false,
      staffAccounts: false,
      multiBranch: false,
    },
  },
  pro: {
    label: "Pro",
    dishLimit: null,
    features: {
      analytics: true,
      ar: true,
      customBranding: true,
      advancedAnalytics: false,
      staffAccounts: false,
      multiBranch: false,
    },
  },
  enterprise: {
    label: "Enterprise",
    dishLimit: null,
    features: {
      analytics: true,
      ar: true,
      customBranding: true,
      advancedAnalytics: true,
      staffAccounts: true,
      multiBranch: true,
    },
  },
};

function normalizePlan(value: unknown): SubscriptionPlan {
  const plan = String(value || "").trim().toLowerCase();
  if (plan === "pro" || plan === "enterprise") return plan;
  return "starter";
}

function normalizeStatus(value: unknown): SubscriptionStatus {
  const status = String(value || "").trim().toLowerCase();
  if (status === "active" || status === "past_due" || status === "canceled" || status === "suspended") return status;
  return "trialing";
}

function normalizeColor(value: unknown, fallback: string) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^#[0-9a-f]{3}$/i.test(raw) || /^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return fallback;
}

function mapApiProfile(value: any): RestaurantProfile {
  return {
    id: String(value.id),
    restaurantName: String(value.name || value.restaurantName || ""),
    slug: String(value.slug || "").toLowerCase(),
    phone: String(value.phone || ""),
    email: String(value.email || "").toLowerCase(),
    location: String(value.location || ""),
    logo: String(value.logoUrl || value.logo || "") || undefined,
    coverImage: String(value.coverImage || "") || undefined,
    themePrimary: normalizeColor(value.themePrimary, DEFAULT_PRIMARY),
    themeSecondary: normalizeColor(value.themeSecondary, DEFAULT_SECONDARY),
    shortDescription: String(value.shortDescription || "") || undefined,
    subscriptionPlan: normalizePlan(value.subscription?.plan || value.subscriptionPlan),
    subscriptionStatus: normalizeStatus(value.subscription?.status || value.subscriptionStatus),
    trialEndsAt: value.subscription?.trialEndsAt || value.trialEndsAt || null,
    renewalDate: value.subscription?.renewalDate || value.renewalDate || null,
    createdAt: String(value.createdAt || new Date().toISOString()),
  };
}

function readCache(): RestaurantProfile | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as RestaurantProfile;
  } catch {
    return null;
  }
}

function writeCache(profile: RestaurantProfile | null) {
  if (!profile) {
    localStorage.removeItem(PROFILE_KEY);
    return;
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getRestaurantProfile() {
  return readCache();
}

export async function syncRestaurantProfile() {
  try {
    const response = await api.get<any>("/restaurants/me");
    const mapped = mapApiProfile(response);
    writeCache(mapped);
    return mapped;
  } catch {
    return readCache();
  }
}

export function hasRestaurantProfile() {
  return getRestaurantProfile() != null;
}

export async function saveRestaurantProfile(
  input: Omit<
    RestaurantProfile,
    "id" | "createdAt" | "subscriptionPlan" | "subscriptionStatus" | "trialEndsAt" | "renewalDate"
  > &
    Partial<
      Pick<
        RestaurantProfile,
        "id" | "createdAt" | "subscriptionPlan" | "subscriptionStatus" | "trialEndsAt" | "renewalDate"
      >
    >
) {
  const payload = {
    name: input.restaurantName.trim(),
    slug: input.slug.trim().toLowerCase(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    location: input.location.trim(),
    logoUrl: input.logo?.trim() || "",
    coverImage: input.coverImage?.trim() || "",
    themePrimary: normalizeColor(input.themePrimary, DEFAULT_PRIMARY),
    themeSecondary: normalizeColor(input.themeSecondary, DEFAULT_SECONDARY),
    shortDescription: input.shortDescription?.trim() || "",
    subscriptionPlan: normalizePlan(input.subscriptionPlan),
    subscriptionStatus: normalizeStatus(input.subscriptionStatus),
    trialEndsAt: input.trialEndsAt || null,
    renewalDate: input.renewalDate || null,
  };

  const hasExisting = !!getRestaurantProfile();
  const response = hasExisting
    ? await api.patch<any>("/restaurants/me", payload)
    : await api.post<any>("/restaurants", payload);
  const mapped = mapApiProfile(response);
  writeCache(mapped);
  return mapped;
}

export function clearRestaurantProfile() {
  writeCache(null);
}

export function getBrandDisplayName() {
  return getRestaurantProfile()?.restaurantName || "Ubhona";
}

export function getCurrentPlan(profile: RestaurantProfile | null = getRestaurantProfile()) {
  const plan = normalizePlan(profile?.subscriptionPlan);
  return {
    plan,
    label: PLAN_CONFIG[plan].label,
    status: normalizeStatus(profile?.subscriptionStatus),
    trialEndsAt: profile?.trialEndsAt || null,
    renewalDate: profile?.renewalDate || null,
  };
}

export function canUseFeature(feature: PlanFeature, profile: RestaurantProfile | null = getRestaurantProfile()) {
  const plan = normalizePlan(profile?.subscriptionPlan);
  return PLAN_CONFIG[plan].features[feature];
}

export function getDishLimit(profile: RestaurantProfile | null = getRestaurantProfile()) {
  const plan = normalizePlan(profile?.subscriptionPlan);
  return PLAN_CONFIG[plan].dishLimit;
}

export async function updateSubscriptionPlan(subscriptionPlan: SubscriptionPlan) {
  const response = await api.patch<any>("/restaurants/me/plan", { subscriptionPlan });
  const mapped = mapApiProfile(response);
  writeCache(mapped);
  return mapped;
}

export function getBrandingTheme(): RestaurantBrandingTheme {
  const profile = getRestaurantProfile();
  return {
    primary: normalizeColor(profile?.themePrimary, DEFAULT_PRIMARY),
    secondary: normalizeColor(profile?.themeSecondary, DEFAULT_SECONDARY),
  };
}
