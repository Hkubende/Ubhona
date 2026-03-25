import { api } from "./api";

export type IngredientRecord = {
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

export type RecipeRecord = {
  id: string;
  restaurantId: string;
  dishId: string;
  yieldServings: number;
  items: Array<{ ingredientId: string; quantity: number }>;
  createdAt: string;
  updatedAt: string;
};

export type SupplierRecord = {
  id: string;
  restaurantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StockMovementRecord = {
  id: string;
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  movementType: "restock" | "purchase" | "deduction" | "adjustment" | "transfer_in" | "transfer_out" | "wastage";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  createdAt: string;
};

export type PurchaseRecord = {
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

export type TransferRecord = {
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

export type MovementReport = {
  periodDays: number;
  totalMovements: number;
  byType: Record<string, { count: number; totalAbsDelta: number }>;
  byIngredient: Array<{ ingredientId: string; count: number; netDelta: number }>;
};

export type WastageReport = {
  periodDays: number;
  totalWastageEvents: number;
  totalWastageQuantity: number;
  timeline: Array<{ date: string; quantity: number; events: number }>;
};

export async function getInventoryOverview(branchId = "main") {
  const [ingredients, recipes, suppliers, purchases, transfers, movements, movementReport, wastageReport] =
    await Promise.all([
      api.get<IngredientRecord[]>(`/inventory/ingredients?branchId=${encodeURIComponent(branchId)}`),
      api.get<RecipeRecord[]>("/inventory/recipes"),
      api.get<SupplierRecord[]>("/inventory/suppliers"),
      api.get<PurchaseRecord[]>(`/inventory/purchases?branchId=${encodeURIComponent(branchId)}&limit=100`),
      api.get<TransferRecord[]>(`/inventory/transfers?branchId=${encodeURIComponent(branchId)}&limit=100`),
      api.get<StockMovementRecord[]>(`/inventory/movements?branchId=${encodeURIComponent(branchId)}&limit=200`),
      api.get<MovementReport>(`/inventory/reports/movements?branchId=${encodeURIComponent(branchId)}&days=30`),
      api.get<WastageReport>(`/inventory/reports/wastage?branchId=${encodeURIComponent(branchId)}&days=30`),
    ]);
  return {
    ingredients,
    recipes,
    suppliers,
    purchases,
    transfers,
    movements,
    movementReport,
    wastageReport,
  };
}

export async function saveIngredient(input: {
  ingredientId?: string;
  branchId: string;
  name: string;
  unit?: string;
  currentStock?: number;
  reorderLevel?: number;
  isActive?: boolean;
}) {
  return api.post<IngredientRecord>("/inventory/ingredients", input);
}

export async function saveDishRecipe(input: {
  dishId: string;
  yieldServings?: number;
  items: Array<{ ingredientId: string; quantity: number }>;
}) {
  return api.put<RecipeRecord>(`/inventory/recipes/${encodeURIComponent(input.dishId)}`, {
    yieldServings: input.yieldServings,
    items: input.items,
  });
}

export async function saveSupplier(input: {
  supplierId?: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  return api.post<SupplierRecord>("/inventory/suppliers", input);
}

export async function restockIngredientApi(input: {
  branchId: string;
  ingredientId: string;
  quantity: number;
  notes?: string;
}) {
  return api.post("/inventory/restock", input);
}

export async function recordWastageApi(input: {
  branchId: string;
  ingredientId: string;
  quantity: number;
  notes?: string;
}) {
  return api.post("/inventory/wastage", input);
}

export async function createPurchaseApi(input: {
  branchId: string;
  supplierId?: string;
  notes?: string;
  items: Array<{ ingredientId: string; quantity: number; unitCost: number }>;
}) {
  return api.post("/inventory/purchases", input);
}

export async function transferStockApi(input: {
  ingredientId: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  notes?: string;
}) {
  return api.post("/inventory/transfers", input);
}
