import {
  findPaymentCallbackLinkage,
  prisma,
  runWithPaymentCallbackContext,
  runWithPaymentCallbackRlsContext,
  runWithTenantContext,
  type PaymentCallbackActorContext,
  type PaymentCallbackLinkage,
} from "../prisma.js";
import { Prisma } from "@prisma/client";
import { applyBillingEvent } from "./billing.service.js";
import { handleOrderStatusWhatsAppNotifications } from "./whatsapp.service.js";
import { recordActivityEvent } from "./activity.service.js";
import { PAYMENT_CALLBACK_SYSTEM_ACTOR_KEY, PAYMENT_CALLBACK_SYSTEM_ROLE } from "./system-actors.js";
import { getActiveRestaurantPaymentProfileRuntimeConfig } from "./payment-profile.service.js";

type MpesaConfig = {
  env: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
};

type MpesaRuntimeStatus = {
  ready: boolean;
  env: "sandbox" | "production";
  required: Record<"consumerKey" | "consumerSecret" | "shortcode" | "passkey" | "callbackUrl" | "callbackSecret", boolean>;
};

type CallbackTransitionResult =
  | {
      type: "missing_payment";
    }
  | {
      type: "duplicate";
      paymentId: string;
      orderId: string;
      restaurantId: string;
      checkoutRequestId: string;
      resultCode: number;
      receipt: string;
    }
  | {
      type: "conflicting_terminal_state";
      paymentId: string;
      orderId: string;
      restaurantId: string;
      checkoutRequestId: string;
      currentStatus: string;
      incomingStatus: string;
      resultCode: number;
    }
  | {
      type: "processed";
      paymentId: string;
      orderId: string;
      restaurantId: string;
      checkoutRequestId: string;
      resultCode: number;
      resultDesc: string;
      receipt: string;
      nextPaymentStatus: string;
      nextOrderStatus: string;
      previousOrderStatus: string;
    };

const CALLBACK_SIDE_EFFECT_TIMEOUT_MS = 5000;

export type StkCallbackPayload = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number | string;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name?: string; Value?: unknown }>;
      };
    };
  };
};

function paymentLog(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[payments] ${message}`, details);
    return;
  }
  console.info(`[payments] ${message}`);
}


function runPaymentSideEffect(
  name: string,
  context: Record<string, unknown>,
  task: () => Promise<unknown>
) {
  void (async () => {
    const startedAt = Date.now();
    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      paymentLog("callback.side_effect.slow", {
        ...context,
        sideEffect: name,
        timeoutMs: CALLBACK_SIDE_EFFECT_TIMEOUT_MS,
        criticality: "non_critical",
      });
    }, CALLBACK_SIDE_EFFECT_TIMEOUT_MS);

    try {
      await task();
      paymentLog("callback.side_effect.completed", {
        ...context,
        sideEffect: name,
        durationMs: Date.now() - startedAt,
        completedAfterTimeout: timedOut,
        criticality: "non_critical",
      });
    } catch (error) {
      paymentLog("callback.side_effect.failed", {
        ...context,
        sideEffect: name,
        durationMs: Date.now() - startedAt,
        failedAfterTimeout: timedOut,
        criticality: "non_critical",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeoutHandle);
    }
  })();
}

export function getMpesaRuntimeStatus(): MpesaRuntimeStatus {
  const env = (process.env.MPESA_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
  const required = {
    consumerKey: Boolean(String(process.env.MPESA_CONSUMER_KEY || "").trim()),
    consumerSecret: Boolean(String(process.env.MPESA_CONSUMER_SECRET || "").trim()),
    shortcode: Boolean(String(process.env.MPESA_SHORTCODE || "").trim()),
    passkey: Boolean(String(process.env.MPESA_PASSKEY || "").trim()),
    callbackUrl: Boolean(String(process.env.MPESA_CALLBACK_URL || "").trim()),
    callbackSecret: Boolean(String(process.env.MPESA_CALLBACK_SECRET || "").trim()),
  } as const;
  return {
    ready: Object.values(required).every(Boolean),
    env,
    required: { ...required },
  };
}

async function getMpesaConfig(restaurantId: string): Promise<MpesaConfig> {
  const profile = await getActiveRestaurantPaymentProfileRuntimeConfig(restaurantId);
  return {
    env: profile.environment === "live" ? "production" : "sandbox",
    consumerKey: profile.consumerKey,
    consumerSecret: profile.consumerSecret,
    shortcode: profile.businessShortcode,
    passkey: profile.passkey,
    callbackUrl: profile.callbackUrl,
  };
}

export function normalizePhone(input: string) {
  const raw = String(input || "").trim().replace(/[^\d+]/g, "");
  if (/^07\d{8}$/.test(raw)) return `254${raw.slice(1)}`;
  if (/^2547\d{8}$/.test(raw)) return raw;
  if (/^\+2547\d{8}$/.test(raw)) return raw.slice(1);
  return null;
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

async function getAccessToken(config: MpesaConfig) {
  const base = config.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error("Failed to get M-Pesa access token.");
  }
  return body.access_token;
}

export async function initiateStkPushForOrder(input: {
  orderId: string;
  phone: string;
  restaurantId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const order = await runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) =>
      tx.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, totalAmount: true, paymentStatus: true, restaurantId: true },
      }),
  });
  if (!order) {
    throw new Error("Order not found.");
  }
  if (order.paymentStatus === "paid") {
    throw new Error("Order is already paid.");
  }

  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("Invalid phone. Use 07XXXXXXXX or 2547XXXXXXXX.");
  }

  const config = await getMpesaConfig(order.restaurantId);
  const timestamp = getTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
  const token = await getAccessToken(config);
  const base = config.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(order.totalAmount)),
    PartyA: phone,
    PartyB: config.shortcode,
    PhoneNumber: phone,
    CallBackURL: config.callbackUrl,
    AccountReference: order.id,
    TransactionDesc: "MenuVista Order",
  };

  const stkResponse = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const stkBody = (await stkResponse.json().catch(() => null)) as
    | {
        ResponseCode?: string;
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResponseDescription?: string;
        errorMessage?: string;
      }
    | null;

  const accepted = stkResponse.ok && stkBody?.ResponseCode === "0";
  const { payment } = await runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) => {
      const payment = await tx.payment.create({
        data: {
          restaurantId: order.restaurantId,
          orderId: order.id,
          provider: "mpesa",
          phone,
          amount: payload.Amount,
          status: accepted ? "processing" : "failed",
          checkoutRequestId: stkBody?.CheckoutRequestID || null,
          merchantRequestId: stkBody?.MerchantRequestID || null,
          resultCode: accepted ? 0 : -1,
          resultDesc: stkBody?.ResponseDescription || stkBody?.errorMessage || "STK request failed",
          requestPayload: payload,
          responsePayload: stkBody ?? {},
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: "stk_push",
          paymentStatus: accepted ? "processing" : "failed",
          paymentReference: stkBody?.CheckoutRequestID || payment.id,
        },
      });

      if (!accepted) {
        await tx.analyticsEvent.create({
          data: {
            restaurantId: order.restaurantId,
            orderId: order.id,
            eventType: "payment_failed",
            source: "stk_request",
            metadata: {
              reason: stkBody?.errorMessage || stkBody?.ResponseDescription || "STK request failed",
              checkoutRequestId: stkBody?.CheckoutRequestID || null,
            },
          },
        });
      }

      return { payment };
    },
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: order.restaurantId },
    select: { id: true, ownerUserId: true },
  });
  if (restaurant) {
    await recordActivityEvent({
      actorUserId: restaurant.ownerUserId,
      actorRole: "restaurant_owner",
      action: "payment_status_changed",
      entityType: "order",
      entityId: order.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      source: "mpesa_stk_initiate",
      before: { paymentStatus: order.paymentStatus },
      after: { paymentStatus: accepted ? "processing" : "failed" },
      metadata: {
        method: "stk_push",
        checkoutRequestId: stkBody?.CheckoutRequestID || null,
        paymentId: payment.id,
      },
    });
  }

  if (!accepted) {
    const failedRestaurant = await prisma.restaurant.findUnique({ where: { id: order.restaurantId } });
    if (failedRestaurant) {
      await applyBillingEvent({
        restaurant: failedRestaurant,
        provider: "mpesa",
        eventType: "payment_failed",
        payload: { source: "stk_request", orderId: order.id },
      });
    }
  }

  return {
    accepted,
    payment,
    checkoutRequestId: stkBody?.CheckoutRequestID || "",
    error: stkBody?.errorMessage || stkBody?.ResponseDescription || "STK request failed",
  };
}

type CallbackRestaurantHint = {
  restaurantId: string;
  source: "callback_metadata_restaurant_id";
};

type CallbackResolutionSource = "persisted_payment_linkage";

type PaymentCallbackResolution =
  | {
      type: "trusted";
      linkage: PaymentCallbackLinkage;
      actor: PaymentCallbackActorContext;
      resolutionSource: CallbackResolutionSource;
    }
  | {
      type: "missing_linkage";
    }
  | {
      type: "inconsistent_internal_linkage";
      paymentRestaurantId: string;
      orderRestaurantId: string;
    }
  | {
      type: "conflicting_restaurant_hint";
      trustedRestaurantId: string;
      hintedRestaurantId: string;
      hintSource: CallbackRestaurantHint["source"];
    };

function normalizeUuid(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw.toLowerCase()
    : null;
}

function extractCallbackRestaurantHint(metadataMap: Map<string, unknown>): CallbackRestaurantHint | null {
  for (const key of ["RestaurantId", "RestaurantID", "restaurantId", "restaurant_id"]) {
    const restaurantId = normalizeUuid(metadataMap.get(key));
    if (restaurantId) {
      return {
        restaurantId,
        source: "callback_metadata_restaurant_id",
      };
    }
  }
  return null;
}

async function resolvePaymentCallbackContext(input: {
  checkoutRequestId: string;
  restaurantHint: CallbackRestaurantHint | null;
}): Promise<PaymentCallbackResolution> {
  const linkage = await findPaymentCallbackLinkage({ actorIdentifier: input.checkoutRequestId });
  if (!linkage) {
    return { type: "missing_linkage" };
  }

  if (linkage.paymentRestaurantId !== linkage.orderRestaurantId) {
    return {
      type: "inconsistent_internal_linkage",
      paymentRestaurantId: linkage.paymentRestaurantId,
      orderRestaurantId: linkage.orderRestaurantId,
    };
  }

  if (input.restaurantHint && input.restaurantHint.restaurantId !== linkage.paymentRestaurantId) {
    return {
      type: "conflicting_restaurant_hint",
      trustedRestaurantId: linkage.paymentRestaurantId,
      hintedRestaurantId: input.restaurantHint.restaurantId,
      hintSource: input.restaurantHint.source,
    };
  }

  return {
    type: "trusted",
    linkage,
    resolutionSource: "persisted_payment_linkage",
    actor: {
      actorType: "payment_provider_callback",
      actorIdentifier: input.checkoutRequestId,
      restaurantId: linkage.paymentRestaurantId,
      isAdmin: false,
    },
  };
}

export async function handleStkCallback(callback: StkCallbackPayload) {
  const stkCallback = callback?.Body?.stkCallback;
  if (!stkCallback) {
    throw new Error("Invalid callback payload.");
  }
  const checkoutRequestId = String(stkCallback.CheckoutRequestID || "");
  const resultCode = Number(stkCallback.ResultCode ?? -1);
  const resultDesc = String(stkCallback.ResultDesc || "");
  if (!checkoutRequestId) {
    throw new Error("Invalid callback payload: CheckoutRequestID is required.");
  }

  const metadataItems = Array.isArray(stkCallback.CallbackMetadata?.Item) ? stkCallback.CallbackMetadata.Item : [];
  const metadataMap = new Map<string, unknown>();
  for (const item of metadataItems) {
    if (item?.Name) metadataMap.set(String(item.Name), item.Value);
  }
  const receipt = String(metadataMap.get("MpesaReceiptNumber") || "");
  const restaurantHint = extractCallbackRestaurantHint(metadataMap);
  const resolution = await resolvePaymentCallbackContext({
    checkoutRequestId,
    restaurantHint,
  });

  if (resolution.type === "missing_linkage") {
    paymentLog("callback.ignored.missing_payment_linkage", { checkoutRequestId, resultCode });
    return { ignored: true };
  }

  if (resolution.type === "inconsistent_internal_linkage") {
    paymentLog("callback.rejected.inconsistent_internal_linkage", {
      checkoutRequestId,
      resultCode,
      paymentRestaurantId: resolution.paymentRestaurantId,
      orderRestaurantId: resolution.orderRestaurantId,
    });
    return { ignored: true, rejected: true };
  }

  if (resolution.type === "conflicting_restaurant_hint") {
    paymentLog("callback.rejected.conflicting_restaurant_hint", {
      checkoutRequestId,
      resultCode,
      trustedRestaurantId: resolution.trustedRestaurantId,
      hintedRestaurantId: resolution.hintedRestaurantId,
      hintSource: resolution.hintSource,
    });
    return { ignored: true, rejected: true };
  }

  const callbackActor = resolution.actor;
  const transition = await runWithPaymentCallbackContext({
    ...callbackActor,
    fn: async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { checkoutRequestId },
        select: {
          id: true,
          orderId: true,
          status: true,
          resultCode: true,
          receiptNumber: true,
          order: { select: { restaurantId: true, status: true, paymentStatus: true } },
        },
      });
      if (!payment) {
        return { type: "missing_payment" } satisfies CallbackTransitionResult;
      }

      const isSuccess = resultCode === 0;
      const nextPaymentStatus = isSuccess ? "paid" : "failed";
      const nextOrderStatus = isSuccess && payment.order.status === "pending" ? "confirmed" : payment.order.status;
      const alreadyTerminal = payment.status === "paid" || payment.status === "failed";
      const isSameCallback =
        alreadyTerminal &&
        payment.status === nextPaymentStatus &&
        (payment.resultCode ?? null) === resultCode &&
        String(payment.receiptNumber || "") === receipt;

      if (isSameCallback) {
        return {
          type: "duplicate",
          paymentId: payment.id,
          orderId: payment.orderId,
          restaurantId: payment.order.restaurantId,
          checkoutRequestId,
          resultCode,
          receipt,
        } satisfies CallbackTransitionResult;
      }

      if (alreadyTerminal && payment.status !== nextPaymentStatus) {
        return {
          type: "conflicting_terminal_state",
          paymentId: payment.id,
          orderId: payment.orderId,
          restaurantId: payment.order.restaurantId,
          checkoutRequestId,
          currentStatus: payment.status,
          incomingStatus: nextPaymentStatus,
          resultCode,
        } satisfies CallbackTransitionResult;
      }

      const updated = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: {
            notIn: ["paid", "failed"],
          },
        },
        data: {
          status: nextPaymentStatus,
          resultCode,
          resultDesc,
          receiptNumber: receipt || null,
          callbackPayload: callback as unknown as Prisma.InputJsonValue,
        },
      });

      if (updated.count === 0) {
        const latest = await tx.payment.findUnique({
          where: { id: payment.id },
          select: {
            id: true,
            orderId: true,
            status: true,
            resultCode: true,
            receiptNumber: true,
            order: { select: { restaurantId: true } },
          },
        });
        if (!latest) {
          return { type: "missing_payment" } satisfies CallbackTransitionResult;
        }
        const latestMatchesIncoming =
          latest.status === nextPaymentStatus &&
          (latest.resultCode ?? null) === resultCode &&
          String(latest.receiptNumber || "") === receipt;
        if (latestMatchesIncoming) {
          return {
            type: "duplicate",
            paymentId: latest.id,
            orderId: latest.orderId,
            restaurantId: latest.order.restaurantId,
            checkoutRequestId,
            resultCode,
            receipt,
          } satisfies CallbackTransitionResult;
        }
        return {
          type: "conflicting_terminal_state",
          paymentId: latest.id,
          orderId: latest.orderId,
          restaurantId: latest.order.restaurantId,
          checkoutRequestId,
          currentStatus: latest.status,
          incomingStatus: nextPaymentStatus,
          resultCode,
        } satisfies CallbackTransitionResult;
      }

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: nextPaymentStatus,
          paymentReference: receipt || checkoutRequestId,
          status: nextOrderStatus,
        },
      });

      return {
        type: "processed",
        paymentId: payment.id,
        orderId: payment.orderId,
        restaurantId: payment.order.restaurantId,
        checkoutRequestId,
        resultCode,
        resultDesc,
        receipt,
        nextPaymentStatus,
        nextOrderStatus,
        previousOrderStatus: payment.order.status,
      } satisfies CallbackTransitionResult;
    },
  });

  if (transition.type === "missing_payment") {
    paymentLog("callback.ignored.missing_payment", { checkoutRequestId, resultCode });
    return { ignored: true };
  }

  if (transition.type === "duplicate") {
    paymentLog("callback.duplicate", {
      paymentId: transition.paymentId,
      orderId: transition.orderId,
      checkoutRequestId,
      resultCode,
      receiptNumber: transition.receipt || null,
    });
    return { ignored: true, duplicate: true };
  }

  if (transition.type === "conflicting_terminal_state") {
    paymentLog("callback.rejected.conflicting_terminal_state", {
      paymentId: transition.paymentId,
      orderId: transition.orderId,
      checkoutRequestId,
      currentStatus: transition.currentStatus,
      incomingStatus: transition.incomingStatus,
      resultCode,
    });
    return { ignored: true, rejected: true };
  }

  paymentLog("callback.processing", {
    paymentId: transition.paymentId,
    orderId: transition.orderId,
    checkoutRequestId,
    resultCode,
    receiptNumber: transition.receipt || null,
    actorType: callbackActor.actorType,
    resolutionSource: resolution.resolutionSource,
  });

  const sideEffectContext = {
    paymentId: transition.paymentId,
    orderId: transition.orderId,
    restaurantId: transition.restaurantId,
    checkoutRequestId,
    resultCode,
    actorType: callbackActor.actorType,
    actorIdentifier: callbackActor.actorIdentifier,
    resolutionSource: resolution.resolutionSource,
  };

  paymentLog("callback.processed", {
    paymentId: transition.paymentId,
    orderId: transition.orderId,
    checkoutRequestId,
    paymentStatus: transition.nextPaymentStatus,
    orderStatus: transition.nextOrderStatus,
    actorType: callbackActor.actorType,
    resolutionSource: resolution.resolutionSource,
  });

  runPaymentSideEffect("record_activity", sideEffectContext, () =>
    recordActivityEvent({
      systemActorKey: PAYMENT_CALLBACK_SYSTEM_ACTOR_KEY,
      actorRole: PAYMENT_CALLBACK_SYSTEM_ROLE,
      action: "payment_status_changed",
      entityType: "order",
      entityId: transition.orderId,
      organizationId: transition.restaurantId,
      restaurantId: transition.restaurantId,
      source: "mpesa_callback",
      before: { paymentStatus: "processing" },
      after: { paymentStatus: transition.nextPaymentStatus },
      metadata: {
        actorType: callbackActor.actorType,
        actorIdentifier: callbackActor.actorIdentifier,
        resolutionSource: resolution.resolutionSource,
        method: "stk_push",
        checkoutRequestId,
        receiptNumber: transition.receipt || null,
        resultCode,
        resultDesc: transition.resultDesc,
      },
    })
  );

  if (transition.nextOrderStatus !== transition.previousOrderStatus) {
    runPaymentSideEffect("whatsapp_notifications", sideEffectContext, () =>
      runWithPaymentCallbackRlsContext({
        ...callbackActor,
        fn: async () =>
          handleOrderStatusWhatsAppNotifications({
            orderId: transition.orderId,
            restaurantId: transition.restaurantId,
            status: transition.nextOrderStatus,
          }),
      })
    );
  }

  runPaymentSideEffect("analytics_event", sideEffectContext, () =>
    runWithPaymentCallbackRlsContext({
      ...callbackActor,
      fn: async () =>
        prisma.analyticsEvent.create({
          data: {
            restaurantId: transition.restaurantId,
            orderId: transition.orderId,
            eventType: transition.nextPaymentStatus === "paid" ? "payment_success" : "payment_failed",
            source: "callback",
            metadata: transition.nextPaymentStatus === "paid"
              ? {
                  actorType: callbackActor.actorType,
                  actorIdentifier: callbackActor.actorIdentifier,
                  resolutionSource: resolution.resolutionSource,
                  checkoutRequestId,
                  receiptNumber: transition.receipt || null,
                }
              : {
                  actorType: callbackActor.actorType,
                  actorIdentifier: callbackActor.actorIdentifier,
                  resolutionSource: resolution.resolutionSource,
                  checkoutRequestId,
                  resultCode,
                  resultDesc: transition.resultDesc,
                },
          },
        }),
    })
  );

  runPaymentSideEffect("billing_event", sideEffectContext, () =>
    runWithPaymentCallbackRlsContext({
      ...callbackActor,
      fn: async () => {
        const restaurant = await prisma.restaurant.findUnique({
          where: { id: transition.restaurantId },
          select: {
            id: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            createdAt: true,
            trialEndsAt: true,
            renewalDate: true,
          },
        });
        if (!restaurant) {
          paymentLog("callback.side_effect.skipped", {
            ...sideEffectContext,
            sideEffect: "billing_event",
            criticality: "non_critical",
            reason: "restaurant_not_found",
          });
          return;
        }
        await applyBillingEvent({
          restaurant,
          provider: "mpesa",
          eventType: transition.nextPaymentStatus === "paid" ? "payment_succeeded" : "payment_failed",
          payload: transition.nextPaymentStatus === "paid"
            ? { orderId: transition.orderId, checkoutRequestId, receiptNumber: transition.receipt || null }
            : { orderId: transition.orderId, checkoutRequestId, resultCode, resultDesc: transition.resultDesc },
        });
      },
    })
  );

  return { ignored: false };
}

export async function getOrderPaymentStatus(input: {
  orderId: string;
  restaurantId: string;
  userId: string;
  isAdmin: boolean;
}) {
  return runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          restaurantId: true,
          paymentStatus: true,
          status: true,
          paymentMethod: true,
          paymentReference: true,
        },
      });
      if (!order) {
        throw new Error("Order not found.");
      }
      const latestPayment = await tx.payment.findFirst({
        where: { orderId: input.orderId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          phone: true,
          amount: true,
          checkoutRequestId: true,
          receiptNumber: true,
          resultCode: true,
          resultDesc: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return { order, payment: latestPayment };
    },
  });
}
