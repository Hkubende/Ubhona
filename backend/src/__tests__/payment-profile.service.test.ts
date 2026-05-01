import { beforeEach, describe, expect, it, vi } from "vitest";

const findRestaurantDocumentByKeyMock = vi.fn();
const upsertRestaurantDocumentMock = vi.fn();
const recordActivityEventMock = vi.fn();

vi.mock("../services/tenant-document.service.js", () => ({
  findRestaurantDocumentByKey: findRestaurantDocumentByKeyMock,
  upsertRestaurantDocument: upsertRestaurantDocumentMock,
}));

vi.mock("../services/activity.service.js", () => ({
  recordActivityEvent: recordActivityEventMock,
}));

function latestSavedProfile() {
  const call = upsertRestaurantDocumentMock.mock.calls.at(-1);
  return call?.[0]?.payload;
}

describe("payment-profile.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_PROFILE_ENCRYPTION_KEY =
      process.env.PAYMENT_PROFILE_ENCRYPTION_KEY || "test-payment-profile-encryption-key-32chars";
    process.env.MPESA_CALLBACK_URL = "https://api.test.ubhona.com/payments/callback";
    process.env.MPESA_CALLBACK_SECRET = "test-payment-profile-callback-secret";
    findRestaurantDocumentByKeyMock.mockResolvedValue(null);
    upsertRestaurantDocumentMock.mockResolvedValue({ id: "doc-1" });
    recordActivityEventMock.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
  });

  it("stores a tenant-scoped payment profile and redacts secrets in the returned view", async () => {
    const { upsertRestaurantPaymentProfile } = await import("../services/payment-profile.service.js");

    const profile = await upsertRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
      environment: "sandbox",
      accountDisplayName: "Main M-Pesa",
      businessShortcode: "174379",
      consumerKey: "consumer-key",
      consumerSecret: "consumer-secret",
      passkey: "passkey",
    });

    expect(upsertRestaurantDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        key: "payment_profile:rest-1",
      })
    );
    expect(profile.secrets).toEqual({
      hasConsumerKey: true,
      hasConsumerSecret: true,
      hasPasskey: true,
    });
    expect(Object.prototype.hasOwnProperty.call(profile, "encryptedSecrets")).toBe(false);
    expect(recordActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_profile_created",
        entityType: "payment_profile",
        restaurantId: "rest-1",
      })
    );
  });

  it("returns a not-ready payment status when no tenant profile exists", async () => {
    const { getRestaurantPaymentStatus } = await import("../services/payment-profile.service.js");

    const status = await getRestaurantPaymentStatus("rest-1");

    expect(status).toEqual({
      hasProfile: false,
      profileStatus: null,
      lastValidationResult: null,
      lastValidationError: null,
      lastValidationAt: null,
      readyForPaymentInitiation: false,
    });
  });

  it("marks the profile valid after provider credential validation succeeds", async () => {
    const { upsertRestaurantPaymentProfile, validateRestaurantPaymentProfile } = await import("../services/payment-profile.service.js");
    await upsertRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
      environment: "sandbox",
      accountDisplayName: "Main M-Pesa",
      businessShortcode: "174379",
      consumerKey: "consumer-key",
      consumerSecret: "consumer-secret",
      passkey: "passkey",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "token-1" }),
      })
    );

    const profile = await validateRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
    });

    expect(profile.validation.state).toBe("valid");
    expect(profile.status).toBe("draft");
    expect(profile.callbackConfig.secretConfigured).toBe(true);
    expect(recordActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_profile_validated",
        restaurantId: "rest-1",
      })
    );
  });

  it("marks the profile invalid when provider validation fails", async () => {
    const { upsertRestaurantPaymentProfile, validateRestaurantPaymentProfile } = await import("../services/payment-profile.service.js");
    await upsertRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
      environment: "sandbox",
      accountDisplayName: "Main M-Pesa",
      businessShortcode: "174379",
      consumerKey: "consumer-key",
      consumerSecret: "consumer-secret",
      passkey: "passkey",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ errorMessage: "invalid consumer key" }),
      })
    );

    const profile = await validateRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
    });

    expect(profile.status).toBe("invalid");
    expect(profile.validation.state).toBe("invalid");
    expect(profile.validation.lastError).toMatch(/invalid consumer key/i);
  });

  it("requires a valid profile before activation", async () => {
    const invalidProfile = {
      version: 1,
      id: "profile-1",
      restaurantId: "rest-1",
      provider: "mpesa",
      status: "invalid",
      isDefault: true,
      environment: "sandbox",
      accountDisplayName: "Main M-Pesa",
      providerAccount: { businessShortcode: "174379", paybillNumber: null, tillNumber: null },
      encryptedSecrets: { alg: "aes-256-gcm", keyVersion: "v1", iv: "a", ciphertext: "b", tag: "c" },
      callbackConfig: { url: "https://api.test.ubhona.com/payments/callback", secretConfigured: true },
      validation: { state: "invalid", lastError: "bad", lastValidatedAt: "2026-04-19T00:00:00.000Z" },
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T00:00:00.000Z",
    };
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: invalidProfile });

    const { activateRestaurantPaymentProfile } = await import("../services/payment-profile.service.js");
    await expect(
      activateRestaurantPaymentProfile({
        restaurantId: "rest-1",
        actorUserId: "owner-1",
        actorRole: "restaurant_owner",
      })
    ).rejects.toThrow(/Validate the payment profile successfully/i);
  });

  it("returns a ready payment status only for an active validated profile", async () => {
    const { upsertRestaurantPaymentProfile, validateRestaurantPaymentProfile, activateRestaurantPaymentProfile, getRestaurantPaymentStatus } = await import("../services/payment-profile.service.js");
    await upsertRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
      environment: "sandbox",
      accountDisplayName: "Main M-Pesa",
      businessShortcode: "174379",
      consumerKey: "consumer-key",
      consumerSecret: "consumer-secret",
      passkey: "passkey",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "token-1" }),
      })
    );
    await validateRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });
    await activateRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });

    const status = await getRestaurantPaymentStatus("rest-1");

    expect(status.hasProfile).toBe(true);
    expect(status.profileStatus).toBe("active");
    expect(status.lastValidationResult).toBe("valid");
    expect(status.lastValidationError).toBeNull();
    expect(status.lastValidationAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(status.readyForPaymentInitiation).toBe(true);
  });

  it("resolves the active runtime config only for a valid active profile", async () => {
    const { upsertRestaurantPaymentProfile, validateRestaurantPaymentProfile, activateRestaurantPaymentProfile, getActiveRestaurantPaymentProfileRuntimeConfig } = await import("../services/payment-profile.service.js");
    await upsertRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
      environment: "sandbox",
      accountDisplayName: "Main M-Pesa",
      businessShortcode: "174379",
      consumerKey: "consumer-key",
      consumerSecret: "consumer-secret",
      passkey: "passkey",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "token-1" }),
      })
    );
    await validateRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });
    await activateRestaurantPaymentProfile({
      restaurantId: "rest-1",
      actorUserId: "owner-1",
      actorRole: "restaurant_owner",
    });
    findRestaurantDocumentByKeyMock.mockResolvedValue({ key: "payment_profile:rest-1", payload: latestSavedProfile() });

    const config = await getActiveRestaurantPaymentProfileRuntimeConfig("rest-1");
    expect(config.businessShortcode).toBe("174379");
    expect(config.callbackUrl).toBe("https://api.test.ubhona.com/payments/callback");
    expect(config.consumerKey).toBe("consumer-key");
  });
});