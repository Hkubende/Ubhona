import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  activateRestaurantPaymentProfile,
  disableRestaurantPaymentProfile,
  getRestaurantPaymentProfile,
  getRestaurantPaymentStatus,
  upsertRestaurantPaymentProfile,
  validateRestaurantPaymentProfile,
} from "../services/payment-profile.service.js";
import {
  getOrderPaymentStatus,
  getMpesaRuntimeStatus,
  handleStkCallback,
  initiateStkPushForOrder,
  type StkCallbackPayload,
} from "../services/payment.service.js";
import { requireAppAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

export const paymentsRouter = Router();
const stkLimiter = createRateLimiter({
  keyPrefix: "payments-stk",
  windowMs: 60 * 1000,
  max: 12,
  message: "Too many payment initiation attempts. Please retry shortly.",
});
const callbackLimiter = createRateLimiter({
  keyPrefix: "payments-callback",
  windowMs: 60 * 1000,
  max: 180,
  message: "Too many callback requests.",
});
const paymentStatusLimiter = createRateLimiter({
  keyPrefix: "payments-status",
  windowMs: 60 * 1000,
  max: 90,
  message: "Too many payment status checks. Please slow down.",
});

const stkCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      CheckoutRequestID: z.string().min(1),
      ResultCode: z.union([z.number(), z.string().min(1)]),
      ResultDesc: z.string().min(1),
      CallbackMetadata: z
        .object({
          Item: z
            .array(
              z.object({
                Name: z.string().min(1).optional(),
                Value: z.unknown().optional(),
              })
            )
            .optional(),
        })
        .optional(),
    }),
  }),
});

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidCallbackSecret(rawHeader: unknown) {
  const expected = String(process.env.MPESA_CALLBACK_SECRET || "").trim();
  if (!expected) return false;
  const provided = String(rawHeader || "").trim();
  if (!provided) return false;
  return safeEqual(expected, provided);
}

function paymentRouteLog(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[payments.route] ${message}`, details);
    return;
  }
  console.info(`[payments.route] ${message}`);
}

const paymentProfileSchema = z.object({
  provider: z.literal("mpesa").default("mpesa"),
  environment: z.enum(["sandbox", "live"]),
  accountDisplayName: z.string().trim().min(2).max(120),
  businessShortcode: z.string().trim().min(5).max(20),
  paybillNumber: z.string().trim().min(5).max(20).optional().nullable(),
  tillNumber: z.string().trim().min(5).max(20).optional().nullable(),
  consumerKey: z.string().trim().min(3).optional(),
  consumerSecret: z.string().trim().min(3).optional(),
  passkey: z.string().trim().min(3).optional(),
});

function requirePaymentProfileManager(req: AuthRequest) {
  if (req.user?.role !== "restaurant_owner") {
    throw new Error("Only restaurant owners can manage payment profiles.");
  }
}
function requireTenantRestaurantId(req: AuthRequest) {
  if (!req.user?.restaurantId) {
    throw new Error("Active restaurant context is missing.");
  }
  return req.user.restaurantId;
}

paymentsRouter.get("/profile", requireAppAuth, async (req: AuthRequest, res) => {
  try {
    requirePaymentProfileManager(req);
    const restaurantId = requireTenantRestaurantId(req);
    const profile = await getRestaurantPaymentProfile(restaurantId);
    res.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment profile.";
    const status = /Only restaurant owners/i.test(message) ? 403 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.get("/profile/status", requireAppAuth, async (req: AuthRequest, res) => {
  try {
    requirePaymentProfileManager(req);
    const restaurantId = requireTenantRestaurantId(req);
    const status = await getRestaurantPaymentStatus(restaurantId);
    res.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment profile status.";
    const status = /Only restaurant owners/i.test(message) ? 403 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.put("/profile", requireAppAuth, async (req: AuthRequest, res) => {
  try {
    requirePaymentProfileManager(req);
    const body = paymentProfileSchema.parse(req.body || {});
    const restaurantId = requireTenantRestaurantId(req);
    const profile = await upsertRestaurantPaymentProfile({
      restaurantId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      ...body,
    });
    res.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save payment profile.";
    const status = /Only restaurant owners/i.test(message) ? 403 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.post("/profile/validate", requireAppAuth, async (req: AuthRequest, res) => {
  try {
    requirePaymentProfileManager(req);
    const restaurantId = requireTenantRestaurantId(req);
    const profile = await validateRestaurantPaymentProfile({
      restaurantId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
    });
    res.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate payment profile.";
    const status = /Only restaurant owners/i.test(message) ? 403 : /Create a payment profile/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.post("/profile/activate", requireAppAuth, async (req: AuthRequest, res) => {
  try {
    requirePaymentProfileManager(req);
    const restaurantId = requireTenantRestaurantId(req);
    const profile = await activateRestaurantPaymentProfile({
      restaurantId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
    });
    res.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate payment profile.";
    const status = /Only restaurant owners/i.test(message) ? 403 : /Create a payment profile/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.post("/profile/disable", requireAppAuth, async (req: AuthRequest, res) => {
  try {
    requirePaymentProfileManager(req);
    const restaurantId = requireTenantRestaurantId(req);
    const profile = await disableRestaurantPaymentProfile({
      restaurantId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
    });
    res.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disable payment profile.";
    const status = /Only restaurant owners/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});
paymentsRouter.post("/stk", requireAppAuth, stkLimiter, async (req: AuthRequest, res) => {
  try {
    const body = z
      .object({
        orderId: z.string().min(1),
        phone: z.string().min(1),
      })
      .parse(req.body);
    const restaurantId = requireTenantRestaurantId(req);
    const result = await initiateStkPushForOrder({
      ...body,
      restaurantId,
      userId: req.user!.id,
      isAdmin: req.user!.role === "platform_admin",
    });
    if (!result.accepted) {
      res.status(400).json({
        ok: false,
        error: result.error,
        paymentId: result.payment.id,
      });
      return;
    }
    res.json({
      ok: true,
      paymentId: result.payment.id,
      checkoutRequestId: result.checkoutRequestId,
      message: "Payment prompt sent to phone.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send STK push.";
    const status = /does not belong/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.post("/callback", callbackLimiter, async (req, res) => {
  const mpesaStatus = getMpesaRuntimeStatus();
  if (!mpesaStatus.ready) {
    paymentRouteLog("callback.rejected.runtime_not_ready", {
      env: mpesaStatus.env,
      required: mpesaStatus.required,
    });
    res.status(503).json({ ok: false, error: "Payments callback handling is not configured for this runtime." });
    return;
  }
  const callbackSecretHeader =
    req.header("x-mpesa-callback-secret") || req.header("x-callback-secret") || req.header("x-webhook-secret");
  if (!isValidCallbackSecret(callbackSecretHeader)) {
    paymentRouteLog("callback.rejected.invalid_secret", {
      hasSecretHeader: Boolean(callbackSecretHeader),
    });
    res.status(401).json({ ok: false, error: "Invalid callback signature." });
    return;
  }
  try {
    const body = stkCallbackSchema.parse(req.body || {}) as StkCallbackPayload;
    const checkoutRequestId = String(body.Body?.stkCallback?.CheckoutRequestID || "");
    const resultCode = Number(body.Body?.stkCallback?.ResultCode ?? -1);
    paymentRouteLog("callback.received", {
      checkoutRequestId,
      resultCode,
    });
    const result = await handleStkCallback(body);
    if (result.ignored) {
      paymentRouteLog("callback.idempotent", {
        checkoutRequestId,
        duplicate: Boolean((result as { duplicate?: boolean }).duplicate),
        rejected: Boolean((result as { rejected?: boolean }).rejected),
      });
      res.json({ ok: true, ignored: true });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Callback handling failed.";
    paymentRouteLog("callback.rejected.invalid_payload", { error: message });
    res.status(400).json({ ok: false, error: message });
  }
});

paymentsRouter.get("/:orderId/status", requireAppAuth, paymentStatusLimiter, async (req: AuthRequest, res) => {
  try {
    const params = z.object({ orderId: z.string().min(1) }).parse(req.params);
    const restaurantId = requireTenantRestaurantId(req);
    const result = await getOrderPaymentStatus({
      orderId: params.orderId,
      restaurantId,
      userId: req.user!.id,
      isAdmin: req.user!.role === "platform_admin",
    });
    res.json({
      ok: true,
      orderId: result.order.id,
      restaurantId: result.order.restaurantId,
      paymentStatus: result.order.paymentStatus,
      orderStatus: result.order.status,
      paymentMethod: result.order.paymentMethod,
      paymentReference: result.order.paymentReference,
      payment: result.payment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment status.";
    const status = /does not belong/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});