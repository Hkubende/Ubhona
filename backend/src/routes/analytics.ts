import { Router, type Request, type Response } from "express";
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
} from "../services/analytics.service.js";
import { isRestaurantFeatureEnabled } from "../services/billing.service.js";
import { authAwareRateLimitKey, createRateLimiter } from "../middleware/rate-limit.js";
import { runWithRestaurantDbSession } from "../services/db-session.service.js";

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
const analyticsIngestLimiter = createRateLimiter({
  keyPrefix: "analytics-ingest",
  windowMs: 60 * 1000,
  max: 120,
  message: "Analytics ingestion rate exceeded.",
});
const analyticsReadLimiter = createRateLimiter({
  keyPrefix: "analytics-read",
  windowMs: 60 * 1000,
  max: 90,
  keyGenerator: authAwareRateLimitKey,
  message: "Too many analytics requests. Please wait briefly.",
});

async function ingestEvent(req: Request, res: Response) {
  try {
    const body = eventSchema.parse(req.body);
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: body.restaurantId },
      select: { id: true, ownerUserId: true },
    });
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    const event = await runWithRestaurantDbSession(
      {
        userId: restaurant.ownerUserId,
        restaurantId: restaurant.id,
        isAdmin: false,
      },
      (tx) => recordAnalyticsEvent(body, tx)
    );
    res.status(201).json({ ok: true, event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save analytics event.";
    const status = /not found|does not belong/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

analyticsRouter.post("/events", analyticsIngestLimiter, ingestEvent);

// Backward compatibility for older clients
analyticsRouter.post("/event", analyticsIngestLimiter, ingestEvent);

analyticsRouter.get("/summary", requireAuth, analyticsReadLimiter, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  if (!(await isRestaurantFeatureEnabled(restaurant, "analytics"))) {
    res.status(403).json({ error: "Upgrade to Growth to unlock analytics." });
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

analyticsRouter.get("/top-dishes", requireAuth, analyticsReadLimiter, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  if (!(await isRestaurantFeatureEnabled(restaurant, "analytics"))) {
    res.status(403).json({ error: "Upgrade to Growth to unlock analytics." });
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

analyticsRouter.get("/conversion", requireAuth, analyticsReadLimiter, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  if (!(await isRestaurantFeatureEnabled(restaurant, "analytics"))) {
    res.status(403).json({ error: "Upgrade to Growth to unlock analytics." });
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
