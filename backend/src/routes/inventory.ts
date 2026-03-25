import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import type { AuthRequest } from "../types.js";
import { getOwnedRestaurant } from "../services/restaurant.service.js";
import {
  createPurchase,
  getStockMovementReport,
  getWastageTrendReport,
  listIngredients,
  listMovements,
  listPurchases,
  listRecipes,
  listSuppliers,
  listTransfers,
  recordWastage,
  restockIngredient,
  transferStock,
  upsertDishRecipe,
  upsertIngredient,
  upsertSupplier,
} from "../services/inventory.service.js";
import { recordActivityEvent } from "../services/activity.service.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

function canMutateInventory(role: string) {
  return role === "platform_admin" || role === "restaurant_owner" || role === "restaurant_manager";
}

inventoryRouter.get("/ingredients", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  const branchId = String(req.query.branchId || "").trim() || "main";
  const rows = await listIngredients({ restaurantId: restaurant.id, branchId });
  res.json(rows);
});

inventoryRouter.post("/ingredients", async (req: AuthRequest, res) => {
  if (!canMutateInventory(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to manage inventory." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        ingredientId: z.string().optional(),
        branchId: z.string().min(1).default("main"),
        name: z.string().min(1),
        unit: z.string().optional(),
        currentStock: z.number().min(0).optional(),
        reorderLevel: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body || {});
    const ingredient = await upsertIngredient({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      ingredientId: body.ingredientId,
      name: body.name,
      unit: body.unit,
      currentStock: body.currentStock,
      reorderLevel: body.reorderLevel,
      isActive: body.isActive,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: body.ingredientId ? "ingredient_updated" : "ingredient_created",
      entityType: "ingredient",
      entityId: ingredient.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "inventory_api",
      after: ingredient as unknown as Record<string, unknown>,
    });
    res.status(body.ingredientId ? 200 : 201).json(ingredient);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save ingredient." });
  }
});

inventoryRouter.get("/recipes", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  res.json(await listRecipes({ restaurantId: restaurant.id }));
});

inventoryRouter.put("/recipes/:dishId", async (req: AuthRequest, res) => {
  if (!canMutateInventory(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to update recipes." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        yieldServings: z.number().positive().optional(),
        items: z
          .array(
            z.object({
              ingredientId: z.string().min(1),
              quantity: z.number().positive(),
            })
          )
          .default([]),
      })
      .parse(req.body || {});
    const recipe = await upsertDishRecipe({
      restaurantId: restaurant.id,
      dishId: req.params.dishId,
      yieldServings: body.yieldServings,
      items: body.items,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "dish_recipe_updated",
      entityType: "dish_recipe",
      entityId: recipe.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      source: "inventory_api",
      after: recipe as unknown as Record<string, unknown>,
    });
    res.json(recipe);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update recipe." });
  }
});

inventoryRouter.get("/suppliers", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  res.json(await listSuppliers({ restaurantId: restaurant.id }));
});

inventoryRouter.post("/suppliers", async (req: AuthRequest, res) => {
  if (!canMutateInventory(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to manage suppliers." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        supplierId: z.string().optional(),
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body || {});
    const supplier = await upsertSupplier({
      restaurantId: restaurant.id,
      supplierId: body.supplierId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: body.supplierId ? "supplier_updated" : "supplier_created",
      entityType: "supplier",
      entityId: supplier.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      source: "inventory_api",
      after: supplier as unknown as Record<string, unknown>,
    });
    res.status(body.supplierId ? 200 : 201).json(supplier);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save supplier." });
  }
});

inventoryRouter.post("/restock", async (req: AuthRequest, res) => {
  if (!canMutateInventory(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to restock ingredients." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().min(1).default("main"),
        ingredientId: z.string().min(1),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
      .parse(req.body || {});
    const result = await restockIngredient({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      notes: body.notes,
      actor: { userId: req.user!.id, role: req.user!.role },
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "ingredient_restocked",
      entityType: "ingredient",
      entityId: body.ingredientId,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "inventory_api",
      metadata: { movementId: result.movement.id, quantity: body.quantity },
      after: result.ingredient as unknown as Record<string, unknown>,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to restock ingredient." });
  }
});

inventoryRouter.post("/wastage", async (req: AuthRequest, res) => {
  if (!canMutateInventory(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to record wastage." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().min(1).default("main"),
        ingredientId: z.string().min(1),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
      .parse(req.body || {});
    const result = await recordWastage({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      ingredientId: body.ingredientId,
      quantity: body.quantity,
      notes: body.notes,
      actor: { userId: req.user!.id, role: req.user!.role },
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "ingredient_wastage_recorded",
      entityType: "ingredient",
      entityId: body.ingredientId,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "inventory_api",
      metadata: { movementId: result.movement.id, quantity: body.quantity },
      after: result.ingredient as unknown as Record<string, unknown>,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to record wastage." });
  }
});

inventoryRouter.post("/purchases", async (req: AuthRequest, res) => {
  if (!canMutateInventory(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to create purchases." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        branchId: z.string().min(1).default("main"),
        supplierId: z.string().optional(),
        notes: z.string().optional(),
        items: z
          .array(
            z.object({
              ingredientId: z.string().min(1),
              quantity: z.number().positive(),
              unitCost: z.number().nonnegative(),
            })
          )
          .min(1),
      })
      .parse(req.body || {});
    const result = await createPurchase({
      restaurantId: restaurant.id,
      branchId: body.branchId,
      supplierId: body.supplierId,
      notes: body.notes,
      items: body.items,
      actor: { userId: req.user!.id, role: req.user!.role },
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "purchase_received",
      entityType: "purchase",
      entityId: result.purchase.id,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.branchId,
      source: "inventory_api",
      after: result.purchase as unknown as Record<string, unknown>,
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create purchase." });
  }
});

inventoryRouter.get("/purchases", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  const query = z
    .object({
      branchId: z.string().optional(),
      limit: z.coerce.number().int().positive().max(500).optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params." });
    return;
  }
  const rows = await listPurchases({
    restaurantId: restaurant.id,
    branchId: query.data.branchId,
    limit: query.data.limit,
  });
  res.json(rows);
});

inventoryRouter.post("/transfers", async (req: AuthRequest, res) => {
  if (!canMutateInventory(req.user!.role)) {
    res.status(403).json({ error: "You do not have permission to transfer stock." });
    return;
  }
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  try {
    const body = z
      .object({
        ingredientId: z.string().min(1),
        fromBranchId: z.string().min(1),
        toBranchId: z.string().min(1),
        quantity: z.number().positive(),
        notes: z.string().optional(),
      })
      .parse(req.body || {});
    const result = await transferStock({
      restaurantId: restaurant.id,
      ingredientId: body.ingredientId,
      fromBranchId: body.fromBranchId,
      toBranchId: body.toBranchId,
      quantity: body.quantity,
      notes: body.notes,
      actor: { userId: req.user!.id, role: req.user!.role },
    });
    await recordActivityEvent({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: "stock_transferred",
      entityType: "ingredient",
      entityId: body.ingredientId,
      organizationId: restaurant.id,
      restaurantId: restaurant.id,
      branchId: body.fromBranchId,
      source: "inventory_api",
      metadata: {
        transferId: result.transferId,
        fromBranchId: body.fromBranchId,
        toBranchId: body.toBranchId,
        quantity: body.quantity,
      },
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to transfer stock." });
  }
});

inventoryRouter.get("/transfers", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  const query = z
    .object({
      branchId: z.string().optional(),
      limit: z.coerce.number().int().positive().max(500).optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params." });
    return;
  }
  const rows = await listTransfers({
    restaurantId: restaurant.id,
    branchId: query.data.branchId,
    limit: query.data.limit,
  });
  res.json(rows);
});

inventoryRouter.get("/movements", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.json([]);
    return;
  }
  const query = z
    .object({
      branchId: z.string().optional(),
      ingredientId: z.string().optional(),
      movementType: z.enum(["restock", "purchase", "deduction", "adjustment", "transfer_in", "transfer_out", "wastage"]).optional(),
      limit: z.coerce.number().int().positive().max(500).optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params." });
    return;
  }
  const rows = await listMovements({
    restaurantId: restaurant.id,
    branchId: query.data.branchId,
    ingredientId: query.data.ingredientId,
    movementType: query.data.movementType,
    limit: query.data.limit,
  });
  res.json(rows);
});

inventoryRouter.get("/reports/movements", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  const query = z
    .object({
      branchId: z.string().optional(),
      days: z.coerce.number().int().positive().max(365).optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params." });
    return;
  }
  res.json(await getStockMovementReport({
    restaurantId: restaurant.id,
    branchId: query.data.branchId,
    days: query.data.days,
  }));
});

inventoryRouter.get("/reports/wastage", async (req: AuthRequest, res) => {
  const restaurant = await getOwnedRestaurant(req.user!.id);
  if (!restaurant) {
    res.status(400).json({ error: "Create restaurant profile first." });
    return;
  }
  const query = z
    .object({
      branchId: z.string().optional(),
      days: z.coerce.number().int().positive().max(365).optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params." });
    return;
  }
  res.json(await getWastageTrendReport({
    restaurantId: restaurant.id,
    branchId: query.data.branchId,
    days: query.data.days,
  }));
});
