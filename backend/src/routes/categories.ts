import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { runWithDbRlsContext } from "../db-rls.js";
import type { AuthRequest } from "../types.js";
import { prisma, runWithTenantContext } from "../prisma.js";
import {
  listCategoryMenuControls,
  upsertCategoryMenuControl,
} from "../services/category-control.service.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

function requireTenantUser(req: AuthRequest) {
  const restaurantId = req.user?.restaurantId;
  if (!req.user || !restaurantId) {
    throw new Error("Create restaurant profile first.");
  }

  return {
    userId: req.user.id,
    restaurantId,
    isAdmin: req.user.role === "platform_admin",
  };
}

categoriesRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const payload = await runWithTenantContext({
      ...tenantContext,
      fn: async (tx) => {
        const categories = await tx.category.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
        const controls = await listCategoryMenuControls({ restaurantId: tenantContext.restaurantId });
        const controlByCategoryId = new Map(controls.map((item) => [item.categoryId, item]));

        return categories.map((category) => ({
          ...category,
          menuControl: controlByCategoryId.get(category.id) || {
            restaurantId: tenantContext.restaurantId,
            categoryId: category.id,
            isActive: true,
          },
        }));
      },
    });

    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list categories.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

categoriesRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const body = z
      .object({
        name: z.string().min(1),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);

    const payload = await runWithDbRlsContext(tenantContext, async () => {
      const category = await prisma.category.create({
        data: {
          restaurantId: tenantContext.restaurantId,
          name: body.name.trim(),
          sortOrder: body.sortOrder ?? 0,
        },
      });
      const menuControl = await upsertCategoryMenuControl({
        restaurantId: tenantContext.restaurantId,
        categoryId: category.id,
        isActive: body.isActive,
      });

      return { ...category, menuControl };
    });

    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create category." });
  }
});

categoriesRouter.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const body = z
      .object({
        name: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);

    const payload = await runWithTenantContext({
      ...tenantContext,
      fn: async (tx) => {
        const existing = await tx.category.findUnique({
          where: { id: req.params.id },
        });
        if (!existing) {
          return null;
        }

        const updated = await tx.category.update({
          where: { id: existing.id },
          data: {
            name: body.name?.trim() ?? existing.name,
            sortOrder: body.sortOrder ?? existing.sortOrder,
          },
        });
        const menuControl = await upsertCategoryMenuControl({
          restaurantId: tenantContext.restaurantId,
          categoryId: updated.id,
          isActive: body.isActive,
        });

        return { ...updated, menuControl };
      },
    });

    if (!payload) {
      res.status(404).json({ error: "Category not found." });
      return;
    }

    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update category." });
  }
});

categoriesRouter.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const deleted = await runWithTenantContext({
      ...tenantContext,
      fn: async (tx) => {
        const existing = await tx.category.findUnique({
          where: { id: req.params.id },
        });
        if (!existing) {
          return false;
        }
        await tx.category.delete({ where: { id: existing.id } });
        return true;
      },
    });

    if (!deleted) {
      res.status(404).json({ error: "Category not found." });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete category.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});
