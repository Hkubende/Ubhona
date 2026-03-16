import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import {
  createRestaurant,
  getRestaurantBySlug,
  getOwnedRestaurant,
  updateRestaurant,
} from "../services/restaurant.service.js";
import { prisma } from "../prisma.js";
import {
  mapSubscriptionSummary,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
} from "../services/subscription.service.js";

export const restaurantRouter = Router();

function withSubscription(restaurant: any) {
  return {
    ...restaurant,
    subscription: mapSubscriptionSummary(restaurant),
  };
}

restaurantRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email(),
        location: z.string().min(1),
        logoUrl: z.string().optional(),
        coverImage: z.string().optional(),
        themePrimary: z.string().optional(),
        themeSecondary: z.string().optional(),
        shortDescription: z.string().optional(),
      })
      .parse(req.body);
    const restaurant = await createRestaurant(req.user!.id, body);
    res.json(withSubscription(restaurant));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create restaurant." });
  }
});

restaurantRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  res.json(withSubscription(restaurant));
});

restaurantRouter.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = z
      .object({
        name: z.string().optional(),
        slug: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        location: z.string().optional(),
        logoUrl: z.string().optional(),
        coverImage: z.string().optional(),
        themePrimary: z.string().optional(),
        themeSecondary: z.string().optional(),
        shortDescription: z.string().optional(),
        subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).optional(),
        subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
        trialEndsAt: z.string().nullable().optional(),
        renewalDate: z.string().nullable().optional(),
      })
      .parse(req.body);
    const restaurant = await updateRestaurant(req.user!.id, body);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    res.json(withSubscription(restaurant));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update restaurant." });
  }
});

restaurantRouter.patch("/me/plan", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = z
      .object({
        subscriptionPlan: z.enum(SUBSCRIPTION_PLANS),
        subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
      })
      .parse(req.body);
    const restaurant = await updateRestaurant(req.user!.id, {
      subscriptionPlan: body.subscriptionPlan,
      subscriptionStatus: body.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found." });
      return;
    }
    res.json(withSubscription(restaurant));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update plan." });
  }
});

restaurantRouter.get("/:slug/categories", async (req, res) => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(categories);
});

restaurantRouter.get("/:slug/dishes", async (req, res) => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isAvailable: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(dishes);
});

restaurantRouter.get("/:slug", async (req, res) => {
  const restaurant = await getRestaurantBySlug(req.params.slug);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found." });
    return;
  }
  res.json(withSubscription(restaurant));
});
