import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { runWithTenantContext } from "../prisma.js";
import {
  decrementRestaurantUsage,
  getRestaurantLimitStatus,
  incrementRestaurantUsage,
} from "../services/billing.service.js";
import {
  createApprovalRequest,
  getRestaurantActivityHistory,
  recordActivityEvent,
  requiresApprovalForAction,
} from "../services/activity.service.js";
import {
  getBranchDishStockOverride,
  listBranchDishStockOverrides,
  removeBranchDishStockOverride,
  upsertBranchDishStockOverride,
  type BranchDishAvailabilityStatus,
} from "../services/stock.service.js";
import { getEffectiveDishMenuState } from "../services/menu-control.service.js";

export const dishesRouter = Router();
dishesRouter.use(requireAuth);

function requireTenantUser(req: AuthRequest) {
  const restaurantId = req.user?.restaurantId;
  if (!req.user || !restaurantId) {
    throw new Error("Create restaurant profile first.");
  }

  return {
    userId: req.user.id,
    restaurantId,
    isAdmin: req.user.role === "platform_admin",
    role: req.user.role,
  };
}

dishesRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const branchId = String(req.query.branchId || "").trim() || "main";
    const payload = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async (tx) => {
        const dishes = await tx.dish.findMany({
          orderBy: { createdAt: "desc" },
        });
        const overrides = await listBranchDishStockOverrides({ restaurantId: tenantContext.restaurantId, branchId });
        const overrideByDishId = new Map(overrides.map((item) => [item.dishId, item]));

        return dishes.map((dish) => {
          const override = overrideByDishId.get(dish.id);
          const menuControl = getEffectiveDishMenuState({
            branchId,
            isAvailable: dish.isAvailable,
            stockOverride: override,
          });
          return {
            ...dish,
            stock: override
              ? {
                  branchId: override.branchId,
                  availability_status: override.availability_status,
                  stock_quantity: override.stock_quantity,
                  low_stock_threshold: override.low_stock_threshold,
                  hidden_from_public_menu: override.hidden_from_public_menu,
                }
              : null,
            menuControl,
          };
        });
      },
    });

    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list dishes.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

dishesRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const restaurant = {
      id: tenantContext.restaurantId,
      ownerUserId: tenantContext.userId,
    };
    const body = z
      .object({
        categoryId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().min(1),
        price: z.number().positive(),
        thumbUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        thumbnail_url: z.string().optional(),
        modelUrl: z.string().optional(),
        model_url: z.string().optional(),
        isAvailable: z.boolean().optional(),
      })
      .parse(req.body);
    const resolvedThumbUrl = body.thumbnail_url?.trim() || body.thumbnailUrl?.trim() || body.thumbUrl?.trim() || "";

    const dishLimit = await getRestaurantLimitStatus(restaurant as any, "dishes");
    if (dishLimit.reached) {
      throw new Error(`PLAN_LIMIT_REACHED:${dishLimit.usageLimit}`);
    }

    const dish = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async (tx) => {
        const created = await tx.dish.create({
          data: {
            restaurantId: tenantContext.restaurantId,
            categoryId: body.categoryId,
            name: body.name.trim(),
            description: body.description.trim(),
            price: body.price,
            thumbUrl: resolvedThumbUrl,
            modelUrl: body.model_url?.trim() || body.modelUrl?.trim() || "",
            isAvailable: body.isAvailable ?? true,
          },
        });

        return created;
      },
    });

    await incrementRestaurantUsage(restaurant as any, "dishes", 1);
    await recordActivityEvent({
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      action: "dish_created",
      entityType: "dish",
      entityId: dish.id,
      organizationId: tenantContext.restaurantId,
      restaurantId: tenantContext.restaurantId,
      source: "menu_builder",
      after: {
        name: dish.name,
        categoryId: dish.categoryId,
        price: dish.price,
        isAvailable: dish.isAvailable,
      },
    });
    res.json(dish);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PLAN_LIMIT_REACHED:")) {
      const usageLimit = error.message.split(":")[1] || "your current plan's limit";
      res.status(403).json({ error: `Your current plan allows up to ${usageLimit} dishes. Upgrade to continue.` });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create dish." });
  }
});

dishesRouter.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const body = z
      .object({
        categoryId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().positive().optional(),
        thumbUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        thumbnail_url: z.string().optional(),
        modelUrl: z.string().optional(),
        model_url: z.string().optional(),
        isAvailable: z.boolean().optional(),
      })
      .parse(req.body);

    const existing = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async (tx) => tx.dish.findUnique({ where: { id: req.params.id } }),
    });
    if (!existing) {
      res.status(404).json({ error: "Dish not found." });
      return;
    }

    const nextPrice = body.price ?? existing.price;
    const priceDeltaPct =
      existing.price > 0 ? Math.abs(((Number(nextPrice) - Number(existing.price)) / Number(existing.price)) * 100) : 0;
    if (
      body.price != null &&
      body.price !== existing.price &&
      requiresApprovalForAction({
        actionType: "dish_price_change",
        role: tenantContext.role,
        changeMagnitudePercent: priceDeltaPct,
      })
    ) {
      const approval = await createApprovalRequest({
        actionType: "dish_price_change",
        entityType: "dish",
        entityId: existing.id,
        organizationId: tenantContext.restaurantId,
        restaurantId: tenantContext.restaurantId,
        requestedByUserId: tenantContext.userId,
        requestedByRole: tenantContext.role,
        requestPayload: {
          before: { price: existing.price, name: existing.name },
          after: { price: body.price, name: body.name ?? existing.name },
        },
        reason: `Price change requested (${priceDeltaPct.toFixed(1)}% delta).`,
      });
      res.status(202).json({
        ok: true,
        requiresApproval: true,
        approvalId: approval.id,
        message: "Price change submitted for approval.",
      });
      return;
    }

    const updated = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async (tx) =>
        tx.dish.update({
          where: { id: existing.id },
          data: {
            categoryId: body.categoryId ?? existing.categoryId,
            name: body.name?.trim() ?? existing.name,
            description: body.description?.trim() ?? existing.description,
            price: body.price ?? existing.price,
            thumbUrl:
              body.thumbnail_url?.trim() ?? body.thumbnailUrl?.trim() ?? body.thumbUrl?.trim() ?? existing.thumbUrl,
            modelUrl: body.model_url?.trim() ?? body.modelUrl?.trim() ?? existing.modelUrl,
            isAvailable: body.isAvailable ?? existing.isAvailable,
          },
        }),
    });

    await recordActivityEvent({
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      action: body.price != null && body.price !== existing.price ? "dish_price_changed" : "dish_updated",
      entityType: "dish",
      entityId: updated.id,
      organizationId: tenantContext.restaurantId,
      restaurantId: tenantContext.restaurantId,
      source: "menu_builder",
      before: {
        name: existing.name,
        description: existing.description,
        price: existing.price,
        categoryId: existing.categoryId,
        isAvailable: existing.isAvailable,
      },
      after: {
        name: updated.name,
        description: updated.description,
        price: updated.price,
        categoryId: updated.categoryId,
        isAvailable: updated.isAvailable,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update dish." });
  }
});

dishesRouter.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const existing = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async (tx) => tx.dish.findUnique({ where: { id: req.params.id } }),
    });
    if (!existing) {
      res.status(404).json({ error: "Dish not found." });
      return;
    }
    if (
      requiresApprovalForAction({
        actionType: "dish_delete",
        role: tenantContext.role,
      })
    ) {
      const approval = await createApprovalRequest({
        actionType: "dish_delete",
        entityType: "dish",
        entityId: existing.id,
        organizationId: tenantContext.restaurantId,
        restaurantId: tenantContext.restaurantId,
        requestedByUserId: tenantContext.userId,
        requestedByRole: tenantContext.role,
        requestPayload: {
          dish: {
            id: existing.id,
            name: existing.name,
            categoryId: existing.categoryId,
            price: existing.price,
          },
        },
        reason: "Dish deletion requires approval for non-owner role.",
      });
      res.status(202).json({
        ok: true,
        requiresApproval: true,
        approvalId: approval.id,
        message: "Dish deletion submitted for approval.",
      });
      return;
    }

    await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async (tx) => {
        await tx.dish.delete({ where: { id: existing.id } });
      },
    });

    await decrementRestaurantUsage({ id: tenantContext.restaurantId, ownerUserId: tenantContext.userId } as any, "dishes", 1);
    await recordActivityEvent({
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      action: "dish_deleted",
      entityType: "dish",
      entityId: existing.id,
      organizationId: tenantContext.restaurantId,
      restaurantId: tenantContext.restaurantId,
      source: "menu_builder",
      before: {
        name: existing.name,
        price: existing.price,
        categoryId: existing.categoryId,
      },
    });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete dish.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

dishesRouter.get("/:id/history", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const rows = await getRestaurantActivityHistory({
      restaurantId: tenantContext.restaurantId,
      entityType: "dish",
      entityId: req.params.id,
      limit: Math.max(1, Math.min(100, Number(req.query.limit || 50))),
    });
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dish history.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

dishesRouter.get("/:id/stock", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    const branchId = String(req.query.branchId || "").trim() || "main";
    const payload = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async () =>
        getBranchDishStockOverride({
          restaurantId: tenantContext.restaurantId,
          branchId,
          dishId: req.params.id,
        }),
    });
    res.json(
      payload || {
        restaurantId: tenantContext.restaurantId,
        branchId,
        dishId: req.params.id,
        availability_status: "available",
        stock_quantity: null,
        low_stock_threshold: 5,
        hidden_from_public_menu: false,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch dish stock override.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

dishesRouter.patch("/:id/stock", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    if (!(tenantContext.role === "restaurant_owner" || tenantContext.role === "restaurant_manager" || tenantContext.role === "platform_admin")) {
      res.status(403).json({ error: "You do not have permission to manage stock." });
      return;
    }
    const body = z
      .object({
        branchId: z.string().min(1).default("main"),
        availability_status: z.enum(["available", "low_stock", "unavailable"]).optional(),
        stock_quantity: z.number().int().min(0).nullable().optional(),
        low_stock_threshold: z.number().int().min(0).max(100000).optional(),
        hidden_from_public_menu: z.boolean().optional(),
      })
      .parse(req.body || {});
    const existing = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async () =>
        getBranchDishStockOverride({
          restaurantId: tenantContext.restaurantId,
          branchId: body.branchId,
          dishId: req.params.id,
        }),
    });
    const updated = await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async () =>
        upsertBranchDishStockOverride({
          restaurantId: tenantContext.restaurantId,
          branchId: body.branchId,
          dishId: req.params.id,
          availability_status: body.availability_status as BranchDishAvailabilityStatus | undefined,
          stock_quantity: body.stock_quantity,
          low_stock_threshold: body.low_stock_threshold,
          hidden_from_public_menu: body.hidden_from_public_menu,
        }),
    });
    await recordActivityEvent({
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      action: "dish_stock_updated",
      entityType: "dish_stock",
      entityId: req.params.id,
      organizationId: tenantContext.restaurantId,
      branchId: body.branchId,
      restaurantId: tenantContext.restaurantId,
      source: "menu_stock",
      before: (existing || {}) as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
      metadata: {
        branchId: body.branchId,
      },
    });
    if (updated.availability_status === "low_stock") {
      await recordActivityEvent({
        actorUserId: tenantContext.userId,
        actorRole: tenantContext.role,
        action: "dish_low_stock_triggered",
        entityType: "dish_stock",
        entityId: req.params.id,
        organizationId: tenantContext.restaurantId,
        branchId: body.branchId,
        restaurantId: tenantContext.restaurantId,
        source: "menu_stock",
        after: updated as unknown as Record<string, unknown>,
      });
    }
    if (updated.availability_status === "unavailable") {
      await recordActivityEvent({
        actorUserId: tenantContext.userId,
        actorRole: tenantContext.role,
        action: "dish_marked_unavailable",
        entityType: "dish_stock",
        entityId: req.params.id,
        organizationId: tenantContext.restaurantId,
        branchId: body.branchId,
        restaurantId: tenantContext.restaurantId,
        source: "menu_stock",
        after: updated as unknown as Record<string, unknown>,
      });
    }
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update dish stock override.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});

dishesRouter.delete("/:id/stock", async (req: AuthRequest, res) => {
  try {
    const tenantContext = requireTenantUser(req);
    if (!(tenantContext.role === "restaurant_owner" || tenantContext.role === "restaurant_manager" || tenantContext.role === "platform_admin")) {
      res.status(403).json({ error: "You do not have permission to manage stock." });
      return;
    }
    const branchId = String(req.query.branchId || "").trim() || "main";
    await runWithTenantContext({
      userId: tenantContext.userId,
      restaurantId: tenantContext.restaurantId,
      isAdmin: tenantContext.isAdmin,
      fn: async () =>
        removeBranchDishStockOverride({
          restaurantId: tenantContext.restaurantId,
          branchId,
          dishId: req.params.id,
        }),
    });
    await recordActivityEvent({
      actorUserId: tenantContext.userId,
      actorRole: tenantContext.role,
      action: "dish_stock_override_removed",
      entityType: "dish_stock",
      entityId: req.params.id,
      organizationId: tenantContext.restaurantId,
      branchId,
      restaurantId: tenantContext.restaurantId,
      source: "menu_stock",
    });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove dish stock override.";
    res.status(message === "Create restaurant profile first." ? 400 : 500).json({ error: message });
  }
});
