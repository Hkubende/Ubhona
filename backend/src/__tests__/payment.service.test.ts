import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn(),
  payment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  restaurant: {
    findUnique: vi.fn(),
  },
  analyticsEvent: {
    create: vi.fn(),
  },
};

const runWithTenantContextMock = vi.fn(async ({ fn }) => fn(prismaMock));
const runWithPaymentCallbackContextMock = vi.fn(async ({ fn }) => fn(prismaMock));
const runWithPaymentCallbackRlsContextMock = vi.fn(async ({ fn }) => fn());
const findPaymentCallbackLinkageMock = vi.fn();
const applyBillingEventMock = vi.fn();
const recordActivityEventMock = vi.fn();
const handleOrderStatusWhatsAppNotificationsMock = vi.fn();
const getActiveRestaurantPaymentProfileRuntimeConfigMock = vi.fn();

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
  runWithTenantContext: runWithTenantContextMock,
  runWithPaymentCallbackContext: runWithPaymentCallbackContextMock,
  runWithPaymentCallbackRlsContext: runWithPaymentCallbackRlsContextMock,
  findPaymentCallbackLinkage: findPaymentCallbackLinkageMock,
  PAYMENT_CALLBACK_SYSTEM_USER_ID: "00000000-0000-0000-0000-000000000002",
}));

vi.mock("../services/billing.service.js", () => ({
  applyBillingEvent: applyBillingEventMock,
}));

vi.mock("../services/whatsapp.service.js", () => ({
  handleOrderStatusWhatsAppNotifications: handleOrderStatusWhatsAppNotificationsMock,
}));

vi.mock("../services/activity.service.js", () => ({
  recordActivityEvent: recordActivityEventMock,
}));

vi.mock("../services/payment-profile.service.js", () => ({
  getActiveRestaurantPaymentProfileRuntimeConfig: getActiveRestaurantPaymentProfileRuntimeConfigMock,
}));
describe("payment.service", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    prismaMock.$transaction.mockReset();
    prismaMock.payment.create.mockReset();
    prismaMock.payment.findFirst.mockReset();
    prismaMock.payment.updateMany.mockReset();
    prismaMock.payment.findUnique.mockReset();
    prismaMock.order.findUnique.mockReset();
    prismaMock.order.update.mockReset();
    prismaMock.restaurant.findUnique.mockReset();
    prismaMock.analyticsEvent.create.mockReset();
    runWithTenantContextMock.mockClear();
    runWithPaymentCallbackContextMock.mockClear();
    runWithPaymentCallbackRlsContextMock.mockClear();
    findPaymentCallbackLinkageMock.mockReset();
    applyBillingEventMock.mockReset();
    recordActivityEventMock.mockReset();
    handleOrderStatusWhatsAppNotificationsMock.mockReset();
    getActiveRestaurantPaymentProfileRuntimeConfigMock.mockReset();
    runWithPaymentCallbackContextMock.mockImplementation(async ({ fn }) => fn(prismaMock));
    runWithPaymentCallbackRlsContextMock.mockImplementation(async ({ fn }) => fn());
    applyBillingEventMock.mockResolvedValue(undefined);
    recordActivityEventMock.mockResolvedValue(undefined);
    handleOrderStatusWhatsAppNotificationsMock.mockResolvedValue(undefined);
    getActiveRestaurantPaymentProfileRuntimeConfigMock.mockResolvedValue({
      environment: "sandbox",
      businessShortcode: "123456",
      callbackUrl: "https://example.com/callback",
      consumerKey: "consumer-key",
      consumerSecret: "consumer-secret",
      passkey: "passkey",
    });
  });

  it("persists restaurantId when creating an STK payment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "token-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ResponseCode: "0",
          MerchantRequestID: "merchant-1",
          CheckoutRequestID: "checkout-1",
          ResponseDescription: "Accepted",
        }),
      });

    vi.stubGlobal("fetch", fetchMock);
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order-1",
      totalAmount: 1500,
      paymentStatus: "unpaid",
      restaurantId: "resto-1",
    });
    prismaMock.payment.create.mockResolvedValueOnce({
      id: "pay-1",
      orderId: "order-1",
      restaurantId: "resto-1",
    });
    prismaMock.order.update.mockResolvedValueOnce({});
    prismaMock.restaurant.findUnique.mockResolvedValueOnce({
      id: "resto-1",
      ownerUserId: "owner-1",
    });

    process.env.MPESA_CONSUMER_KEY = "consumer-key";
    process.env.MPESA_CONSUMER_SECRET = "consumer-secret";
    process.env.MPESA_SHORTCODE = "123456";
    process.env.MPESA_PASSKEY = "passkey";
    process.env.MPESA_CALLBACK_URL = "https://example.com/callback";
    process.env.MPESA_ENV = "sandbox";

    const { initiateStkPushForOrder } = await import("../services/payment.service.js");
    await initiateStkPushForOrder({
      orderId: "order-1",
      phone: "0712345678",
      restaurantId: "resto-1",
      userId: "owner-1",
      isAdmin: false,
    });

    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          restaurantId: "resto-1",
          orderId: "order-1",
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it("fails closed when callback linkage cannot resolve a tenant", async () => {
    findPaymentCallbackLinkageMock.mockResolvedValueOnce(null);

    const { handleStkCallback } = await import("../services/payment.service.js");
    const result = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "checkout-missing",
          ResultCode: 0,
          ResultDesc: "OK",
        },
      },
    });

    expect(result).toEqual({ ignored: true });
    expect(runWithPaymentCallbackContextMock).not.toHaveBeenCalled();
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("rejects mismatched restaurant hints before tenant writes begin", async () => {
    findPaymentCallbackLinkageMock.mockResolvedValueOnce({
      paymentId: "pay-1",
      orderId: "order-1",
      paymentRestaurantId: "11111111-1111-4111-8111-111111111111",
      orderRestaurantId: "11111111-1111-4111-8111-111111111111",
      paymentStatus: "processing",
      orderStatus: "pending",
      orderPaymentStatus: "processing",
      resultCode: 0,
      receiptNumber: null,
      checkoutRequestId: "checkout-1",
      merchantRequestId: "merchant-1",
    });

    const { handleStkCallback } = await import("../services/payment.service.js");
    const result = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "checkout-1",
          ResultCode: 0,
          ResultDesc: "OK",
          CallbackMetadata: {
            Item: [{ Name: "RestaurantId", Value: "22222222-2222-4222-8222-222222222222" }],
          },
        },
      },
    });

    expect(result).toEqual({ ignored: true, rejected: true });
    expect(runWithPaymentCallbackContextMock).not.toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("treats same terminal callback as duplicate without side effects", async () => {
    findPaymentCallbackLinkageMock.mockResolvedValueOnce({
      paymentId: "pay-1",
      orderId: "order-1",
      paymentRestaurantId: "resto-1",
      orderRestaurantId: "resto-1",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      orderPaymentStatus: "paid",
      resultCode: 0,
      receiptNumber: "ABC123",
      checkoutRequestId: "checkout-1",
      merchantRequestId: "merchant-1",
    });
    prismaMock.payment.findFirst.mockResolvedValueOnce({
      id: "pay-1",
      orderId: "order-1",
      status: "paid",
      resultCode: 0,
      receiptNumber: "ABC123",
      order: {
        restaurantId: "resto-1",
        status: "confirmed",
        paymentStatus: "paid",
      },
    });

    const { handleStkCallback } = await import("../services/payment.service.js");
    const result = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "checkout-1",
          ResultCode: 0,
          ResultDesc: "OK",
          CallbackMetadata: {
            Item: [{ Name: "MpesaReceiptNumber", Value: "ABC123" }],
          },
        },
      },
    });

    expect(result).toEqual({ ignored: true, duplicate: true });
    expect(runWithPaymentCallbackContextMock).toHaveBeenCalledOnce();
    expect(runWithPaymentCallbackRlsContextMock).not.toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("atomically rejects conflicting terminal callbacks", async () => {
    findPaymentCallbackLinkageMock.mockResolvedValueOnce({
      paymentId: "pay-1",
      orderId: "order-1",
      paymentRestaurantId: "resto-1",
      orderRestaurantId: "resto-1",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      orderPaymentStatus: "paid",
      resultCode: 0,
      receiptNumber: "ABC123",
      checkoutRequestId: "checkout-1",
      merchantRequestId: "merchant-1",
    });
    prismaMock.payment.findFirst.mockResolvedValueOnce({
      id: "pay-1",
      orderId: "order-1",
      status: "paid",
      resultCode: 0,
      receiptNumber: "ABC123",
      order: {
        restaurantId: "resto-1",
        status: "confirmed",
        paymentStatus: "paid",
      },
    });

    const { handleStkCallback } = await import("../services/payment.service.js");
    const result = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "checkout-1",
          ResultCode: 1032,
          ResultDesc: "Cancelled",
        },
      },
    });

    expect(result).toEqual({ ignored: true, rejected: true });
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("only emits non-critical side effects after a trusted terminal transition succeeds", async () => {
    findPaymentCallbackLinkageMock.mockResolvedValueOnce({
      paymentId: "pay-1",
      orderId: "order-1",
      paymentRestaurantId: "resto-1",
      orderRestaurantId: "resto-1",
      paymentStatus: "processing",
      orderStatus: "pending",
      orderPaymentStatus: "processing",
      resultCode: 0,
      receiptNumber: null,
      checkoutRequestId: "checkout-1",
      merchantRequestId: "merchant-1",
    });
    prismaMock.payment.findFirst.mockResolvedValueOnce({
      id: "pay-1",
      orderId: "order-1",
      status: "processing",
      resultCode: 0,
      receiptNumber: null,
      order: {
        restaurantId: "resto-1",
        status: "pending",
        paymentStatus: "processing",
      },
    });
    prismaMock.payment.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.order.update.mockResolvedValueOnce({});
    prismaMock.restaurant.findUnique.mockResolvedValueOnce({
      id: "resto-1",
      subscriptionPlan: "growth",
      subscriptionStatus: "active",
      createdAt: new Date("2026-04-16T00:00:00.000Z"),
      trialEndsAt: null,
      renewalDate: null,
    });

    const { handleStkCallback } = await import("../services/payment.service.js");
    const result = await handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "checkout-1",
          ResultCode: 0,
          ResultDesc: "OK",
          CallbackMetadata: {
            Item: [{ Name: "MpesaReceiptNumber", Value: "ABC123" }],
          },
        },
      },
    });

    expect(result).toEqual({ ignored: false });
    expect(runWithPaymentCallbackContextMock).toHaveBeenCalledTimes(1);
    expect(runWithPaymentCallbackRlsContextMock).toHaveBeenCalledTimes(3);
    expect(prismaMock.payment.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.order.update).toHaveBeenCalledOnce();
    expect(recordActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        systemActorKey: "payment_provider_callback",
        actorRole: "platform_admin",
      })
    );
  });

  it("keeps persisted callback success even when a non-critical side effect is slow", async () => {
    vi.useFakeTimers();
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    findPaymentCallbackLinkageMock.mockResolvedValueOnce({
      paymentId: "pay-1",
      orderId: "order-1",
      paymentRestaurantId: "resto-1",
      orderRestaurantId: "resto-1",
      paymentStatus: "processing",
      orderStatus: "pending",
      orderPaymentStatus: "processing",
      resultCode: 0,
      receiptNumber: null,
      checkoutRequestId: "checkout-1",
      merchantRequestId: "merchant-1",
    });
    prismaMock.payment.findFirst.mockResolvedValueOnce({
      id: "pay-1",
      orderId: "order-1",
      status: "processing",
      resultCode: 0,
      receiptNumber: null,
      order: {
        restaurantId: "resto-1",
        status: "pending",
        paymentStatus: "processing",
      },
    });
    prismaMock.payment.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.order.update.mockResolvedValueOnce({});
    prismaMock.restaurant.findUnique.mockResolvedValueOnce({
      id: "resto-1",
      subscriptionPlan: "growth",
      subscriptionStatus: "active",
      createdAt: new Date("2026-04-16T00:00:00.000Z"),
      trialEndsAt: null,
      renewalDate: null,
    });
    applyBillingEventMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 6000))
    );

    const { handleStkCallback } = await import("../services/payment.service.js");
    const resultPromise = handleStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "checkout-1",
          ResultCode: 0,
          ResultDesc: "OK",
          CallbackMetadata: {
            Item: [{ Name: "MpesaReceiptNumber", Value: "ABC123" }],
          },
        },
      },
    });

    const result = await resultPromise;
    expect(result).toEqual({ ignored: false });

    await vi.advanceTimersByTimeAsync(5000);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[payments] callback.side_effect.slow",
      expect.objectContaining({
        sideEffect: "billing_event",
        criticality: "non_critical",
        timeoutMs: 5000,
      })
    );

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[payments] callback.side_effect.completed",
      expect.objectContaining({
        sideEffect: "billing_event",
        criticality: "non_critical",
        completedAfterTimeout: true,
      })
    );
  });
});