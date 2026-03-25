import * as React from "react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  ContentGrid,
  DashboardPanel,
  DataTable,
  EmptyStateCard,
  MetricCard,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import type { RestaurantProfile } from "../lib/restaurant";
import {
  createPurchaseApi,
  getInventoryOverview,
  type MovementReport,
  type PurchaseRecord,
  recordWastageApi,
  restockIngredientApi,
  type RecipeRecord,
  saveDishRecipe,
  saveIngredient,
  type StockMovementRecord,
  transferStockApi,
  type TransferRecord,
  type IngredientRecord,
  type WastageReport,
} from "../lib/inventory";

function asCurrency(value: number) {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function movementBadge(type: string) {
  if (type === "deduction") return <Badge variant="warning">Deduction</Badge>;
  if (type === "wastage") return <Badge variant="danger">Wastage</Badge>;
  if (type === "purchase") return <Badge variant="success">Purchase</Badge>;
  if (type === "transfer_in" || type === "transfer_out") return <Badge variant="accent">Transfer</Badge>;
  return <Badge variant="neutral">{type}</Badge>;
}

export default function InventoryPage() {
  const { data } = useRestaurantDashboard();
  const [branchId, setBranchId] = React.useState("main");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [ingredients, setIngredients] = React.useState<IngredientRecord[]>([]);
  const [recipes, setRecipes] = React.useState<RecipeRecord[]>([]);
  const [movements, setMovements] = React.useState<StockMovementRecord[]>([]);
  const [purchases, setPurchases] = React.useState<PurchaseRecord[]>([]);
  const [transfers, setTransfers] = React.useState<TransferRecord[]>([]);
  const [movementReport, setMovementReport] = React.useState<MovementReport | null>(null);
  const [wastageReport, setWastageReport] = React.useState<WastageReport | null>(null);

  const [ingredientName, setIngredientName] = React.useState("");
  const [ingredientUnit, setIngredientUnit] = React.useState("unit");
  const [ingredientQty, setIngredientQty] = React.useState("0");
  const [restockIngredientId, setRestockIngredientId] = React.useState("");
  const [restockQty, setRestockQty] = React.useState("");
  const [wastageIngredientId, setWastageIngredientId] = React.useState("");
  const [wastageQty, setWastageQty] = React.useState("");
  const [purchaseIngredientId, setPurchaseIngredientId] = React.useState("");
  const [purchaseQty, setPurchaseQty] = React.useState("");
  const [purchaseUnitCost, setPurchaseUnitCost] = React.useState("");
  const [transferIngredientId, setTransferIngredientId] = React.useState("");
  const [transferToBranch, setTransferToBranch] = React.useState("branch-2");
  const [transferQty, setTransferQty] = React.useState("");
  const [recipeDishId, setRecipeDishId] = React.useState("");
  const [recipeIngredientId, setRecipeIngredientId] = React.useState("");
  const [recipeQty, setRecipeQty] = React.useState("");
  const [recipeYield, setRecipeYield] = React.useState("1");
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getInventoryOverview(branchId)
      .then((snapshot) => {
        if (!active) return;
        setIngredients(snapshot.ingredients);
        setRecipes(snapshot.recipes);
        setMovements(snapshot.movements);
        setPurchases(snapshot.purchases);
        setTransfers(snapshot.transfers);
        setMovementReport(snapshot.movementReport);
        setWastageReport(snapshot.wastageReport);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load inventory.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branchId, refreshKey]);

  const profile = React.useMemo<RestaurantProfile | null>(() => {
    if (!data) return null;
    return {
      id: data.restaurant.id,
      restaurantName: data.restaurant.name,
      slug: data.restaurant.slug,
      phone: data.restaurant.phone,
      email: data.restaurant.email,
      location: data.restaurant.location,
      logo: data.brandingSettings.logoUrl || data.restaurant.logoUrl,
      coverImage: data.brandingSettings.coverImageUrl || data.restaurant.coverImageUrl,
      themePrimary: data.brandingSettings.primaryColor || data.restaurant.primaryColor,
      themeSecondary: "#E8D8C3",
      shortDescription: data.brandingSettings.description || data.restaurant.description,
      subscriptionPlan: data.restaurant.subscriptionPlan || "starter",
      subscriptionStatus: data.restaurant.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [data]);

  const lowStockCount = ingredients.filter((row) => row.currentStock <= row.reorderLevel).length;
  const totalStock = ingredients.reduce((sum, row) => sum + row.currentStock, 0);
  const wastageTotal = Number(wastageReport?.totalWastageQuantity || 0);

  async function runAction(action: string, fn: () => Promise<void>) {
    try {
      setBusy(action);
      await fn();
      setRefreshKey((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inventory action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardLayout
      profile={profile}
      title="Inventory"
      subtitle="Ingredient stocks, branch transfers, purchases, and movement trends."
      actions={
        <Input
          id="inventory-branch"
          name="inventoryBranch"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          placeholder="Branch ID (e.g. main)"
          className="w-44"
        />
      }
    >
      <PageContainer>
        {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        <ContentGrid columns="four">
          <MetricCard label="Ingredients" value={String(ingredients.length)} />
          <MetricCard label="Total Stock Units" value={String(totalStock)} />
          <MetricCard label="Low Stock Alerts" value={String(lowStockCount)} tone={lowStockCount ? "orange" : "default"} />
          <MetricCard label="30d Wastage" value={String(wastageTotal)} tone={wastageTotal ? "orange" : "default"} />
        </ContentGrid>

        <ContentGrid columns="three">
          <DashboardPanel>
            <SectionHeader title="Add Ingredient" subtitle="Branch-level ingredient entity setup for recipe mapping." />
            <div className="mt-3 space-y-2">
              <Input id="ingredient-name" name="ingredientName" value={ingredientName} onChange={(e) => setIngredientName(e.target.value)} placeholder="Ingredient name" />
              <div className="grid grid-cols-2 gap-2">
                <Input id="ingredient-unit" name="ingredientUnit" value={ingredientUnit} onChange={(e) => setIngredientUnit(e.target.value)} placeholder="Unit (kg, ltr, pcs)" />
                <Input id="ingredient-qty" name="ingredientQty" type="number" min="0" value={ingredientQty} onChange={(e) => setIngredientQty(e.target.value)} placeholder="Opening stock" />
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={!ingredientName.trim() || busy === "create_ingredient"}
                onClick={() =>
                  void runAction("create_ingredient", async () => {
                    await saveIngredient({
                      branchId,
                      name: ingredientName,
                      unit: ingredientUnit || "unit",
                      currentStock: Number(ingredientQty || 0),
                      reorderLevel: 5,
                    });
                    setIngredientName("");
                    setIngredientQty("0");
                  })
                }
              >
                Add Ingredient
              </Button>
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Restock / Wastage" subtitle="Apply stock adjustments with branch audit history." />
            <div className="mt-3 space-y-3">
              <Input id="restock-ingredient-id" name="restockIngredientId" value={restockIngredientId} onChange={(e) => setRestockIngredientId(e.target.value)} placeholder="Ingredient ID for restock" />
              <div className="grid grid-cols-2 gap-2">
                <Input id="restock-qty" name="restockQty" type="number" min="0.1" step="0.1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="Restock qty" />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!restockIngredientId || !Number(restockQty) || busy === "restock"}
                  onClick={() =>
                    void runAction("restock", async () => {
                      await restockIngredientApi({ branchId, ingredientId: restockIngredientId, quantity: Number(restockQty) });
                      setRestockQty("");
                    })
                  }
                >
                  Restock
                </Button>
              </div>
              <Input id="wastage-ingredient-id" name="wastageIngredientId" value={wastageIngredientId} onChange={(e) => setWastageIngredientId(e.target.value)} placeholder="Ingredient ID for wastage" />
              <div className="grid grid-cols-2 gap-2">
                <Input id="wastage-qty" name="wastageQty" type="number" min="0.1" step="0.1" value={wastageQty} onChange={(e) => setWastageQty(e.target.value)} placeholder="Wastage qty" />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!wastageIngredientId || !Number(wastageQty) || busy === "wastage"}
                  onClick={() =>
                    void runAction("wastage", async () => {
                      await recordWastageApi({ branchId, ingredientId: wastageIngredientId, quantity: Number(wastageQty) });
                      setWastageQty("");
                    })
                  }
                >
                  Record Wastage
                </Button>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Purchase / Transfer" subtitle="Capture procurement and branch transfer events." />
            <div className="mt-3 space-y-3">
              <Input id="purchase-ingredient-id" name="purchaseIngredientId" value={purchaseIngredientId} onChange={(e) => setPurchaseIngredientId(e.target.value)} placeholder="Purchase ingredient ID" />
              <div className="grid grid-cols-2 gap-2">
                <Input id="purchase-qty" name="purchaseQty" type="number" min="0.1" step="0.1" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} placeholder="Qty" />
                <Input id="purchase-unit-cost" name="purchaseUnitCost" type="number" min="0" step="0.01" value={purchaseUnitCost} onChange={(e) => setPurchaseUnitCost(e.target.value)} placeholder="Unit cost" />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!purchaseIngredientId || !Number(purchaseQty) || busy === "purchase"}
                onClick={() =>
                  void runAction("purchase", async () => {
                    await createPurchaseApi({
                      branchId,
                      items: [
                        {
                          ingredientId: purchaseIngredientId,
                          quantity: Number(purchaseQty),
                          unitCost: Number(purchaseUnitCost || 0),
                        },
                      ],
                    });
                    setPurchaseQty("");
                    setPurchaseUnitCost("");
                  })
                }
              >
                Record Purchase
              </Button>
              <Input id="transfer-ingredient-id" name="transferIngredientId" value={transferIngredientId} onChange={(e) => setTransferIngredientId(e.target.value)} placeholder="Transfer ingredient ID" />
              <div className="grid grid-cols-2 gap-2">
                <Input id="transfer-to-branch" name="transferToBranch" value={transferToBranch} onChange={(e) => setTransferToBranch(e.target.value)} placeholder="To branch" />
                <Input id="transfer-qty" name="transferQty" type="number" min="0.1" step="0.1" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder="Transfer qty" />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!transferIngredientId || !transferToBranch || !Number(transferQty) || busy === "transfer"}
                onClick={() =>
                  void runAction("transfer", async () => {
                    await transferStockApi({
                      ingredientId: transferIngredientId,
                      fromBranchId: branchId,
                      toBranchId: transferToBranch,
                      quantity: Number(transferQty),
                    });
                    setTransferQty("");
                  })
                }
              >
                Transfer Stock
              </Button>
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Recipe Mapping" subtitle="Map dish consumption to ingredients for automatic stock deduction." />
            <div className="mt-3 space-y-3">
              <Input id="recipe-dish-id" name="recipeDishId" value={recipeDishId} onChange={(e) => setRecipeDishId(e.target.value)} placeholder="Dish ID" />
              <Input id="recipe-ingredient-id" name="recipeIngredientId" value={recipeIngredientId} onChange={(e) => setRecipeIngredientId(e.target.value)} placeholder="Ingredient ID" />
              <div className="grid grid-cols-2 gap-2">
                <Input id="recipe-qty" name="recipeQty" type="number" min="0.0001" step="0.0001" value={recipeQty} onChange={(e) => setRecipeQty(e.target.value)} placeholder="Ingredient qty per recipe batch" />
                <Input id="recipe-yield" name="recipeYield" type="number" min="1" step="1" value={recipeYield} onChange={(e) => setRecipeYield(e.target.value)} placeholder="Yield servings" />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!recipeDishId || !recipeIngredientId || !Number(recipeQty) || busy === "recipe"}
                onClick={() =>
                  void runAction("recipe", async () => {
                    const current = recipes.find((row) => row.dishId === recipeDishId);
                    const existingItems = Array.isArray(current?.items) ? current.items : [];
                    const nextItems = [
                      ...existingItems.filter((row) => row.ingredientId !== recipeIngredientId),
                      { ingredientId: recipeIngredientId, quantity: Number(recipeQty) },
                    ];
                    await saveDishRecipe({
                      dishId: recipeDishId,
                      yieldServings: Math.max(1, Number(recipeYield || 1)),
                      items: nextItems,
                    });
                    setRecipeQty("");
                  })
                }
              >
                Save Recipe Mapping
              </Button>
              <div className="text-xs text-white/58">
                Active recipes: {recipes.length}. Confirmed/preparing transitions will deduct ingredient stock using this mapping.
              </div>
            </div>
          </DashboardPanel>
        </ContentGrid>

        <ContentGrid columns="two">
          <DashboardPanel>
            <SectionHeader title="Stock Movement Report (30d)" subtitle="Movement volume by type and ingredient net delta." />
            {movementReport ? (
              <div className="mt-3 space-y-3 text-sm text-white/78">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  Total movements: {movementReport.totalMovements}
                </div>
                <div className="space-y-2">
                  {Object.entries(movementReport.byType || {}).map(([type, row]) => (
                    <div key={type} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
                      <div className="flex items-center gap-2">{movementBadge(type)}</div>
                      <div className="text-xs text-white/65">{row.count} events • {row.totalAbsDelta.toFixed(2)} units</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyStateCard message={loading ? "Loading movement report..." : "No movement report available."} />
            )}
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Wastage Trend (30d)" subtitle="Track wastage events and quantity trend for branch operations." />
            {wastageReport ? (
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75">
                  {wastageReport.totalWastageEvents} wastage events • {wastageReport.totalWastageQuantity.toFixed(2)} units
                </div>
                {(wastageReport.timeline || []).slice(-7).map((point) => (
                  <div key={point.date} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs text-white/75">
                    <span>{point.date}</span>
                    <span>{point.events} events</span>
                    <span>{Number(point.quantity).toFixed(2)} units</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStateCard message={loading ? "Loading wastage trend..." : "No wastage data available."} />
            )}
          </DashboardPanel>
        </ContentGrid>

        <DashboardPanel>
          <SectionHeader title="Ingredient Ledger" subtitle="Current branch ingredient stocks and movement history." />
          <DataTable className="mt-3">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.1em] text-white/55">
                <tr>
                  <th className="px-3 py-2 text-left">Ingredient</th>
                  <th className="px-3 py-2 text-left">Stock</th>
                  <th className="px-3 py-2 text-left">Reorder</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 text-white/78">
                    <td className="px-3 py-2">
                      <div className="font-medium text-text-primary">{row.name}</div>
                      <div className="text-xs text-white/55">{row.id}</div>
                    </td>
                    <td className="px-3 py-2">
                      {row.currentStock.toFixed(2)} {row.unit}
                    </td>
                    <td className="px-3 py-2">{row.reorderLevel.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-white/55">{new Date(row.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          {!ingredients.length && !loading ? <EmptyStateCard message="No ingredients configured for this branch yet." /> : null}
        </DashboardPanel>

        <ContentGrid columns="two">
          <DashboardPanel>
            <SectionHeader title="Recent Movements" subtitle="Latest deduction/restock/purchase/transfer events." />
            <DataTable className="mt-3">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.1em] text-white/55">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Ingredient</th>
                    <th className="px-3 py-2 text-left">Delta</th>
                    <th className="px-3 py-2 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.slice(0, 30).map((row) => (
                    <tr key={row.id} className="border-b border-white/5 text-white/78">
                      <td className="px-3 py-2">{movementBadge(row.movementType)}</td>
                      <td className="px-3 py-2 text-xs">{row.ingredientId}</td>
                      <td className="px-3 py-2">{Number(row.quantityDelta).toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs text-white/55">{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Purchases & Transfers" subtitle="Supplier purchase history and branch stock transfer events." />
            <div className="mt-3 space-y-2">
              {purchases.slice(0, 10).map((row) => (
                <div key={row.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/76">
                  <div className="font-medium text-text-primary">Purchase {row.id}</div>
                  <div>{new Date(row.createdAt).toLocaleString()} • {asCurrency(Number(row.totalCost || 0))}</div>
                </div>
              ))}
              {transfers.slice(0, 10).map((row) => (
                <div key={row.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/76">
                  <div className="font-medium text-text-primary">Transfer {row.id}</div>
                  <div>{row.fromBranchId} → {row.toBranchId} • {Number(row.quantity).toFixed(2)} units</div>
                </div>
              ))}
              {!purchases.length && !transfers.length && !loading ? (
                <EmptyStateCard message="No purchase or transfer records for this branch yet." />
              ) : null}
            </div>
          </DashboardPanel>
        </ContentGrid>
      </PageContainer>
    </DashboardLayout>
  );
}
