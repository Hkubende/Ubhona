import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import { prisma } from "../prisma.js";
import {
  ANALYTICS_EVENT_TYPES,
  getAnalyticsSummary,
  getConversionMetrics,
  getTopDishes,
  recordAnalyticsEvent,
  type AnalyticsEventType,
} from "../services/analytics.service.js";
import { hasPlanFeature } from "../services/subscription.service.js";

const eventSchema = z.object({
  restaurantId: z.string().min(1),
  eventType: z.enum(ANALYTICS_EVENT_TYPES),
  dishId: z.string().optional(),
  orderId: z.string().optional(),
  source: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const analyticsRouter = Router();

async function ingestEvent(req: any, res: any) {
  try {
    const body = eventSchema.parse(req.body);
    const analyticsAllowedEvents = new Set<AnalyticsEventType>(["order_created", "payment_success", "payment_failed"]);
    if (!analyticsAllowedEvents.has(body.eventType as AnalyticsEventType)) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: body.restaurantId },
        select: { subscriptionPlan: true },
      });
      if (!restaurant) {
        res.status(404).json({ error: "Restaurant not found." });
        return;
      }
      if (!hasPlanFeature(restaurant.subscriptionPlan, "analytics")) {
        res.status(403).json({ error: "Analytics is available on Pro and Enterprise plans." });
        return;
      }
    }
    const event = await recordAnalyticsEvent(body);
    res.status(201).json({ ok: true, event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save analytics event.";
    const status = /not found|does not belong/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

analyticsRouter.post("/events", ingestEvent);

// Backward compatibility for older clients
analyticsRouter.post("/event", ingestEvent);

analyticsRouter.get("/summary", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  if (!hasPlanFeature(restaurant.subscriptionPlan, "analytics")) {
    res.status(403).json({ error: "Upgrade to Pro to unlock analytics." });
    return;
  }
  const query = z
    .object({
      days: z.coerce.number().int().positive().max(365).optional(),
    })
    .safeParse(req.query);
  const days = query.success ? query.data.days || 30 : 30;
  const summary = await getAnalyticsSummary(restaurant.id, days);
  res.json(summary);
});

analyticsRouter.get("/top-dishes", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  if (!hasPlanFeature(restaurant.subscriptionPlan, "analytics")) {
    res.status(403).json({ error: "Upgrade to Pro to unlock analytics." });
    return;
  }
  const query = z
    .object({
      days: z.coerce.number().int().positive().max(365).optional(),
    })
    .safeParse(req.query);
  const days = query.success ? query.data.days || 30 : 30;
  res.json(await getTopDishes(restaurant.id, days));
});

analyticsRouter.get("/conversion", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  if (!hasPlanFeature(restaurant.subscriptionPlan, "analytics")) {
    res.status(403).json({ error: "Upgrade to Pro to unlock analytics." });
    return;
  }
  const query = z
    .object({
      days: z.coerce.number().int().positive().max(365).optional(),
    })
    .safeParse(req.query);
  const days = query.success ? query.data.days || 30 : 30;
  res.json(await getConversionMetrics(restaurant.id, days));
});
