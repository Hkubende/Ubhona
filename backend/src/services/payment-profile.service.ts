import { randomUUID } from "node:crypto";
import { Prisma, type UserRole } from "@prisma/client";
import { z } from "zod";
import { recordActivityEvent } from "./activity.service.js";
import {
  decryptPaymentProfileSecrets,
  encryptPaymentProfileSecrets,
  type PaymentProfileEncryptedSecrets,
  type PaymentProfileSecretInput,
} from "./payment-profile-crypto.service.js";
import { findRestaurantDocumentByKey, upsertRestaurantDocument } from "./tenant-document.service.js";

const PAYMENT_PROFILE_KEY_PREFIX = "payment_profile:";
const PAYMENT_PROFILE_PROVIDER = "mpesa" as const;
const PAYMENT_PROFILE_VERSION = 1 as const;

export const PAYMENT_PROFILE_STATUSES = ["draft", "pending_validation", "active", "invalid", "disabled"] as const;
export type PaymentProfileStatus = (typeof PAYMENT_PROFILE_STATUSES)[number];
export type PaymentProfileEnvironment = "sandbox" | "live";
export type PaymentProfileProvider = typeof PAYMENT_PROFILE_PROVIDER;
export type PaymentProfileValidationState = "unknown" | "valid" | "invalid";

const paymentProfileSchema = z.object({
  version: z.literal(PAYMENT_PROFILE_VERSION),
  id: z.string().min(1),
  restaurantId: z.string().min(1),
  provider: z.literal(PAYMENT_PROFILE_PROVIDER),
  status: z.enum(PAYMENT_PROFILE_STATUSES),
  isDefault: z.literal(true),
  environment: z.enum(["sandbox", "live"]),
  accountDisplayName: z.string().min(1),
  providerAccount: z.object({
    businessShortcode: z.string().min(1),
    paybillNumber: z.string().nullable(),
    tillNumber: z.string().nullable(),
  }),
  encryptedSecrets: z.object({
    alg: z.literal("aes-256-gcm"),
    keyVersion: z.literal("v1"),
    iv: z.string().min(1),
    ciphertext: z.string().min(1),
    tag: z.string().min(1),
  }).nullable(),
  callbackConfig: z.object({
    url: z.string().nullable(),
    secretConfigured: z.boolean(),
  }),
  validation: z.object({
    state: z.enum(["unknown", "valid", "invalid"]),
    lastError: z.string().nullable(),
    lastValidatedAt: z.string().nullable(),
  }),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type RestaurantPaymentProfileDocument = z.infer<typeof paymentProfileSchema>;

export type RestaurantPaymentProfileView = Omit<RestaurantPaymentProfileDocument, "encryptedSecrets"> & {
  secrets: {
    hasConsumerKey: boolean;
    hasConsumerSecret: boolean;
    hasPasskey: boolean;
  };
};

export type UpsertRestaurantPaymentProfileInput = {
  restaurantId: string;
  actorUserId: string;
  actorRole: UserRole;
  provider?: PaymentProfileProvider;
  environment: PaymentProfileEnvironment;
  accountDisplayName: string;
  businessShortcode: string;
  paybillNumber?: string | null;
  tillNumber?: string | null;
  consumerKey?: string;
  consumerSecret?: string;
  passkey?: string;
};

export type ActiveRestaurantPaymentProfileRuntimeConfig = {
  provider: PaymentProfileProvider;
  environment: PaymentProfileEnvironment;
  accountDisplayName: string;
  businessShortcode: string;
  callbackUrl: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
};

export type RestaurantPaymentStatus = {
  hasProfile: boolean;
  profileStatus: PaymentProfileStatus | null;
  lastValidationResult: PaymentProfileValidationState | null;
  lastValidationError: string | null;
  lastValidationAt: string | null;
  readyForPaymentInitiation: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function paymentProfileKey(restaurantId: string) {
  return `${PAYMENT_PROFILE_KEY_PREFIX}${restaurantId}`;
}

function trimOptional(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function getCallbackRuntimeConfig() {
  const callbackUrl = String(process.env.MPESA_CALLBACK_URL || "").trim() || null;
  const secretConfigured = Boolean(String(process.env.MPESA_CALLBACK_SECRET || "").trim());
  return { callbackUrl, secretConfigured };
}

function parsePaymentProfile(value: unknown) {
  const parsed = paymentProfileSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data;
}

function toPaymentProfileView(profile: RestaurantPaymentProfileDocument): RestaurantPaymentProfileView {
  const { encryptedSecrets: _encryptedSecrets, ...rest } = profile;
  return {
    ...rest,
    secrets: {
      hasConsumerKey: Boolean(_encryptedSecrets),
      hasConsumerSecret: Boolean(_encryptedSecrets),
      hasPasskey: Boolean(_encryptedSecrets),
    },
  };
}

function sanitizeActivityProfile(profile: RestaurantPaymentProfileDocument | null | undefined) {
  if (!profile) return null;
  const view = toPaymentProfileView(profile);
  return {
    id: view.id,
    provider: view.provider,
    status: view.status,
    environment: view.environment,
    isDefault: view.isDefault,
    accountDisplayName: view.accountDisplayName,
    providerAccount: view.providerAccount,
    callbackConfig: view.callbackConfig,
    validation: view.validation,
    secrets: view.secrets,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

async function loadPaymentProfileDocument(restaurantId: string) {
  const row = await findRestaurantDocumentByKey({
    restaurantId,
    key: paymentProfileKey(restaurantId),
    select: { payload: true },
  });
  return row ? parsePaymentProfile(row.payload) : null;
}

async function savePaymentProfileDocument(profile: RestaurantPaymentProfileDocument) {
  await upsertRestaurantDocument({
    restaurantId: profile.restaurantId,
    key: paymentProfileKey(profile.restaurantId),
    payload: profile as unknown as Prisma.InputJsonValue,
  });
}

function isProfileReadyForPaymentInitiation(profile: RestaurantPaymentProfileDocument | null) {
  return Boolean(
    profile &&
      profile.status === "active" &&
      profile.validation.state === "valid" &&
      profile.encryptedSecrets &&
      profile.callbackConfig.url &&
      profile.callbackConfig.secretConfigured
  );
}

function buildMergedSecrets(existing: PaymentProfileEncryptedSecrets | null, input: UpsertRestaurantPaymentProfileInput): PaymentProfileEncryptedSecrets | null {
  const hasAnySecretInput = [input.consumerKey, input.consumerSecret, input.passkey].some((value) => String(value || "").trim());
  if (!hasAnySecretInput) return existing;

  const previous = existing ? decryptPaymentProfileSecrets(existing) : null;
  const nextSecrets: PaymentProfileSecretInput = {
    consumerKey: String(input.consumerKey || previous?.consumerKey || "").trim(),
    consumerSecret: String(input.consumerSecret || previous?.consumerSecret || "").trim(),
    passkey: String(input.passkey || previous?.passkey || "").trim(),
  };

  if (!nextSecrets.consumerKey || !nextSecrets.consumerSecret || !nextSecrets.passkey) {
    throw new Error("consumerKey, consumerSecret, and passkey are required to store an M-Pesa payment profile.");
  }

  return encryptPaymentProfileSecrets(nextSecrets);
}

async function validateMpesaCredentials(input: {
  environment: PaymentProfileEnvironment;
  consumerKey: string;
  consumerSecret: string;
}) {
  const base = input.environment === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${input.consumerKey}:${input.consumerSecret}`).toString("base64");
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string; errorMessage?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.errorMessage || "Provider credential validation failed.");
  }
}

export async function getRestaurantPaymentProfile(restaurantId: string) {
  const profile = await loadPaymentProfileDocument(restaurantId);
  return profile ? toPaymentProfileView(profile) : null;
}

export async function getRestaurantPaymentStatus(restaurantId: string): Promise<RestaurantPaymentStatus> {
  const profile = await loadPaymentProfileDocument(restaurantId);
  return {
    hasProfile: Boolean(profile),
    profileStatus: profile?.status || null,
    lastValidationResult: profile?.validation.state || null,
    lastValidationError: profile?.validation.lastError || null,
    lastValidationAt: profile?.validation.lastValidatedAt || null,
    readyForPaymentInitiation: isProfileReadyForPaymentInitiation(profile),
  };
}

export async function upsertRestaurantPaymentProfile(input: UpsertRestaurantPaymentProfileInput) {
  const existing = await loadPaymentProfileDocument(input.restaurantId);
  const encryptedSecrets = buildMergedSecrets(existing?.encryptedSecrets || null, input);
  const callbackRuntime = getCallbackRuntimeConfig();
  const timestamp = nowIso();
  const next: RestaurantPaymentProfileDocument = {
    version: PAYMENT_PROFILE_VERSION,
    id: existing?.id || randomUUID(),
    restaurantId: input.restaurantId,
    provider: PAYMENT_PROFILE_PROVIDER,
    status: "draft",
    isDefault: true,
    environment: input.environment,
    accountDisplayName: input.accountDisplayName.trim(),
    providerAccount: {
      businessShortcode: input.businessShortcode.trim(),
      paybillNumber: trimOptional(input.paybillNumber),
      tillNumber: trimOptional(input.tillNumber),
    },
    encryptedSecrets,
    callbackConfig: {
      url: callbackRuntime.callbackUrl,
      secretConfigured: callbackRuntime.secretConfigured,
    },
    validation: {
      state: "unknown",
      lastError: null,
      lastValidatedAt: existing?.validation.lastValidatedAt || null,
    },
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  await savePaymentProfileDocument(next);
  await recordActivityEvent({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: existing ? "payment_profile_updated" : "payment_profile_created",
    entityType: "payment_profile",
    entityId: next.id,
    organizationId: input.restaurantId,
    restaurantId: input.restaurantId,
    source: "payment_profile_api",
    before: sanitizeActivityProfile(existing),
    after: sanitizeActivityProfile(next),
    metadata: {
      provider: next.provider,
      environment: next.environment,
    },
  });
  return toPaymentProfileView(next);
}

export async function validateRestaurantPaymentProfile(input: {
  restaurantId: string;
  actorUserId: string;
  actorRole: UserRole;
}) {
  const existing = await loadPaymentProfileDocument(input.restaurantId);
  if (!existing) {
    throw new Error("Create a payment profile before validation.");
  }
  if (!existing.encryptedSecrets) {
    const invalidProfile: RestaurantPaymentProfileDocument = {
      ...existing,
      status: "invalid",
      validation: {
        state: "invalid",
        lastError: "Missing encrypted provider credentials.",
        lastValidatedAt: nowIso(),
      },
      updatedAt: nowIso(),
    };
    await savePaymentProfileDocument(invalidProfile);
    return toPaymentProfileView(invalidProfile);
  }

  const pendingProfile: RestaurantPaymentProfileDocument = {
    ...existing,
    status: "pending_validation",
    validation: {
      ...existing.validation,
      lastError: null,
    },
    updatedAt: nowIso(),
  };
  await savePaymentProfileDocument(pendingProfile);

  try {
    const secrets = decryptPaymentProfileSecrets(existing.encryptedSecrets);
    const callbackRuntime = getCallbackRuntimeConfig();
    if (!callbackRuntime.callbackUrl || !callbackRuntime.secretConfigured) {
      throw new Error("Global callback runtime is not configured. Set MPESA_CALLBACK_URL and MPESA_CALLBACK_SECRET.");
    }
    await validateMpesaCredentials({
      environment: existing.environment,
      consumerKey: secrets.consumerKey,
      consumerSecret: secrets.consumerSecret,
    });
    const nextStatus: PaymentProfileStatus = existing.status === "active" ? "active" : "draft";
    const validatedProfile: RestaurantPaymentProfileDocument = {
      ...existing,
      status: nextStatus,
      callbackConfig: {
        url: callbackRuntime.callbackUrl,
        secretConfigured: callbackRuntime.secretConfigured,
      },
      validation: {
        state: "valid",
        lastError: null,
        lastValidatedAt: nowIso(),
      },
      updatedAt: nowIso(),
    };
    await savePaymentProfileDocument(validatedProfile);
    await recordActivityEvent({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: "payment_profile_validated",
      entityType: "payment_profile",
      entityId: validatedProfile.id,
      organizationId: input.restaurantId,
      restaurantId: input.restaurantId,
      source: "payment_profile_api",
      after: sanitizeActivityProfile(validatedProfile),
      metadata: {
        provider: validatedProfile.provider,
        validationState: validatedProfile.validation.state,
      },
    });
    return toPaymentProfileView(validatedProfile);
  } catch (error) {
    const failedProfile: RestaurantPaymentProfileDocument = {
      ...existing,
      status: "invalid",
      validation: {
        state: "invalid",
        lastError: error instanceof Error ? error.message : "Provider validation failed.",
        lastValidatedAt: nowIso(),
      },
      updatedAt: nowIso(),
    };
    await savePaymentProfileDocument(failedProfile);
    return toPaymentProfileView(failedProfile);
  }
}

export async function activateRestaurantPaymentProfile(input: {
  restaurantId: string;
  actorUserId: string;
  actorRole: UserRole;
}) {
  const existing = await loadPaymentProfileDocument(input.restaurantId);
  if (!existing) {
    throw new Error("Create a payment profile before activation.");
  }
  if (existing.validation.state !== "valid") {
    throw new Error("Validate the payment profile successfully before activation.");
  }
  const activeProfile: RestaurantPaymentProfileDocument = {
    ...existing,
    status: "active",
    isDefault: true,
    updatedAt: nowIso(),
  };
  await savePaymentProfileDocument(activeProfile);
  await recordActivityEvent({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: "payment_profile_activated",
    entityType: "payment_profile",
    entityId: activeProfile.id,
    organizationId: input.restaurantId,
    restaurantId: input.restaurantId,
    source: "payment_profile_api",
    after: sanitizeActivityProfile(activeProfile),
  });
  return toPaymentProfileView(activeProfile);
}

export async function disableRestaurantPaymentProfile(input: {
  restaurantId: string;
  actorUserId: string;
  actorRole: UserRole;
}) {
  const existing = await loadPaymentProfileDocument(input.restaurantId);
  if (!existing) {
    throw new Error("Payment profile not found.");
  }
  const disabledProfile: RestaurantPaymentProfileDocument = {
    ...existing,
    status: "disabled",
    updatedAt: nowIso(),
  };
  await savePaymentProfileDocument(disabledProfile);
  await recordActivityEvent({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: "payment_profile_disabled",
    entityType: "payment_profile",
    entityId: disabledProfile.id,
    organizationId: input.restaurantId,
    restaurantId: input.restaurantId,
    source: "payment_profile_api",
    after: sanitizeActivityProfile(disabledProfile),
  });
  return toPaymentProfileView(disabledProfile);
}

export async function getActiveRestaurantPaymentProfileRuntimeConfig(restaurantId: string): Promise<ActiveRestaurantPaymentProfileRuntimeConfig> {
  const profile = await loadPaymentProfileDocument(restaurantId);
  if (!profile || profile.status !== "active") {
    throw new Error("No active restaurant payment profile is configured.");
  }
  if (!isProfileReadyForPaymentInitiation(profile)) {
    throw new Error("Active restaurant payment profile is not valid.");
  }
  const callbackUrl = String(process.env.MPESA_CALLBACK_URL || "").trim();
  if (!callbackUrl) {
    throw new Error("Missing MPESA_CALLBACK_URL runtime configuration.");
  }
  const secrets = decryptPaymentProfileSecrets(profile.encryptedSecrets!);
  return {
    provider: profile.provider,
    environment: profile.environment,
    accountDisplayName: profile.accountDisplayName,
    businessShortcode: profile.providerAccount.businessShortcode,
    callbackUrl,
    consumerKey: secrets.consumerKey,
    consumerSecret: secrets.consumerSecret,
    passkey: secrets.passkey,
  };
}