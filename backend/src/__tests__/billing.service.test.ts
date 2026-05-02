import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  restaurant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  dish: {
    count: vi.fn(),
  },
  order: {
    count: vi.fn(),
  },
};

const findRestaurantDocumentByKeyMock = vi.fn();
const upsertRestaurantDocumentMock = vi.fn();
const getBillingProviderMock = vi.fn();
const recordActivityEventMock = vi.fn();
const runWithPublicStorefrontDbContextMock = vi.fn(async (_restaurantId, fn) => fn());

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../db-rls.js", () => ({
  runWithPublicStorefrontDbContext: runWithPublicStorefrontDbContextMock,
}));

vi.mock("../services/tenant-document.service.js", () => ({
  findRestaurantDocumentByKey: findRestaurantDocumentByKeyMock,
  upsertRestaurantDocument: upsertRestaurantDocumentMock,
}));

vi.mock("../services/billing-provider.service.js", () => ({
  getBillingProvider: getBillingProviderMock,
}));

vi.mock("../services/activity.service.js", () => ({
  recordActivityEvent: recordActivityEventMock,
}));

const restaurant = {
  id: "rest-1",
  subscriptionPlan: "growth",
  subscriptionStatus: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  trialEndsAt: null,
  renewalDate: null,
};

function buildBillingState(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: "rest-1",
    subscription: {
      restaurantId: "rest-1",
      planId: "growth",
      status: "active",
      billingCycle: "monthly",
      startedAt: "2026-01-01T00:00:00.000Z",
      trialEndsAt: null,
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-04-30T23:59:59.999Z",
      cancelledAt: null,
      paymentProvider: "mpesa",
      externalSubscriptionId: null,
    },
    entitlements: [],
    invoices: [
      {
        id: "inv-1",
        restaurantId: "rest-1",
        subscriptionId: "rest-1:growth",
        planId: "growth",
        amount: 4999,
        currency: "KES",
        status: "pending",
        issuedAt: "2026-04-01T00:00:00.000Z",
        paidAt: null,
        dueAt: "2026-04-07T00:00:00.000Z",
        paymentReference: "UBHONA-ABC123",
        provider: "mpesa",
        notes: null,
      },
    ],
    payments: [
      {
        id: "pay-1",
        restaurantId: "rest-1",
        invoiceId: "inv-1",
        method: "stk_push",
        provider: "mpesa",
        amount: 4999,
        status: "processing",
        transactionReference: "txn-1",
        providerReference: "prov-1",
        merchantRequestId: "merchant-1",
        checkoutRequestId: "checkout-1",
        phoneNumber: null,
        resultCode: null,
        resultDescription: null,
        callbackPayload: null,
        reconciliationStatus: "pending",
        createdAt: "2026-04-01T00:00:00.000Z",
        completedAt: null,
      },
    ],
    events: [],
    ...overrides,
  };
}

describe("billing.service system audit coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.restaurant.findUnique.mockResolvedValue(restaurant);
    prismaMock.restaurant.update.mockResolvedValue(undefined);
    prismaMock.dish.count.mockResolvedValue(0);
    prismaMock.order.count.mockResolvedValue(0);
    upsertRestaurantDocumentMock.mockResolvedValue(undefined);
    recordActivityEventMock.mockResolvedValue(undefined);
    getBillingProviderMock.mockReturnValue({
      handleCallback: vi.fn().mockResolvedValue({
        internalStatus: "succeeded",
        payload: { providerPayload: true },
        eventKey: "mpesa:provider_callback:evt-1",
        transactionReference: "txn-1",
        providerReference: "prov-1",
        merchantRequestId: "merchant-1",
        checkoutRequestId: "checkout-1",
        resultCode: "0",
        resultDescription: "Paid",
      }),
      reconcilePayment: vi.fn().mockResolvedValue({
        internalStatus: "succeeded",
        providerReference: "prov-1",
        resultCode: "0",
        resultDescription: "Paid",
        raw: { ok: true },
      }),
    });
  });

  it("emits explicit system-actor audit for provider callbacks", async () => {
    findRestaurantDocumentByKeyMock.mockResolvedValue({
      key: "billing-state:rest-1",
      payload: buildBillingState(),
    });

    const { applyProviderCallback } = await import("../services/billing.service.js");
    await applyProviderCallback({
      provider: "mpesa",
      restaurantId: "rest-1",
      payload: {},
    });

    expect(recordActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        systemActorKey: "billing_provider_callback",
        actorRole: "platform_admin",
        action: "billing_provider_callback_processed",
        entityType: "billing_payment",
        entityId: "pay-1",
        source: "billing_provider_callback",
        restaurantId: "rest-1",
      })
    );
  });

  it("does not emit duplicate system audit when the callback event is already recorded", async () => {
    findRestaurantDocumentByKeyMock.mockResolvedValue({
      key: "billing-state:rest-1",
      payload: buildBillingState({
        events: [
          {
            id: "evt-1",
            restaurantId: "rest-1",
            provider: "mpesa",
            eventType: "payment_completed",
            createdAt: "2026-04-01T00:00:00.000Z",
            eventKey: "mpesa:provider_callback:evt-1",
            payload: { paymentId: "pay-1" },
          },
        ],
      }),
    });

    const { applyProviderCallback } = await import("../services/billing.service.js");
    await applyProviderCallback({
      provider: "mpesa",
      restaurantId: "rest-1",
      payload: {},
    });

    expect(recordActivityEventMock).not.toHaveBeenCalled();
  });

  it("keeps provider reconciliation outside the system-actor audit path", async () => {
    findRestaurantDocumentByKeyMock.mockResolvedValue({
      key: "billing-state:rest-1",
      payload: buildBillingState(),
    });

    const { reconcileBillingPayment } = await import("../services/billing.service.js");
    await reconcileBillingPayment({
      restaurant,
      paymentId: "pay-1",
    });

    expect(recordActivityEventMock).not.toHaveBeenCalled();
  });

  it("uses tenant-bound public DB context for billing state document bootstrap", async () => {
    findRestaurantDocumentByKeyMock.mockResolvedValue(null);

    const { getRestaurantBillingSnapshot } = await import("../services/billing.service.js");
    await getRestaurantBillingSnapshot(restaurant);

    expect(runWithPublicStorefrontDbContextMock).toHaveBeenCalledWith("rest-1", expect.any(Function));
    expect(findRestaurantDocumentByKeyMock).toHaveBeenCalledWith({
      restaurantId: "rest-1",
      key: "billing-state:rest-1",
    });
    expect(upsertRestaurantDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        key: "billing-state:rest-1",
      })
    );
  });
});
