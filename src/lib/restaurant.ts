import { ApiError, api, isApiReachable } from "./api";
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

export type FeatureGate = {
  feature: PlanFeature;
  enabled: boolean;
  currentPlan: SubscriptionPlan;
  currentPlanLabel: string;
  minimumPlan: SubscriptionPlan;
  minimumPlanLabel: string;
  message: string;
};

export type RestaurantBrandingTheme = {
  primary: string;
  secondary: string;
};

export type RestaurantBranding = {
  logoUrl: string;
  coverImageUrl?: string;
  primary: string;
  secondary: string;
  shortDescription: string;
};

const PROFILE_KEY = "mv_restaurant_profile_v1";
const PROFILE_REGISTRY_KEY = "mv_restaurant_profiles_registry_v1";
const DEFAULT_PRIMARY = "#E4572E";
const DEFAULT_SECONDARY = "#E8D8C3";
const DEFAULT_SHORT_DESCRIPTION = "Visualize";
const DEFAULT_LOGO = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;
const RESERVED_SLUGS = new Set([
  "demo",
  "ubhona",
  "ubhona-demo",
  "login",
  "signup",
  "onboarding",
  "dashboard",
  "admin",
  "ar",
  "checkout",
  "orders",
  "pricing",
  "app",
  "menu",
  "r",
]);

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

const PLAN_ORDER: SubscriptionPlan[] = ["starter", "pro", "enterprise"];

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

function normalizeSlug(value: unknown) {
  return String(value || "").trim().toLowerCase();
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

function isApiUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 503) return false;
  const code = (error.body as { code?: unknown } | null)?.code;
  return code === "API_NOT_CONFIGURED" || code === "API_UNREACHABLE";
}

function toLocalProfile(
  input: Omit<
    RestaurantProfile,
    "id" | "createdAt" | "subscriptionPlan" | "subscriptionStatus" | "trialEndsAt" | "renewalDate"
  > &
    Partial<
      Pick<
        RestaurantProfile,
        "id" | "createdAt" | "subscriptionPlan" | "subscriptionStatus" | "trialEndsAt" | "renewalDate"
      >
    >,
  existing: RestaurantProfile | null
): RestaurantProfile {
  return {
    id: input.id || existing?.id || `local_restaurant_${Date.now().toString(36)}`,
    restaurantName: input.restaurantName.trim(),
    slug: normalizeSlug(input.slug),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    location: input.location.trim(),
    logo: input.logo?.trim() || undefined,
    coverImage: input.coverImage?.trim() || undefined,
    themePrimary: normalizeColor(input.themePrimary, DEFAULT_PRIMARY),
    themeSecondary: normalizeColor(input.themeSecondary, DEFAULT_SECONDARY),
    shortDescription: input.shortDescription?.trim() || undefined,
    subscriptionPlan: normalizePlan(input.subscriptionPlan ?? existing?.subscriptionPlan),
    subscriptionStatus: normalizeStatus(input.subscriptionStatus ?? existing?.subscriptionStatus),
    trialEndsAt: input.trialEndsAt ?? existing?.trialEndsAt ?? null,
    renewalDate: input.renewalDate ?? existing?.renewalDate ?? null,
    createdAt: input.createdAt || existing?.createdAt || new Date().toISOString(),
  };
}

function sanitizeRegistryEntry(value: unknown): Pick<RestaurantProfile, "id" | "slug" | "restaurantName"> | null {
  const row = toRecord(value);
  const id = toStringValue(row.id).trim();
  const slug = normalizeSlug(row.slug);
  const restaurantName = toStringValue(row.restaurantName || row.name).trim();
  if (!id || !slug || !restaurantName) return null;
  return { id, slug, restaurantName };
}

function readProfileRegistry() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_REGISTRY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeRegistryEntry(entry))
      .filter((entry): entry is Pick<RestaurantProfile, "id" | "slug" | "restaurantName"> => !!entry);
  } catch {
    return [];
  }
}

function writeProfileRegistry(entries: Array<Pick<RestaurantProfile, "id" | "slug" | "restaurantName">>) {
  localStorage.setItem(PROFILE_REGISTRY_KEY, JSON.stringify(entries));
}

function upsertProfileRegistry(profile: RestaurantProfile) {
  const current = readProfileRegistry();
  const filtered = current.filter((entry) => entry.id !== profile.id && entry.slug !== profile.slug);
  filtered.push({
    id: profile.id,
    slug: profile.slug,
    restaurantName: profile.restaurantName,
  });
  writeProfileRegistry(filtered);
}

function ensureLocalSlugAvailable(slug: string, currentProfileId?: string) {
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`Slug "${slug}" is reserved. Choose another slug.`);
  }
  const taken = readProfileRegistry().find(
    (entry) => entry.slug === slug && entry.id !== currentProfileId
  );
  if (taken) {
    throw new Error(`Slug "${slug}" is already in use. Choose another slug.`);
  }
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

export function validateRestaurantSlug(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return "Slug is required.";
  if (normalized.length < 3) return "Slug must be at least 3 characters.";
  if (normalized.length > 50) return "Slug must be 50 characters or fewer.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return "Slug can only contain lowercase letters, numbers, and single hyphens.";
  }
  return null;
}

export async function syncRestaurantProfile() {
  if (!isApiConfigured) return readCache();
  if (!(await isApiReachable())) return readCache();

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
  const existing = getRestaurantProfile();
  const localProfile = toLocalProfile(input, existing);
  const slugValidation = validateRestaurantSlug(localProfile.slug);
  if (slugValidation) throw new Error(slugValidation);
  ensureLocalSlugAvailable(localProfile.slug, existing?.id);

  if (!isApiConfigured) {
    writeCache(localProfile);
    upsertProfileRegistry(localProfile);
    return localProfile;
  }

  const payload = {
    name: localProfile.restaurantName,
    slug: localProfile.slug,
    phone: localProfile.phone,
    email: localProfile.email,
    location: localProfile.location,
    logoUrl: input.logo?.trim() || "",
    coverImage: input.coverImage?.trim() || "",
    themePrimary: normalizeColor(localProfile.themePrimary, DEFAULT_PRIMARY),
    themeSecondary: normalizeColor(localProfile.themeSecondary, DEFAULT_SECONDARY),
    shortDescription: input.shortDescription?.trim() || "",
    subscriptionPlan: normalizePlan(localProfile.subscriptionPlan),
    subscriptionStatus: normalizeStatus(localProfile.subscriptionStatus),
    trialEndsAt: input.trialEndsAt || null,
    renewalDate: input.renewalDate || null,
  };

  try {
    const response = existing
      ? await api.patch<unknown>("/restaurants/me", payload)
      : await api.post<unknown>("/restaurants", payload);
    const mapped = mapApiProfile(response);
    writeCache(mapped);
    upsertProfileRegistry(mapped);
    return mapped;
  } catch (error) {
    if (!isApiUnavailable(error)) throw error;
    writeCache(localProfile);
    upsertProfileRegistry(localProfile);
    return localProfile;
  }
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

export function getPlanLabel(plan: SubscriptionPlan) {
  return PLAN_CONFIG[plan].label;
}

export function canUseFeature(feature: PlanFeature, profile: RestaurantProfile | null = getRestaurantProfile()) {
  const plan = normalizePlan(profile?.subscriptionPlan);
  return PLAN_CONFIG[plan].features[feature];
}

export function getMinimumPlanForFeature(feature: PlanFeature): SubscriptionPlan {
  for (const plan of PLAN_ORDER) {
    if (PLAN_CONFIG[plan].features[feature]) return plan;
  }
  return "enterprise";
}

export function getFeatureGate(feature: PlanFeature, profile: RestaurantProfile | null = getRestaurantProfile()): FeatureGate {
  const currentPlan = normalizePlan(profile?.subscriptionPlan);
  const minimumPlan = getMinimumPlanForFeature(feature);
  const enabled = PLAN_CONFIG[currentPlan].features[feature];
  const currentPlanLabel = getPlanLabel(currentPlan);
  const minimumPlanLabel = getPlanLabel(minimumPlan);
  return {
    feature,
    enabled,
    currentPlan,
    currentPlanLabel,
    minimumPlan,
    minimumPlanLabel,
    message: enabled
      ? `${feature} is available on ${currentPlanLabel}.`
      : `${feature} is unavailable on ${currentPlanLabel}. Upgrade to ${minimumPlanLabel}.`,
  };
}

export function getPlanFeatureList(profile: RestaurantProfile | null = getRestaurantProfile()) {
  const features: PlanFeature[] = [
    "analytics",
    "ar",
    "customBranding",
    "advancedAnalytics",
    "staffAccounts",
    "multiBranch",
  ];
  return features.map((feature) => getFeatureGate(feature, profile));
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

export function getRestaurantBranding(profile: RestaurantProfile | null = getRestaurantProfile()): RestaurantBranding {
  return {
    logoUrl: String(profile?.logo || "").trim() || DEFAULT_LOGO,
    coverImageUrl: String(profile?.coverImage || "").trim() || undefined,
    primary: normalizeColor(profile?.themePrimary, DEFAULT_PRIMARY),
    secondary: normalizeColor(profile?.themeSecondary, DEFAULT_SECONDARY),
    shortDescription: String(profile?.shortDescription || "").trim() || DEFAULT_SHORT_DESCRIPTION,
  };
}
