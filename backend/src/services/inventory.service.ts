import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { getBranchDishStockOverride, upsertBranchDishStockOverride } from "./stock.service.js";
import {
  findRestaurantDocumentByKey,
  findRestaurantDocumentByKeyTx,
  listRestaurantDocuments,
  listRestaurantDocumentsTx,
  upsertRestaurantDocument,
  upsertRestaurantDocumentTx,
} from "./tenant-document.service.js";

export type InventoryRole = "platform_admin" | "restaurant_owner" | "restaurant_manager" | "staff";
export type StockMovementType =
  | "restock"
  | "purchase"
  | "deduction"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "wastage";

type Tx = Prisma.TransactionClient;
type Actor = { userId: string; role: InventoryRole } | null | undefined;

export type Ingredient = {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DishRecipe = {
  id: string;
  restaurantId: string;
  dishId: string;
  yieldServings: number;
  items: Array<{ ingredientId: string; quantity: number }>;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  restaurantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StockMovement = {
  id: string;
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  movementType: StockMovementType;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  actorUserId: string | null;
  actorRole: InventoryRole | null;
  createdAt: string;
};

export type Purchase = {
  id: string;
  restaurantId: string;
  branchId: string;
  supplierId: string | null;
  status: "received";
  items: Array<{ ingredientId: string; quantity: number; unitCost: number; totalCost: number }>;
  totalCost: number;
  notes: string | null;
  createdAt: string;
};

export type StockTransfer = {
  id: string;
  restaurantId: string;
  ingredientId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  status: "completed";
  notes: string | null;
  createdAt: string;
};

const K = {
  ing: "inventory_ingredient:",
  rec: "inventory_recipe:",
  sup: "inventory_supplier:",
  mov: "inventory_movement:",
  pur: "inventory_purchase:",
  trf: "inventory_transfer:",
  ded: "inventory_deduction_marker:",
} as const;

const nowIso = () => new Date().toISOString();
const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const ingKey = (r: string, b: string, i: string) => `${K.ing}${r}:${b}:${i}`;
const recKey = (r: string, d: string) => `${K.rec}${r}:${d}`;
const supKey = (r: string, s: string) => `${K.sup}${r}:${s}`;
const movKey = (r: string, b: string, m: string) => `${K.mov}${r}:${b}:${m}`;
const purKey = (r: string, b: string, p: string) => `${K.pur}${r}:${b}:${p}`;
const trfKey = (r: string, from: string, to: string, t: string) => `${K.trf}${r}:${from}:${to}:${t}`;
const dedKey = (r: string, o: string, s: string) => `${K.ded}${r}:${o}:${s}`;

const mapIngredient = (payload: unknown): Ingredient | null => {
  const x = asObj(payload);
  const id = String(x.id || "");
  const restaurantId = String(x.restaurantId || "");
  const branchId = String(x.branchId || "");
  if (!id || !restaurantId || !branchId) return null;
  return {
    id,
    restaurantId,
    branchId,
    name: String(x.name || ""),
    unit: String(x.unit || "unit"),
    currentStock: Number(x.currentStock || 0),
    reorderLevel: Number(x.reorderLevel || 0),
    isActive: x.isActive !== false,
    createdAt: String(x.createdAt || nowIso()),
    updatedAt: String(x.updatedAt || nowIso()),
  };
};

const mapRecipe = (payload: unknown): DishRecipe | null => {
  const x = asObj(payload);
  const id = String(x.id || "");
  const restaurantId = String(x.restaurantId || "");
  const dishId = String(x.dishId || "");
  if (!id || !restaurantId || !dishId) return null;
  const items = Array.isArray(x.items)
    ? x.items
        .map((row) => {
          const z = asObj(row);
          const ingredientId = String(z.ingredientId || "");
          const quantity = Number(z.quantity || 0);
          return ingredientId && quantity > 0 ? { ingredientId, quantity } : null;
        })
        .filter((v): v is { ingredientId: string; quantity: number } => !!v)
    : [];
  return {
    id,
    restaurantId,
    dishId,
    yieldServings: Math.max(1, Number(x.yieldServings || 1)),
    items,
    createdAt: String(x.createdAt || nowIso()),
    updatedAt: String(x.updatedAt || nowIso()),
  };
};

const mapMovement = (payload: unknown): StockMovement | null => {
  const x = asObj(payload);
  const id = String(x.id || "");
  const restaurantId = String(x.restaurantId || "");
  const branchId = String(x.branchId || "");
  const ingredientId = String(x.ingredientId || "");
  if (!id || !restaurantId || !branchId || !ingredientId) return null;
  return {
    id,
    restaurantId,
    branchId,
    ingredientId,
    movementType: String(x.movementType || "adjustment") as StockMovementType,
    quantityDelta: Number(x.quantityDelta || 0),
    quantityBefore: Number(x.quantityBefore || 0),
    quantityAfter: Number(x.quantityAfter || 0),
    referenceType: x.referenceType == null ? null : String(x.referenceType),
    referenceId: x.referenceId == null ? null : String(x.referenceId),
    notes: x.notes == null ? null : String(x.notes),
    actorUserId: x.actorUserId == null ? null : String(x.actorUserId),
    actorRole: x.actorRole == null ? null : (String(x.actorRole) as InventoryRole),
    createdAt: String(x.createdAt || nowIso()),
  };
};

const mapPurchase = (payload: unknown): Purchase | null => {
  const x = asObj(payload);
  const id = String(x.id || "");
  const restaurantId = String(x.restaurantId || "");
  const branchId = String(x.branchId || "");
  if (!id || !restaurantId || !branchId) return null;
  const items = Array.isArray(x.items)
    ? x.items
        .map((raw) => {
          const row = asObj(raw);
          const ingredientId = String(row.ingredientId || "");
          const quantity = Number(row.quantity || 0);
          const unitCost = Number(row.unitCost || 0);
          if (!ingredientId || quantity <= 0) return null;
          return {
            ingredientId,
            quantity,
            unitCost,
            totalCost: Number((quantity * unitCost).toFixed(2)),
          };
        })
        .filter((row): row is { ingredientId: string; quantity: number; unitCost: number; totalCost: number } => !!row)
    : [];
  return {
    id,
    restaurantId,
    branchId,
    supplierId: x.supplierId == null ? null : String(x.supplierId),
    status: "received",
    items,
    totalCost: Number(x.totalCost || 0),
    notes: x.notes == null ? null : String(x.notes),
    createdAt: String(x.createdAt || nowIso()),
  };
};

const mapTransfer = (payload: unknown): StockTransfer | null => {
  const x = asObj(payload);
  const id = String(x.id || "");
  const restaurantId = String(x.restaurantId || "");
  const ingredientId = String(x.ingredientId || "");
  const fromBranchId = String(x.fromBranchId || "");
  const toBranchId = String(x.toBranchId || "");
  if (!id || !restaurantId || !ingredientId || !fromBranchId || !toBranchId) return null;
  return {
    id,
    restaurantId,
    ingredientId,
    fromBranchId,
    toBranchId,
    quantity: Number(x.quantity || 0),
    status: "completed",
    notes: x.notes == null ? null : String(x.notes),
    createdAt: String(x.createdAt || nowIso()),
  };
};

async function syncDishStockFromRecipeTx(
  tx: Tx,
  input: {
    restaurantId: string;
    branchId: string;
    dishId: string;
  }
) {
  const row = await findRestaurantDocumentByKeyTx(tx, {
    restaurantId: input.restaurantId,
    key: recKey(input.restaurantId, input.dishId),
    select: { payload: true },
  });
  const recipe = row ? mapRecipe(row.payload) : null;
  if (!recipe || !recipe.items.length) return;

  let possibleServings = Number.POSITIVE_INFINITY;
  for (const item of recipe.items) {
    const ingredient = await getIngredientTx(tx, input.restaurantId, input.branchId, item.ingredientId);
    const availableStock = ingredient?.currentStock || 0;
    const perServingQty = item.quantity / Math.max(1, recipe.yieldServings);
    const servings = perServingQty > 0 ? Math.floor(availableStock / perServingQty) : Number.POSITIVE_INFINITY;
    possibleServings = Math.min(possibleServings, servings);
  }

  const stockCount = Number.isFinite(possibleServings) ? Math.max(0, Math.floor(possibleServings)) : 0;
  const existing = await getBranchDishStockOverride({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    dishId: input.dishId,
  });
  const threshold = existing?.low_stock_threshold ?? 5;
  const availability_status = stockCount <= 0 ? "unavailable" : stockCount <= threshold ? "low_stock" : "available";
  await upsertBranchDishStockOverride({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    dishId: input.dishId,
    availability_status,
    stock_quantity: stockCount,
    low_stock_threshold: threshold,
    hidden_from_public_menu: existing?.hidden_from_public_menu ?? false,
  });
}

async function syncDishStockForIngredientTx(
  tx: Tx,
  input: {
    restaurantId: string;
    branchId: string;
    ingredientId: string;
  }
) {
  const recipeRows = await listRestaurantDocumentsTx(tx, {
    restaurantId: input.restaurantId,
    keyPrefix: `${K.rec}${input.restaurantId}:`,
    select: { payload: true },
  });
  const dishIds = recipeRows
    .map((row) => mapRecipe(row.payload))
    .filter((row): row is DishRecipe => !!row)
    .filter((recipe) => recipe.items.some((item) => item.ingredientId === input.ingredientId))
    .map((recipe) => recipe.dishId);
  for (const dishId of dishIds) {
    await syncDishStockFromRecipeTx(tx, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      dishId,
    });
  }
}

async function upsertDoc(tx: Tx, key: string, payload: unknown) {
  const payloadRecord = asObj(payload);
  const restaurantId = String(payloadRecord.restaurantId || payloadRecord.restaurant_id || "");
  if (!restaurantId) throw new Error("Tenant inventory document payload requires restaurantId.");
  await upsertRestaurantDocumentTx(tx, {
    restaurantId,
    key,
    payload: payload as Prisma.InputJsonValue,
  });
}

async function getIngredientTx(tx: Tx, restaurantId: string, branchId: string, ingredientId: string) {
  const row = await findRestaurantDocumentByKeyTx(tx, {
    restaurantId,
    key: ingKey(restaurantId, branchId, ingredientId),
    select: { payload: true },
  });
  return row ? mapIngredient(row.payload) : null;
}

async function writeMovement(
  tx: Tx,
  input: {
    restaurantId: string;
    branchId: string;
    ingredientId: string;
    movementType: StockMovementType;
    quantityDelta: number;
    quantityBefore: number;
    quantityAfter: number;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    actor?: Actor;
  }
) {
  const movement: StockMovement = {
    id: rid("move"),
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    ingredientId: input.ingredientId,
    movementType: input.movementType,
    quantityDelta: input.quantityDelta,
    quantityBefore: input.quantityBefore,
    quantityAfter: input.quantityAfter,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    notes: input.notes ?? null,
    actorUserId: input.actor?.userId || null,
    actorRole: input.actor?.role || null,
    createdAt: nowIso(),
  };
  await upsertDoc(tx, movKey(input.restaurantId, input.branchId, movement.id), movement);
  return movement;
}

async function adjustStockTx(
  tx: Tx,
  input: {
    restaurantId: string;
    branchId: string;
    ingredientId: string;
    quantityDelta: number;
    movementType: StockMovementType;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    actor?: Actor;
  }
) {
  const ingredient = await getIngredientTx(tx, input.restaurantId, input.branchId, input.ingredientId);
  if (!ingredient || !ingredient.isActive) throw new Error(`Ingredient ${input.ingredientId} is not available in branch.`);
  const nextQty = Number((ingredient.currentStock + input.quantityDelta).toFixed(4));
  if (nextQty < 0) throw new Error(`Insufficient stock for ingredient ${ingredient.name}.`);
  const next: Ingredient = { ...ingredient, currentStock: nextQty, updatedAt: nowIso() };
  await upsertDoc(tx, ingKey(input.restaurantId, input.branchId, input.ingredientId), next);
  const movement = await writeMovement(tx, {
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    ingredientId: input.ingredientId,
    movementType: input.movementType,
    quantityDelta: input.quantityDelta,
    quantityBefore: ingredient.currentStock,
    quantityAfter: nextQty,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    notes: input.notes,
    actor: input.actor,
  });
  await syncDishStockForIngredientTx(tx, {
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    ingredientId: input.ingredientId,
  });
  return { ingredient: next, movement };
}

export async function listIngredients(input: { restaurantId: string; branchId: string }) {
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: `${K.ing}${input.restaurantId}:${input.branchId}:`,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => mapIngredient(row.payload)).filter((row): row is Ingredient => !!row);
}

export async function upsertIngredient(input: {
  restaurantId: string;
  branchId: string;
  ingredientId?: string;
  name: string;
  unit?: string;
  currentStock?: number;
  reorderLevel?: number;
  isActive?: boolean;
}) {
  const id = input.ingredientId || rid("ing");
  const key = ingKey(input.restaurantId, input.branchId, id);
  const existing = await findRestaurantDocumentByKey({
    restaurantId: input.restaurantId,
    key,
    select: { payload: true },
  });
  const prev = existing ? mapIngredient(existing.payload) : null;
  const next: Ingredient = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    name: input.name.trim(),
    unit: String(input.unit || prev?.unit || "unit"),
    currentStock: Math.max(0, Number(input.currentStock ?? prev?.currentStock ?? 0)),
    reorderLevel: Math.max(0, Number(input.reorderLevel ?? prev?.reorderLevel ?? 0)),
    isActive: input.isActive ?? prev?.isActive ?? true,
    createdAt: prev?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key,
    payload: next as Prisma.InputJsonValue,
  });
  return next;
}

export async function upsertDishRecipe(input: {
  restaurantId: string;
  dishId: string;
  yieldServings?: number;
  items: Array<{ ingredientId: string; quantity: number }>;
}) {
  const existing = await findRestaurantDocumentByKey({
    restaurantId: input.restaurantId,
    key: recKey(input.restaurantId, input.dishId),
    select: { payload: true },
  });
  const prev = existing ? mapRecipe(existing.payload) : null;
  const next: DishRecipe = {
    id: prev?.id || rid("rec"),
    restaurantId: input.restaurantId,
    dishId: input.dishId,
    yieldServings: Math.max(1, Number(input.yieldServings || prev?.yieldServings || 1)),
    items: input.items
      .map((x) => ({ ingredientId: String(x.ingredientId || "").trim(), quantity: Number(x.quantity || 0) }))
      .filter((x) => x.ingredientId && x.quantity > 0),
    createdAt: prev?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key: recKey(input.restaurantId, input.dishId),
    payload: next as Prisma.InputJsonValue,
  });
  await prisma.$transaction(async (tx) => {
    await syncDishStockFromRecipeTx(tx, {
      restaurantId: input.restaurantId,
      branchId: "main",
      dishId: input.dishId,
    });
  });
  return next;
}

export async function listRecipes(input: { restaurantId: string }) {
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: `${K.rec}${input.restaurantId}:`,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => mapRecipe(row.payload)).filter((row): row is DishRecipe => !!row);
}

export async function upsertSupplier(input: {
  restaurantId: string;
  supplierId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}) {
  const id = input.supplierId || rid("sup");
  const key = supKey(input.restaurantId, id);
  const existing = await findRestaurantDocumentByKey({
    restaurantId: input.restaurantId,
    key,
    select: { payload: true },
  });
  const prev = existing ? (asObj(existing.payload) as Supplier) : null;
  const next: Supplier = {
    id,
    restaurantId: input.restaurantId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: String(prev?.createdAt || nowIso()),
    updatedAt: nowIso(),
  };
  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key,
    payload: next as Prisma.InputJsonValue,
  });
  return next;
}

export async function listSuppliers(input: { restaurantId: string }) {
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: `${K.sup}${input.restaurantId}:`,
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((row) => {
      const x = asObj(row.payload);
      return {
        id: String(x.id || ""),
        restaurantId: String(x.restaurantId || ""),
        name: String(x.name || ""),
        phone: x.phone == null ? null : String(x.phone),
        email: x.email == null ? null : String(x.email),
        notes: x.notes == null ? null : String(x.notes),
        createdAt: String(x.createdAt || nowIso()),
        updatedAt: String(x.updatedAt || nowIso()),
      } as Supplier;
    })
    .filter((row) => row.id && row.restaurantId);
}

export async function restockIngredient(input: {
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  quantity: number;
  notes?: string | null;
  actor?: Actor;
}) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be positive.");
  return prisma.$transaction((tx) =>
    adjustStockTx(tx, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      ingredientId: input.ingredientId,
      quantityDelta: input.quantity,
      movementType: "restock",
      notes: input.notes,
      actor: input.actor,
    })
  );
}

export async function recordWastage(input: {
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  quantity: number;
  notes?: string | null;
  actor?: Actor;
}) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be positive.");
  return prisma.$transaction((tx) =>
    adjustStockTx(tx, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      ingredientId: input.ingredientId,
      quantityDelta: -input.quantity,
      movementType: "wastage",
      notes: input.notes,
      actor: input.actor,
    })
  );
}

export async function createPurchase(input: {
  restaurantId: string;
  branchId: string;
  supplierId?: string | null;
  items: Array<{ ingredientId: string; quantity: number; unitCost: number }>;
  notes?: string | null;
  actor?: Actor;
}) {
  const items = input.items
    .map((x) => ({
      ingredientId: String(x.ingredientId || "").trim(),
      quantity: Number(x.quantity || 0),
      unitCost: Number(x.unitCost || 0),
    }))
    .filter((x) => x.ingredientId && x.quantity > 0);
  if (!items.length) throw new Error("Purchase must include items.");
  return prisma.$transaction(async (tx) => {
    const id = rid("pur");
    const movements: StockMovement[] = [];
    let totalCost = 0;
    for (const item of items) {
      totalCost += item.quantity * item.unitCost;
      const change = await adjustStockTx(tx, {
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        ingredientId: item.ingredientId,
        quantityDelta: item.quantity,
        movementType: "purchase",
        notes: input.notes,
        actor: input.actor,
        referenceType: "purchase",
        referenceId: id,
      });
      movements.push(change.movement);
    }
    const purchase: Purchase = {
      id,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      supplierId: input.supplierId || null,
      status: "received",
      items: items.map((x) => ({
        ingredientId: x.ingredientId,
        quantity: x.quantity,
        unitCost: x.unitCost,
        totalCost: Number((x.quantity * x.unitCost).toFixed(2)),
      })),
      totalCost: Number(totalCost.toFixed(2)),
      notes: input.notes || null,
      createdAt: nowIso(),
    };
    await upsertDoc(tx, purKey(input.restaurantId, input.branchId, id), purchase);
    return { purchase, movements };
  });
}

export async function transferStock(input: {
  restaurantId: string;
  ingredientId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  notes?: string | null;
  actor?: Actor;
}) {
  if (!input.fromBranchId || !input.toBranchId || input.fromBranchId === input.toBranchId) {
    throw new Error("Transfer requires different branches.");
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be positive.");
  return prisma.$transaction(async (tx) => {
    const transferId = rid("trf");
    const source = await adjustStockTx(tx, {
      restaurantId: input.restaurantId,
      branchId: input.fromBranchId,
      ingredientId: input.ingredientId,
      quantityDelta: -input.quantity,
      movementType: "transfer_out",
      actor: input.actor,
      notes: input.notes,
      referenceType: "transfer",
      referenceId: transferId,
    });
    const targetExisting = await getIngredientTx(tx, input.restaurantId, input.toBranchId, input.ingredientId);
    if (!targetExisting) {
      await upsertDoc(tx, ingKey(input.restaurantId, input.toBranchId, input.ingredientId), {
        ...source.ingredient,
        branchId: input.toBranchId,
        currentStock: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    const target = await adjustStockTx(tx, {
      restaurantId: input.restaurantId,
      branchId: input.toBranchId,
      ingredientId: input.ingredientId,
      quantityDelta: input.quantity,
      movementType: "transfer_in",
      actor: input.actor,
      notes: input.notes,
      referenceType: "transfer",
      referenceId: transferId,
    });
    await upsertDoc(tx, trfKey(input.restaurantId, input.fromBranchId, input.toBranchId, transferId), {
      id: transferId,
      restaurantId: input.restaurantId,
      ingredientId: input.ingredientId,
      fromBranchId: input.fromBranchId,
      toBranchId: input.toBranchId,
      quantity: input.quantity,
      status: "completed",
      notes: input.notes || null,
      createdAt: nowIso(),
    });
    return { transferId, source: source.movement, target: target.movement };
  });
}

export async function listMovements(input: {
  restaurantId: string;
  branchId?: string;
  ingredientId?: string;
  movementType?: StockMovementType;
  limit?: number;
}) {
  const prefix = input.branchId
    ? `${K.mov}${input.restaurantId}:${input.branchId}:`
    : `${K.mov}${input.restaurantId}:`;
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: prefix,
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(500, Number(input.limit || 100))),
  });
  return rows
    .map((row) => mapMovement(row.payload))
    .filter((row): row is StockMovement => !!row)
    .filter((row) => (input.ingredientId ? row.ingredientId === input.ingredientId : true))
    .filter((row) => (input.movementType ? row.movementType === input.movementType : true));
}

export async function listPurchases(input: {
  restaurantId: string;
  branchId?: string;
  limit?: number;
}) {
  const prefix = input.branchId
    ? `${K.pur}${input.restaurantId}:${input.branchId}:`
    : `${K.pur}${input.restaurantId}:`;
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: prefix,
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(500, Number(input.limit || 100))),
  });
  return rows.map((row) => mapPurchase(row.payload)).filter((row): row is Purchase => !!row);
}

export async function listTransfers(input: {
  restaurantId: string;
  branchId?: string;
  limit?: number;
}) {
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: `${K.trf}${input.restaurantId}:`,
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(500, Number(input.limit || 100))),
  });
  return rows
    .map((row) => mapTransfer(row.payload))
    .filter((row): row is StockTransfer => !!row)
    .filter((row) => (input.branchId ? row.fromBranchId === input.branchId || row.toBranchId === input.branchId : true));
}

export async function getStockMovementReport(input: {
  restaurantId: string;
  branchId?: string;
  days?: number;
}) {
  const days = Math.max(1, Math.min(365, Number(input.days || 30)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const movements = (await listMovements({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    limit: 2000,
  })).filter((row) => new Date(row.createdAt).getTime() >= since);
  const byType = movements.reduce<Record<string, { count: number; totalAbsDelta: number }>>((acc, row) => {
    const key = row.movementType;
    const item = acc[key] || { count: 0, totalAbsDelta: 0 };
    item.count += 1;
    item.totalAbsDelta += Math.abs(row.quantityDelta);
    acc[key] = item;
    return acc;
  }, {});
  const byIngredient = movements.reduce<Record<string, { ingredientId: string; count: number; netDelta: number }>>(
    (acc, row) => {
      const item = acc[row.ingredientId] || { ingredientId: row.ingredientId, count: 0, netDelta: 0 };
      item.count += 1;
      item.netDelta += row.quantityDelta;
      acc[row.ingredientId] = item;
      return acc;
    },
    {}
  );
  return {
    periodDays: days,
    totalMovements: movements.length,
    byType,
    byIngredient: Object.values(byIngredient).sort((a, b) => Math.abs(b.netDelta) - Math.abs(a.netDelta)),
  };
}

export async function getWastageTrendReport(input: {
  restaurantId: string;
  branchId?: string;
  days?: number;
}) {
  const days = Math.max(1, Math.min(365, Number(input.days || 30)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const wastage = (await listMovements({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    movementType: "wastage",
    limit: 2000,
  })).filter((row) => new Date(row.createdAt).getTime() >= since);
  const points = wastage.reduce<Record<string, { date: string; quantity: number; events: number }>>((acc, row) => {
    const day = new Date(row.createdAt).toISOString().slice(0, 10);
    const point = acc[day] || { date: day, quantity: 0, events: 0 };
    point.quantity += Math.abs(row.quantityDelta);
    point.events += 1;
    acc[day] = point;
    return acc;
  }, {});
  return {
    periodDays: days,
    totalWastageEvents: wastage.length,
    totalWastageQuantity: Number(wastage.reduce((sum, row) => sum + Math.abs(row.quantityDelta), 0).toFixed(4)),
    timeline: Object.values(points).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function deductInventoryForOrderTransition(input: {
  restaurantId: string;
  branchId: string;
  orderId: string;
  toStatus: "pending" | "confirmed" | "preparing" | "ready" | "completed";
  actor?: Actor;
}) {
  const deductionStatuses = new Set(["confirmed", "preparing"]);
  if (!deductionStatuses.has(input.toStatus)) {
    return { deducted: false, reason: "status_not_deductible" as const };
  }

  return prisma.$transaction(
    async (tx) => {
      const marker = dedKey(input.restaurantId, input.orderId, input.toStatus);
      const priorMarkers = await listRestaurantDocumentsTx(tx, {
        restaurantId: input.restaurantId,
        keyPrefix: `${K.ded}${input.restaurantId}:${input.orderId}:`,
        select: { key: true },
        take: 1,
      });
      if (priorMarkers.length) {
        return { deducted: false, reason: "already_deducted" as const };
      }
      const existingMarker = await findRestaurantDocumentByKeyTx(tx, {
        restaurantId: input.restaurantId,
        key: marker,
        select: { id: true },
      });
      if (existingMarker) {
        return { deducted: false, reason: "already_deducted" as const };
      }

      const order = await tx.order.findFirst({
        where: { id: input.orderId, restaurantId: input.restaurantId },
        include: { items: true },
      });
      if (!order) throw new Error("Order not found for deduction.");

      const impacts: Array<{
        ingredientId: string;
        quantity: number;
        movementId: string;
      }> = [];

      for (const orderItem of order.items) {
        const recipeRow = await findRestaurantDocumentByKeyTx(tx, {
          restaurantId: input.restaurantId,
          key: recKey(input.restaurantId, orderItem.dishId),
          select: { payload: true },
        });
        const recipe = recipeRow ? mapRecipe(recipeRow.payload) : null;
        if (!recipe || !recipe.items.length) continue;
        for (const item of recipe.items) {
          const usagePerDish = item.quantity / Math.max(1, recipe.yieldServings);
          const deductionQty = Number((usagePerDish * orderItem.quantity).toFixed(4));
          if (deductionQty <= 0) continue;
          const change = await adjustStockTx(tx, {
            restaurantId: input.restaurantId,
            branchId: input.branchId,
            ingredientId: item.ingredientId,
            quantityDelta: -deductionQty,
            movementType: "deduction",
            referenceType: "order",
            referenceId: input.orderId,
            notes: `Deducted for order ${input.orderId} at ${input.toStatus}`,
            actor: input.actor,
          });
          impacts.push({
            ingredientId: item.ingredientId,
            quantity: deductionQty,
            movementId: change.movement.id,
          });
        }
      }

      await upsertDoc(tx, marker, {
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        orderId: input.orderId,
        status: input.toStatus,
        appliedAt: nowIso(),
        impacts,
      });

      return {
        deducted: true,
        reason: "applied" as const,
        impacts,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}
