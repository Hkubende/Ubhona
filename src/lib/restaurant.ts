import { api } from "./api";
import { isApiConfigured } from "./config";

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

type LooseRecord = Record<string, unknown>;

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

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== "object") return {};
  return value as LooseRecord;
}

function toStringValue(value: unknown, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

function firstDefined(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function mapApiProfile(value: unknown): RestaurantProfile {
  const row = toRecord(value);
  const subscription = toRecord(row.subscription);

  return {
    id: toStringValue(row.id),
    restaurantName: toStringValue(firstDefined(row.name, row.restaurantName)),
    slug: toStringValue(row.slug).toLowerCase(),
    phone: toStringValue(row.phone),
    email: toStringValue(row.email).toLowerCase(),
    location: toStringValue(row.location),
    logo: toStringValue(firstDefined(row.logoUrl, row.logo)) || undefined,
    coverImage: toStringValue(row.coverImage) || undefined,
    themePrimary: normalizeColor(row.themePrimary, DEFAULT_PRIMARY),
    themeSecondary: normalizeColor(row.themeSecondary, DEFAULT_SECONDARY),
    shortDescription: toStringValue(row.shortDescription) || undefined,
    subscriptionPlan: normalizePlan(firstDefined(subscription.plan, row.subscriptionPlan)),
    subscriptionStatus: normalizeStatus(firstDefined(subscription.status, row.subscriptionStatus)),
    trialEndsAt: firstDefined(subscription.trialEndsAt, row.trialEndsAt) as string | null | undefined,
    renewalDate: firstDefined(subscription.renewalDate, row.renewalDate) as string | null | undefined,
    createdAt: toStringValue(firstDefined(row.createdAt, new Date().toISOString())),
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
  if (!isApiConfigured) return readCache();

  try {
    const response = await api.get<unknown>("/restaurants/me");
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
    ? await api.patch<unknown>("/restaurants/me", payload)
    : await api.post<unknown>("/restaurants", payload);
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
  const response = await api.patch<unknown>("/restaurants/me/plan", { subscriptionPlan });
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
