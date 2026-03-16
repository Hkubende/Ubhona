import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { prisma } from "../prisma.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(categories);
});

categoriesRouter.post("/", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        name: z.string().min(1),
        sortOrder: z.number().optional(),
      })
      .parse(req.body);
    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: body.name.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create category." });
  }
});

categoriesRouter.patch("/:id", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        name: z.string().optional(),
        sortOrder: z.number().optional(),
      })
      .parse(req.body);
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, restaurantId: restaurant.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    const updated = await prisma.category.update({
      where: { id: existing.id },
      data: {
        name: body.name?.trim() ?? existing.name,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update category." });
  }
});

categoriesRouter.delete("/:id", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  const existing = await prisma.category.findFirst({
    where: { id: req.params.id, restaurantId: restaurant.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Category not found." });
    return;
  }
  await prisma.category.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

