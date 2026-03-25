import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  getOrderPaymentStatus,
  handleStkCallback,
  initiateStkPushForOrder,
  type StkCallbackPayload,
} from "../services/payment.service.js";
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

paymentsRouter.post("/stk", stkLimiter, async (req, res) => {
  try {
    const body = z
      .object({
        orderId: z.string().min(1),
        phone: z.string().min(1),
        restaurantId: z.string().min(1).optional(),
      })
      .parse(req.body);
    const result = await initiateStkPushForOrder(body);
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
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

paymentsRouter.post("/callback", callbackLimiter, async (req, res) => {
  const callbackSecretHeader =
    req.header("x-mpesa-callback-secret") || req.header("x-callback-secret") || req.header("x-webhook-secret");
  if (!isValidCallbackSecret(callbackSecretHeader)) {
    res.status(401).json({ ok: false, error: "Invalid callback signature." });
    return;
  }
  try {
    const result = await handleStkCallback((req.body || {}) as StkCallbackPayload);
    if (result.ignored) {
      res.json({ ok: true, ignored: true });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Callback handling failed.";
    res.status(400).json({ ok: false, error: message });
  }
});

paymentsRouter.get("/:orderId/status", paymentStatusLimiter, async (req, res) => {
  try {
    const params = z.object({ orderId: z.string().min(1) }).parse(req.params);
    const query = z.object({ restaurantId: z.string().min(1).optional() }).parse(req.query);
    const result = await getOrderPaymentStatus({
      orderId: params.orderId,
      restaurantId: query.restaurantId,
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
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});
