import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { prisma } from "../prisma.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import { getDishLimit } from "../services/subscription.service.js";

export const dishesRouter = Router();
dishesRouter.use(requireAuth);

dishesRouter.get("/", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(dishes);
});

dishesRouter.post("/", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const dishLimit = getDishLimit(restaurant.subscriptionPlan);
    if (dishLimit != null) {
      const currentCount = await prisma.dish.count({
        where: { restaurantId: restaurant.id },
      });
      if (currentCount >= dishLimit) {
        res.status(403).json({
          error: `Your Starter plan allows up to ${dishLimit} dishes. Upgrade to Pro for unlimited dishes.`,
        });
        return;
      }
    }
    const body = z
      .object({
        categoryId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().min(1),
        price: z.number().positive(),
        thumbUrl: z.string().min(1),
        modelUrl: z.string().min(1),
        isAvailable: z.boolean().optional(),
      })
      .parse(req.body);
    const dish = await prisma.dish.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: body.categoryId,
        name: body.name.trim(),
        description: body.description.trim(),
        price: body.price,
        thumbUrl: body.thumbUrl.trim(),
        modelUrl: body.modelUrl.trim(),
        isAvailable: body.isAvailable ?? true,
      },
    });
    res.json(dish);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create dish." });
  }
});

dishesRouter.patch("/:id", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        categoryId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().positive().optional(),
        thumbUrl: z.string().optional(),
        modelUrl: z.string().optional(),
        isAvailable: z.boolean().optional(),
      })
      .parse(req.body);
    const existing = await prisma.dish.findFirst({
      where: { id: req.params.id, restaurantId: restaurant.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Dish not found." });
      return;
    }
    const updated = await prisma.dish.update({
      where: { id: existing.id },
      data: {
        categoryId: body.categoryId ?? existing.categoryId,
        name: body.name?.trim() ?? existing.name,
        description: body.description?.trim() ?? existing.description,
        price: body.price ?? existing.price,
        thumbUrl: body.thumbUrl?.trim() ?? existing.thumbUrl,
        modelUrl: body.modelUrl?.trim() ?? existing.modelUrl,
        isAvailable: body.isAvailable ?? existing.isAvailable,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update dish." });
  }
});

dishesRouter.delete("/:id", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  const existing = await prisma.dish.findFirst({
    where: { id: req.params.id, restaurantId: restaurant.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Dish not found." });
    return;
  }
  await prisma.dish.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
