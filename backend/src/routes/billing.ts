import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import { prisma } from "../prisma.js";
import {
  applyBillingEvent,
  applyProviderCallback,
  getRestaurantBillingSnapshot,
  getRestaurantLimitStatus,
  initiateInvoicePayment,
  isRestaurantFeatureEnabled,
  markInvoiceManualPayment,
  reconcileBillingPayment,
  setDevBillingState,
  upgradeRestaurantPlan,
} from "../services/billing.service.js";
import { authAwareRateLimitKey, createRateLimiter } from "../middleware/rate-limit.js";

export const billingRouter = Router();
const billingWebhookLimiter = createRateLimiter({
  keyPrefix: "billing-webhook",
  windowMs: 60 * 1000,
  max: 180,
  message: "Too many billing webhook requests.",
});
const billingAuthedLimiter = createRateLimiter({
  keyPrefix: "billing-authed",
  windowMs: 60 * 1000,
  max: 80,
  keyGenerator: authAwareRateLimitKey,
  message: "Too many billing requests. Please slow down.",
});
const DEFAULT_PROVIDER = (["mpesa", "manual", "stripe"].includes(String(process.env.BILLING_DEFAULT_PROVIDER || ""))
  ? String(process.env.BILLING_DEFAULT_PROVIDER)
  : "manual") as "mpesa" | "manual" | "stripe";

function isWebhookAllowed(req: Request) {
  const expectedSecret = String(process.env.BILLING_WEBHOOK_SECRET || "").trim();
  if (!expectedSecret) return process.env.NODE_ENV !== "production";
  const provided = String(req.header("x-billing-webhook-secret") || "").trim();
  return provided.length > 0 && provided === expectedSecret;
}

billingRouter.post("/webhooks/:provider", billingWebhookLimiter, async (req, res) => {
  if (!isWebhookAllowed(req)) {
    res.status(401).json({ error: "Invalid webhook signature." });
    return;
  }
  try {
    const params = z.object({ provider: z.enum(["mpesa", "manual", "stripe"]) }).parse(req.params);
    const body = z
      .object({
        restaurantId: z.string().min(1).optional(),
        eventType: z
          .enum([
            "payment_initiated",
            "payment_completed",
            "payment_reconciled",
            "payment_failed",
            "payment_timeout",
            "payment_cancelled",
            "invoice_paid",
            "subscription_activated",
            "subscription_renewed",
            "subscription_cancelled",
            "trial_expired",
          ])
          .optional(),
        eventKey: z.string().optional(),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(req.body);
    if (body.eventType) {
      const restaurantId = String(body.restaurantId || body.payload.restaurantId || "").trim();
      if (!restaurantId) {
        res.status(400).json({ error: "restaurantId is required when eventType is provided." });
        return;
      }
      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      if (!restaurant) {
        res.status(404).json({ error: "Restaurant not found." });
        return;
      }
      const state = await applyBillingEvent({
        restaurant,
        provider: params.provider,
        eventType: body.eventType,
        payload: body.payload,
        eventKey: body.eventKey,
      });
      res.json({ ok: true, mode: "event", subscription: state.subscription });
      return;
    }
    const state = await applyProviderCallback({
      provider: params.provider,
      restaurantId: body.restaurantId,
      payload: body.payload,
    });
    res.json({ ok: true, mode: "provider_callback", subscription: state.subscription });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to apply billing webhook." });
  }
});

billingRouter.use(requireAuth);
billingRouter.use(billingAuthedLimiter);

billingRouter.get("/me", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const snapshot = await getRestaurantBillingSnapshot(restaurant);
  res.json(snapshot);
});

billingRouter.get("/entitlements", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const [snapshot, dishesLimit, ordersLimit] = await Promise.all([
    getRestaurantBillingSnapshot(restaurant),
    getRestaurantLimitStatus(restaurant, "dishes"),
    getRestaurantLimitStatus(restaurant, "ordersPerMonth"),
  ]);
  res.json({
    planId: snapshot.subscription.planId,
    status: snapshot.subscription.status,
    entitlements: snapshot.entitlements,
    limits: {
      dishes: dishesLimit,
      ordersPerMonth: ordersLimit,
    },
  });
});

billingRouter.post("/upgrade", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  try {
    const body = z
      .object({
        planId: z.enum(["starter", "growth", "pro"]),
        billingCycle: z.enum(["monthly", "annual"]).optional(),
        provider: z.enum(["mpesa", "manual", "stripe"]).default(DEFAULT_PROVIDER),
      })
      .parse(req.body);
    const state = await upgradeRestaurantPlan({
      restaurant,
      planId: body.planId,
      billingCycle: body.billingCycle,
      provider: body.provider,
    });
    res.json({
      subscription: state.subscription,
      entitlements: state.entitlements,
      invoices: state.invoices.slice(0, 10),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to upgrade plan." });
  }
});

billingRouter.post("/invoices/:invoiceId/pay", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  try {
    const params = z.object({ invoiceId: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        provider: z.enum(["mpesa", "manual", "stripe"]).default("mpesa"),
        method: z.string().default("mpesa"),
        customerPhone: z.string().optional(),
      })
      .parse(req.body);
    const payment = await initiateInvoicePayment({
      restaurant,
      invoiceId: params.invoiceId,
      provider: body.provider,
      method: body.method,
      customerPhone: body.customerPhone,
    });
    res.json({ ok: true, payment });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to initiate payment." });
  }
});

billingRouter.post("/invoices/:invoiceId/manual-mark", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  try {
    const params = z.object({ invoiceId: z.string().min(1) }).parse(req.params);
    const body = z.object({ notes: z.string().max(500).optional() }).parse(req.body || {});
    const payment = await markInvoiceManualPayment({
      restaurant,
      invoiceId: params.invoiceId,
      notes: body.notes,
      actorUserId: req.user?.id,
    });
    res.json({ ok: true, payment, message: "Manual billing marked as pending verification." });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to mark manual payment." });
  }
});

billingRouter.post("/payments/:paymentId/reconcile", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  try {
    const params = z.object({ paymentId: z.string().min(1) }).parse(req.params);
    const state = await reconcileBillingPayment({ restaurant, paymentId: params.paymentId });
    res.json({ ok: true, subscription: state.subscription, invoices: state.invoices.slice(0, 20), payments: state.payments.slice(0, 20) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reconcile payment." });
  }
});

billingRouter.get("/feature/:featureKey", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const params = z
    .object({
      featureKey: z.enum([
        "analytics",
        "ar",
        "customBranding",
        "advancedAnalytics",
        "printing",
        "waiterAccounts",
        "staffAccounts",
        "multiBranch",
      ]),
    })
    .parse(req.params);
  const enabled = await isRestaurantFeatureEnabled(restaurant, params.featureKey);
  res.json({ featureKey: params.featureKey, enabled });
});

billingRouter.post("/dev/simulate", async (req: AuthRequest, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  try {
    const body = z
      .object({
        eventType: z.enum(["payment_completed", "payment_failed", "payment_timeout", "payment_cancelled", "subscription_renewed", "trial_expired"]),
        paymentId: z.string().optional(),
        invoiceId: z.string().optional(),
      })
      .parse(req.body || {});
    const state = await applyBillingEvent({
      restaurant,
      provider: "mpesa",
      eventType: body.eventType,
      payload: {
        paymentId: body.paymentId,
        invoiceId: body.invoiceId,
        resultCode: body.eventType === "payment_completed" ? "0" : "500",
        resultDescription: `Dev simulation: ${body.eventType}`,
      },
      eventKey: `dev:${body.eventType}:${body.paymentId || "none"}:${body.invoiceId || "none"}`,
    });
    res.json({ ok: true, subscription: state.subscription, invoices: state.invoices.slice(0, 10), payments: state.payments.slice(0, 10) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to simulate billing event." });
  }
});

billingRouter.post("/dev/reset", async (req: AuthRequest, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  try {
    const body = z
      .object({
        planId: z.enum(["starter", "growth", "pro"]).optional(),
        status: z.enum(["trialing", "active", "past_due", "cancelled", "expired"]).optional(),
        resetUsage: z.boolean().optional(),
        resetInvoices: z.boolean().optional(),
      })
      .parse(req.body || {});
    const state = await setDevBillingState({
      restaurant,
      planId: body.planId,
      status: body.status,
      resetUsage: body.resetUsage,
      resetInvoices: body.resetInvoices,
    });
    res.json({ ok: true, subscription: state.subscription, entitlements: state.entitlements });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reset billing state." });
  }
});
