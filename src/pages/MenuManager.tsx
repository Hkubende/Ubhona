import * as React from "react";
import { Check, Copy, ExternalLink, Pencil, PlusCircle, QrCode, Search, Trash2 } from "lucide-react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  DataTable,
  DashboardPanel,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { DishWorkspacePanel, type DishFormState } from "../components/menu/DishWorkspacePanel";
import { QrCodeDialog } from "../components/qr/QrCodeDialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ImageThumbnail } from "../components/ui/ImageThumbnail";
import { Input } from "../components/ui/Input";
import { DishCard } from "../components/ui/DishCard";
import { UbhonaActionMenu } from "../components/ui/ubhona-action-menu";
import { UbhonaSelect, UbhonaSelectItem } from "../components/ui/ubhona-select";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import { useRestaurantMenuBuilder } from "../hooks/use-restaurant-menu-builder";
import { getFilteredDishes, normalizeDishInput, sortCategories } from "../lib/menu-builder";
import { cn } from "../lib/utils";
import { spacing, tokens, typography } from "../design-system";
import { getCurrentPlan, type RestaurantProfile } from "../lib/restaurant";
import type { Dish } from "../types/dashboard";
import { getRemainingStarterAllowance, getUpgradePrompt } from "../lib/growth";
import { canPerformAction } from "../lib/roles";
import { Link } from "react-router-dom";
import { getDishUrl, getStorefrontMenuUrl } from "../lib/qr";
import { getCurrentBranchId } from "../services/automation-engine";
import { updateDishStock } from "../lib/stock";

const EMPTY_DISH_FORM: DishFormState = {
  name: "",
  description: "",
  price: "",
  categoryId: "",
  available: true,
  imageUrl: "",
  modelUrl: "",
};

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

function getStockTone(status?: "available" | "low_stock" | "unavailable") {
  if (status === "unavailable") return "danger" as const;
  if (status === "low_stock") return "warning" as const;
  return "success" as const;
}

function getStockLabel(dish: Dish) {
  const status = dish.stock?.availability_status;
  if (status === "unavailable") return "Unavailable";
  if (status === "low_stock") return "Low Stock";
  if (dish.available) return "Available";
  return "Paused";
}

export default function MenuManager() {
  const { data } = useRestaurantDashboard();
  const {
    categories,
    dishes,
    loading,
    saving,
    error,
    createCategory,
    editCategory,
    removeCategory,
    createDish,
    editDish,
    removeDish,
    refresh: refreshMenu,
  } = useRestaurantMenuBuilder();

  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = React.useState("");
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = React.useState(false);
  const [dishForm, setDishForm] = React.useState<DishFormState>(EMPTY_DISH_FORM);
  const [stockQtyDraft, setStockQtyDraft] = React.useState("");
  const [stockThresholdDraft, setStockThresholdDraft] = React.useState("5");
  const [editingDishId, setEditingDishId] = React.useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = React.useState<Record<string, string>>({});
  const [qrDialog, setQrDialog] = React.useState<{
    kind: "menu" | "dish";
    title: string;
    description: string;
    linkLabel: string;
    printTitle: string;
    url: string;
  } | null>(null);
  const workspaceRef = React.useRef<HTMLDivElement | null>(null);

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
      themeSecondary: "#34d399",
      shortDescription: data.brandingSettings.description || data.restaurant.description,
      subscriptionPlan: data.restaurant.subscriptionPlan || "starter",
      subscriptionStatus: data.restaurant.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [data]);
  const currentPlan = React.useMemo(() => getCurrentPlan(profile), [profile]);
  const allowance = React.useMemo(
    () => (profile ? getRemainingStarterAllowance(profile.id) : null),
    [profile]
  );
  const canManageStock = canPerformAction("manage_stock");
  const branchId = React.useMemo(() => getCurrentBranchId(), []);

  const sortedCategories = React.useMemo(() => sortCategories(categories), [categories]);
  const categoryNameById = React.useMemo(
    () => new Map(sortedCategories.map((category) => [category.id, category.name])),
    [sortedCategories]
  );
  const filteredDishes = React.useMemo(
    () => getFilteredDishes(dishes, search, categoryFilter),
    [categoryFilter, dishes, search]
  );
  const storefrontMenuUrl = React.useMemo(
    () => (profile?.slug ? getStorefrontMenuUrl(profile.slug) : ""),
    [profile]
  );
  const activeDish = React.useMemo(
    () => dishes.find((dish) => dish.id === editingDishId) || null,
    [dishes, editingDishId]
  );
  const categoryCounts = React.useMemo(
    () =>
      sortedCategories.map((category) => ({
        ...category,
        count: dishes.filter((dish) => dish.categoryId === category.id).length,
      })),
    [dishes, sortedCategories]
  );

  React.useEffect(() => {
    setPriceDrafts(
      Object.fromEntries(dishes.map((dish) => [dish.id, String(Number.isFinite(dish.price) ? dish.price : 0)]))
    );
  }, [dishes]);

  React.useEffect(() => {
    if (!dishForm.categoryId && sortedCategories.length) {
      setDishForm((current) => ({ ...current, categoryId: sortedCategories[0].id }));
    }
  }, [dishForm.categoryId, sortedCategories]);

  React.useEffect(() => {
    if (!loading && !sortedCategories.length) {
      setIsCategoryManagerOpen(true);
    }
  }, [loading, sortedCategories.length]);

  React.useEffect(() => {
    if (!activeDish) {
      setStockQtyDraft("");
      setStockThresholdDraft("5");
      return;
    }
    setStockQtyDraft(
      activeDish.stock?.stock_quantity == null ? "" : String(activeDish.stock.stock_quantity)
    );
    setStockThresholdDraft(String(activeDish.stock?.low_stock_threshold ?? 5));
  }, [activeDish]);

  const scrollToWorkspace = React.useCallback(() => {
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const getSuggestedCategoryId = React.useCallback(() => {
    if (categoryFilter !== "all") return categoryFilter;
    if (dishForm.categoryId) return dishForm.categoryId;
    return sortedCategories[0]?.id || "";
  }, [categoryFilter, dishForm.categoryId, sortedCategories]);

  const resetDishForm = React.useCallback(
    (categoryId = getSuggestedCategoryId()) => {
      setEditingDishId(null);
      setDishForm({
        ...EMPTY_DISH_FORM,
        categoryId,
      });
    },
    [getSuggestedCategoryId]
  );

  const populateDishForm = React.useCallback(
    (dish: Dish) => {
      setEditingDishId(dish.id);
      setDishForm({
        name: dish.name,
        description: dish.description,
        price: String(dish.price),
        categoryId: dish.categoryId,
        available: dish.available,
        imageUrl: dish.imageUrl || "",
        modelUrl: dish.modelUrl || "",
      });
      setIsCategoryManagerOpen(false);
      scrollToWorkspace();
    },
    [scrollToWorkspace]
  );

  const buildDishPayload = React.useCallback(
    (dish: Dish, overrides?: Partial<Dish>) =>
      normalizeDishInput({
        name: overrides?.name ?? dish.name,
        description: overrides?.description ?? dish.description,
        price: overrides?.price ?? dish.price,
        categoryId: overrides?.categoryId ?? dish.categoryId,
        available: overrides?.available ?? dish.available,
        imageUrl: overrides?.imageUrl ?? dish.imageUrl ?? "",
        modelUrl: overrides?.modelUrl ?? dish.modelUrl ?? "",
      }),
    []
  );

  const onAddCategory = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await createCategory({ name: newCategoryName, sortOrder: sortedCategories.length });
      setNewCategoryName("");
    },
    [createCategory, newCategoryName, sortedCategories.length]
  );

  const onSaveCategoryEdit = React.useCallback(async () => {
    if (!editingCategoryId) return;
    const target = sortedCategories.find((category) => category.id === editingCategoryId);
    await editCategory(editingCategoryId, {
      name: editingCategoryName,
      sortOrder: target?.sortOrder,
    });
    setEditingCategoryId(null);
    setEditingCategoryName("");
  }, [editCategory, editingCategoryId, editingCategoryName, sortedCategories]);

  const onSubmitDish = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const payload = normalizeDishInput(dishForm);
      let saved = false;
      if (editingDishId) {
        saved = await editDish(editingDishId, payload);
      } else {
        saved = await createDish(payload);
      }
      if (saved) {
        resetDishForm(payload.categoryId || sortedCategories[0]?.id || "");
      }
    },
    [createDish, dishForm, editDish, editingDishId, resetDishForm, sortedCategories]
  );

  const onDuplicateDish = React.useCallback(
    async (dishId: string) => {
      const dish = dishes.find((row) => row.id === dishId);
      if (!dish) return;
      await createDish({
        name: `${dish.name} Copy`,
        description: dish.description,
        price: dish.price,
        categoryId: dish.categoryId,
        available: dish.available,
        imageUrl: dish.imageUrl || "",
        modelUrl: dish.modelUrl,
      });
    },
    [createDish, dishes]
  );

  const onToggleAvailability = React.useCallback(
    async (dish: Dish) => {
      await editDish(dish.id, buildDishPayload(dish, { available: !dish.available }));
    },
    [buildDishPayload, editDish]
  );

  const onSavePrice = React.useCallback(
    async (dish: Dish) => {
      const nextPrice = Number(priceDrafts[dish.id]);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;
      await editDish(dish.id, buildDishPayload(dish, { price: nextPrice }));
    },
    [buildDishPayload, editDish, priceDrafts]
  );

  const saveDishStock = React.useCallback(
    async (
      dish: Dish,
      patch?: Partial<{
        availability_status: "available" | "low_stock" | "unavailable";
        stock_quantity: number | null;
        low_stock_threshold: number;
        hidden_from_public_menu: boolean;
      }>
    ) => {
      if (!canManageStock) return;
      const qtyFromDraft =
        stockQtyDraft.trim() === ""
          ? null
          : Number.isFinite(Number(stockQtyDraft))
            ? Math.max(0, Math.floor(Number(stockQtyDraft)))
            : null;
      const thresholdFromDraft = Number.isFinite(Number(stockThresholdDraft))
        ? Math.max(0, Math.floor(Number(stockThresholdDraft)))
        : 5;
      await updateDishStock({
        dish,
        branchId,
        availability_status: patch?.availability_status,
        stock_quantity: patch && "stock_quantity" in patch ? patch.stock_quantity ?? null : qtyFromDraft,
        low_stock_threshold:
          patch && "low_stock_threshold" in patch
            ? patch.low_stock_threshold ?? thresholdFromDraft
            : thresholdFromDraft,
        hidden_from_public_menu:
          patch && "hidden_from_public_menu" in patch
            ? Boolean(patch.hidden_from_public_menu)
            : Boolean(dish.stock?.hidden_from_public_menu),
      });
      await refreshMenu();
    },
    [branchId, canManageStock, refreshMenu, stockQtyDraft, stockThresholdDraft]
  );

  const toggleHiddenFromPublic = React.useCallback(
    async (dish: Dish) => {
      if (!canManageStock) return;
      await saveDishStock(dish, { hidden_from_public_menu: !dish.stock?.hidden_from_public_menu });
    },
    [canManageStock, saveDishStock]
  );

  const onCreateDishFromHeader = React.useCallback(() => {
    resetDishForm();
    setIsCategoryManagerOpen((current) => current || !sortedCategories.length);
    scrollToWorkspace();
  }, [resetDishForm, scrollToWorkspace, sortedCategories.length]);

  const openMenuQr = React.useCallback(() => {
    if (!profile?.slug) return;
    const menuUrl = getStorefrontMenuUrl(profile.slug);
    if (!menuUrl) return;
    setQrDialog({
      kind: "menu",
      title: "Restaurant Menu QR",
      description: "Use this for table cards, counter signs, flyers, and storefront traffic.",
      linkLabel: "Menu URL",
      printTitle: `${profile.restaurantName} Menu`,
      url: menuUrl,
    });
  }, [profile]);

  const openDishQr = React.useCallback(
    (dish: Dish) => {
      if (!profile?.slug) return;
      const dishUrl = getDishUrl(profile.slug, dish.id);
      if (!dishUrl) return;
      setQrDialog({
        kind: "dish",
        title: `${dish.name} QR`,
        description: "Link directly to this dish page for promos and featured-item cards.",
        linkLabel: "Dish URL",
        printTitle: `${profile.restaurantName} ${dish.name}`,
        url: dishUrl,
      });
    },
    [profile]
  );

  const getDishPublicUrl = React.useCallback(
    (dish: Dish) => {
      if (!profile?.slug) return "";
      return getDishUrl(profile.slug, dish.id);
    },
    [profile]
  );

  const openDishPublicUrl = React.useCallback(
    (dish: Dish) => {
      const url = getDishPublicUrl(dish);
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [getDishPublicUrl]
  );

  const copyDishPublicUrl = React.useCallback(
    async (dish: Dish) => {
      const url = getDishPublicUrl(dish);
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copy dish link", url);
      }
    },
    [getDishPublicUrl]
  );

  const resultsSummary =
    categoryFilter === "all"
      ? `${filteredDishes.length} dishes`
      : `${filteredDishes.length} in ${categoryNameById.get(categoryFilter) || "selected category"}`;

  return (
    <DashboardLayout
      profile={profile}
      title="Menu"
      subtitle="Operate dishes, categories, pricing, and imagery from one tighter workspace."
      showTopbarSearch={false}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={openMenuQr}
            disabled={!storefrontMenuUrl}
          >
            <QrCode className="h-4 w-4" />
            Menu QR
          </Button>
          <Button variant="primary" size="sm" className="gap-2" onClick={onCreateDishFromHeader}>
            <PlusCircle className="h-4 w-4" />
            Add Dish
          </Button>
        </div>
      }
    >
      <PageContainer className={spacing.stackLg}>
        {error && /starter includes up to|orders\/month/i.test(error) ? (
          <DashboardPanel>
            <SectionHeader
              title={getUpgradePrompt("dish_limit").title}
              subtitle={error}
              action={
                <Link to={getUpgradePrompt("dish_limit").to}>
                  <Button variant="primary" size="sm">{getUpgradePrompt("dish_limit").ctaLabel}</Button>
                </Link>
              }
            />
          </DashboardPanel>
        ) : null}
        {currentPlan.plan === "starter" && allowance ? (
          <DashboardPanel>
            <SectionHeader title="Starter Usage" subtitle="Upgrade before limits block operations." />
            <div className="flex flex-wrap gap-2 text-sm text-white/75">
              <span className={tokens.classes.metricChip}>
                Dishes remaining: {allowance.dishesRemaining == null ? "Unlimited" : allowance.dishesRemaining}
              </span>
              <span className={tokens.classes.metricChip}>
                Orders remaining this month:{" "}
                {allowance.monthlyOrdersRemaining == null ? "Unlimited" : allowance.monthlyOrdersRemaining}
              </span>
              <Link to="/pricing" className="inline-flex">
                <Button size="sm" variant="secondary">Compare Plans</Button>
              </Link>
            </div>
          </DashboardPanel>
        ) : null}
        <DashboardPanel className={spacing.stackLg}>
          <SectionHeader
            title="Menu Controls"
            subtitle="One search and one category filter for the full menu workspace."
            action={
              <div className={cn("flex flex-wrap items-center justify-end", spacing.gapSm)}>
                <div className={cn(tokens.classes.metricChip, "py-1")}>
                  {resultsSummary}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={openMenuQr}
                  disabled={!storefrontMenuUrl}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Menu QR
                </Button>
              </div>
            }
          />
          <div className={cn("grid xl:grid-cols-[minmax(0,1fr)_240px_auto]", spacing.gapMd)}>
            <div>
              <label htmlFor="menu-search" className={cn("mb-1.5 block", typography.label)}>
                Dish Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
                <Input
                  id="menu-search"
                  name="menuSearch"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search dishes by name or description"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label htmlFor="menu-category-filter" className={cn("mb-1.5 block", typography.label)}>
                Category Filter
              </label>
              <UbhonaSelect
                id="menu-category-filter"
                name="menuCategoryFilter"
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                placeholder="All categories"
              >
                <UbhonaSelectItem value="all">All categories</UbhonaSelectItem>
                {sortedCategories.map((category) => (
                  <UbhonaSelectItem key={category.id} value={category.id}>
                    {category.name}
                  </UbhonaSelectItem>
                ))}
              </UbhonaSelect>
            </div>
            <div className={cn("flex flex-wrap items-center xl:justify-end", spacing.gapSm)}>
              <div className={tokens.classes.metricChip}>
                {sortedCategories.length} categories
              </div>
              <div className={tokens.classes.metricChip}>
                {dishes.length} total dishes
              </div>
              {(search || categoryFilter !== "all") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/70"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </DashboardPanel>

        <div className={cn("grid xl:grid-cols-[minmax(0,1.62fr)_minmax(420px,500px)]", spacing.gapLg)}>
          <div className={cn("order-2 xl:order-1", spacing.stackLg)}>
            <DashboardPanel className={cn("overflow-hidden p-5 lg:p-6", spacing.stackMd)}>
              <SectionHeader
                title="Dishes"
                subtitle="Visual rows, fast price updates, and edit actions that stay in this workspace."
              />
              {loading ? <p className="text-sm text-white/70">Loading menu data...</p> : null}
              {error ? <EmptyStateCard message={error} /> : null}
              {!loading && !error && !sortedCategories.length ? (
                <EmptyStateCard
                  message="Add at least one category to start building the menu."
                  actionLabel="Open category manager"
                  onAction={() => {
                    setIsCategoryManagerOpen(true);
                    scrollToWorkspace();
                  }}
                />
              ) : null}
              {!loading && !error && filteredDishes.length ? (
                <>
                  <div className="space-y-3 lg:hidden">
                    {filteredDishes.map((dish) => {
                      const priceDraft = priceDrafts[dish.id] ?? String(dish.price);
                      const parsedPrice = Number(priceDraft);
                      const priceChanged = parsedPrice !== dish.price;
                      const canSavePrice = Number.isFinite(parsedPrice) && parsedPrice > 0 && priceChanged && !saving;

                      return (
                        <DishCard
                          key={dish.id}
                          name={dish.name}
                          description={dish.description}
                          imageUrl={dish.imageUrl}
                          categoryLabel={categoryNameById.get(dish.categoryId) || "Unknown"}
                          status={<Badge variant={getStockTone(dish.stock?.availability_status)}>{getStockLabel(dish)}</Badge>}
                          active={editingDishId === dish.id}
                          onClick={() => populateDishForm(dish)}
                          actions={
                            <UbhonaActionMenu
                              items={[
                                {
                                  key: "edit",
                                  label: "Edit details",
                                  icon: <Pencil className="h-3.5 w-3.5" />,
                                  onSelect: () => populateDishForm(dish),
                                },
                                {
                                  key: "duplicate",
                                  label: "Duplicate",
                                  icon: <Copy className="h-3.5 w-3.5" />,
                                  onSelect: () => void onDuplicateDish(dish.id),
                                },
                                {
                                  key: "view-dish",
                                  label: "View Dish",
                                  icon: <ExternalLink className="h-3.5 w-3.5" />,
                                  onSelect: () => openDishPublicUrl(dish),
                                },
                                {
                                  key: "copy-dish-link",
                                  label: "Copy Link",
                                  icon: <Copy className="h-3.5 w-3.5" />,
                                  onSelect: () => void copyDishPublicUrl(dish),
                                },
                                {
                                  key: "dish-qr",
                                  label: "Show QR",
                                  icon: <QrCode className="h-3.5 w-3.5" />,
                                  onSelect: () => openDishQr(dish),
                                },
                                {
                                  key: "toggle",
                                  label: dish.available ? "Mark unavailable" : "Mark available",
                                  onSelect: () => void onToggleAvailability(dish),
                                },
                                ...(canManageStock
                                  ? [
                                      {
                                        key: "stock-low",
                                        label: "Set low stock",
                                        onSelect: () => void saveDishStock(dish, { availability_status: "low_stock" }),
                                      },
                                      {
                                        key: "stock-unavailable",
                                        label: "Set unavailable",
                                        onSelect: () => void saveDishStock(dish, { availability_status: "unavailable" }),
                                      },
                                      {
                                        key: "stock-available",
                                        label: "Restore available",
                                        onSelect: () => void saveDishStock(dish, { availability_status: "available" }),
                                      },
                                      {
                                        key: "stock-hide",
                                        label: dish.stock?.hidden_from_public_menu
                                          ? "Show on public menu"
                                          : "Hide from public menu",
                                        onSelect: () => void toggleHiddenFromPublic(dish),
                                      },
                                    ]
                                  : []),
                                {
                                  key: "delete",
                                  label: "Delete",
                                  icon: <Trash2 className="h-3.5 w-3.5" />,
                                  onSelect: () => void removeDish(dish.id),
                                  destructive: true,
                                },
                              ]}
                            />
                          }
                          footer={
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="gap-1.5"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openDishQr(dish);
                                  }}
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                Show QR
                                </Button>
                              <span className="text-xs text-white/50">KSh</span>
                              <Input
                                id={`dish-price-mobile-${dish.id}`}
                                name={`dishPriceMobile${dish.id}`}
                                value={priceDraft}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  setPriceDrafts((current) => ({ ...current, [dish.id]: event.target.value }))
                                }
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label={`Update price for ${dish.name}`}
                                className={cn("h-10 w-32 text-right", tokens.classes.inputLight)}
                              />
                              <Button
                                size="sm"
                                variant={canSavePrice ? "secondary" : "ghost"}
                                className={cn("gap-1", canSavePrice && "border-primary/35 bg-primary/14 text-text-primary")}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onSavePrice(dish);
                                }}
                                disabled={!canSavePrice}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Save
                              </Button>
                              <div className="ml-auto text-xs text-white/55">{formatKsh(dish.price)} current</div>
                            </div>
                          }
                        />
                      );
                    })}
                  </div>

                  <DataTable className={cn(tokens.classes.tableShell, "hidden lg:block")}>
                  <table className="min-w-full text-sm">
                    <thead className={tokens.classes.tableHeader}>
                      <tr>
                        <th className="px-4 py-2.5">Dish</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Price</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDishes.map((dish) => {
                        const priceDraft = priceDrafts[dish.id] ?? String(dish.price);
                        const parsedPrice = Number(priceDraft);
                        const priceChanged = parsedPrice !== dish.price;
                        const canSavePrice = Number.isFinite(parsedPrice) && parsedPrice > 0 && priceChanged && !saving;

                        return (
                          <tr
                            key={dish.id}
                            onClick={() => populateDishForm(dish)}
                            className={cn(
                              tokens.classes.tableRow,
                              editingDishId === dish.id && tokens.classes.activeRow
                            )}
                          >
                            <td className="px-4 py-2.5">
                              <div className={cn("flex min-w-[280px] items-start", spacing.gapMd)}>
                                <ImageThumbnail src={dish.imageUrl} name={dish.name} />
                                <div className="min-w-0">
                                  <div className="font-semibold tracking-[-0.01em] text-text-primary">{dish.name}</div>
                                  <p className={cn("mt-1 line-clamp-2 text-text-secondary/74", typography.mutedBody)}>{dish.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn("inline-flex", tokens.classes.inlineChip)}>
                                {categoryNameById.get(dish.categoryId) || "Unknown"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className={cn("flex min-w-[190px] items-center", spacing.gapSm)}>
                                <span className="text-xs text-white/45">KSh</span>
                                <Input
                                  id={`dish-price-${dish.id}`}
                                  name={`dishPrice${dish.id}`}
                                  value={priceDraft}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) =>
                                    setPriceDrafts((current) => ({ ...current, [dish.id]: event.target.value }))
                                  }
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  aria-label={`Update price for ${dish.name}`}
                                  className={cn("h-9 w-28 text-right", tokens.classes.inputLight)}
                                />
                                <Button
                                  size="sm"
                                  variant={canSavePrice ? "secondary" : "ghost"}
                                  className={cn("gap-1", canSavePrice && "border-primary/35 bg-primary/14 text-text-primary")}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void onSavePrice(dish);
                                  }}
                                  disabled={!canSavePrice}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Save
                                </Button>
                              </div>
                              <div className="mt-1 text-[11px] text-white/58">{formatKsh(dish.price)} current</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col gap-1">
                                <Badge variant={getStockTone(dish.stock?.availability_status)}>{getStockLabel(dish)}</Badge>
                                {dish.stock?.stock_quantity != null ? (
                                  <span className="text-[11px] text-white/55">Qty: {dish.stock.stock_quantity}</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="gap-1.5 border-white/18 bg-white/[0.04] hover:border-white/26"
                                  onClick={() => openDishQr(dish)}
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                  QR
                                </Button>
                                <UbhonaActionMenu
                                  items={[
                                    {
                                      key: "edit",
                                      label: "Edit details",
                                      icon: <Pencil className="h-3.5 w-3.5" />,
                                      onSelect: () => populateDishForm(dish),
                                    },
                                    {
                                      key: "duplicate",
                                      label: "Duplicate",
                                      icon: <Copy className="h-3.5 w-3.5" />,
                                      onSelect: () => void onDuplicateDish(dish.id),
                                    },
                                    {
                                      key: "view-dish",
                                      label: "View Dish",
                                      icon: <ExternalLink className="h-3.5 w-3.5" />,
                                      onSelect: () => openDishPublicUrl(dish),
                                    },
                                    {
                                      key: "copy-dish-link",
                                      label: "Copy Link",
                                      icon: <Copy className="h-3.5 w-3.5" />,
                                      onSelect: () => void copyDishPublicUrl(dish),
                                    },
                                    {
                                      key: "dish-qr",
                                      label: "Show QR",
                                      icon: <QrCode className="h-3.5 w-3.5" />,
                                      onSelect: () => openDishQr(dish),
                                    },
                                    {
                                      key: "toggle",
                                      label: dish.available ? "Mark unavailable" : "Mark available",
                                      onSelect: () => void onToggleAvailability(dish),
                                    },
                                    ...(canManageStock
                                      ? [
                                          {
                                            key: "stock-low",
                                            label: "Set low stock",
                                            onSelect: () => void saveDishStock(dish, { availability_status: "low_stock" }),
                                          },
                                          {
                                            key: "stock-unavailable",
                                            label: "Set unavailable",
                                            onSelect: () => void saveDishStock(dish, { availability_status: "unavailable" }),
                                          },
                                          {
                                            key: "stock-available",
                                            label: "Restore available",
                                            onSelect: () => void saveDishStock(dish, { availability_status: "available" }),
                                          },
                                          {
                                            key: "stock-hide",
                                            label: dish.stock?.hidden_from_public_menu
                                              ? "Show on public menu"
                                              : "Hide from public menu",
                                            onSelect: () => void toggleHiddenFromPublic(dish),
                                          },
                                        ]
                                      : []),
                                    {
                                      key: "delete",
                                      label: "Delete",
                                      icon: <Trash2 className="h-3.5 w-3.5" />,
                                      onSelect: () => void removeDish(dish.id),
                                      destructive: true,
                                    },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </DataTable>
                </>
              ) : null}
              {!loading && !error && !filteredDishes.length ? (
                <EmptyStateCard
                  message="No dishes match the current filters. Adjust the controls or add a new dish."
                  actionLabel="Add dish"
                  onAction={onCreateDishFromHeader}
                />
              ) : null}
              {saving ? <p className="text-xs text-white/55">Saving menu changes...</p> : null}
            </DashboardPanel>
          </div>

          <div ref={workspaceRef} className="order-1 xl:order-2 xl:sticky xl:top-24 xl:h-fit">
            {activeDish ? (
              <DashboardPanel className={cn("mb-4 p-4", spacing.stackSm)}>
                <SectionHeader
                  title="Branch Stock"
                  subtitle={`Branch: ${branchId}. Control visibility and service availability for this location.`}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="dish-stock-qty" className={cn("mb-1.5 block", typography.label)}>
                      Stock Quantity
                    </label>
                    <Input
                      id="dish-stock-qty"
                      name="dishStockQty"
                      type="number"
                      min="0"
                      value={stockQtyDraft}
                      onChange={(event) => setStockQtyDraft(event.target.value)}
                      placeholder="Leave empty for manual status"
                      disabled={!canManageStock}
                      className={tokens.classes.inputLight}
                    />
                  </div>
                  <div>
                    <label htmlFor="dish-stock-threshold" className={cn("mb-1.5 block", typography.label)}>
                      Low Stock Threshold
                    </label>
                    <Input
                      id="dish-stock-threshold"
                      name="dishStockThreshold"
                      type="number"
                      min="0"
                      value={stockThresholdDraft}
                      onChange={(event) => setStockThresholdDraft(event.target.value)}
                      disabled={!canManageStock}
                      className={tokens.classes.inputLight}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getStockTone(activeDish.stock?.availability_status)}>{getStockLabel(activeDish)}</Badge>
                  {activeDish.stock?.hidden_from_public_menu ? (
                    <Badge variant="neutral">Hidden on Public Menu</Badge>
                  ) : (
                    <Badge variant="neutral">Visible on Public Menu</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void saveDishStock(activeDish)}
                    disabled={!canManageStock}
                  >
                    Save Stock
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void saveDishStock(activeDish, { availability_status: "available" })}
                    disabled={!canManageStock}
                  >
                    Mark Available
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void saveDishStock(activeDish, { availability_status: "unavailable" })}
                    disabled={!canManageStock}
                  >
                    Mark Unavailable
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleHiddenFromPublic(activeDish)}
                    disabled={!canManageStock}
                  >
                    {activeDish.stock?.hidden_from_public_menu ? "Show on Menu" : "Hide from Menu"}
                  </Button>
                </div>
                {!canManageStock ? (
                  <p className="text-xs text-white/60">
                    Your role can view stock state but cannot edit branch stock controls.
                  </p>
                ) : null}
              </DashboardPanel>
            ) : null}
            <DishWorkspacePanel
              restaurantId={profile?.id}
              editingDishId={editingDishId}
              activeDish={activeDish}
              dishForm={dishForm}
              categories={categoryCounts}
              isCategoryManagerOpen={isCategoryManagerOpen}
              newCategoryName={newCategoryName}
              editingCategoryId={editingCategoryId}
              editingCategoryName={editingCategoryName}
              onDishFormChange={(patch) => setDishForm((current) => ({ ...current, ...patch }))}
              onSubmitDish={onSubmitDish}
              onResetDish={() => resetDishForm()}
              onCreateNewDish={() => resetDishForm()}
              onOpenDishQr={() => {
                if (!activeDish) return;
                openDishQr(activeDish);
              }}
              onToggleCategoryManager={() => setIsCategoryManagerOpen((current) => !current)}
              onNewCategoryNameChange={setNewCategoryName}
              onAddCategory={onAddCategory}
              onStartCategoryEdit={(id, name) => {
                setEditingCategoryId(id);
                setEditingCategoryName(name);
              }}
              onEditingCategoryNameChange={setEditingCategoryName}
              onSaveCategoryEdit={() => void onSaveCategoryEdit()}
              onCancelCategoryEdit={() => {
                setEditingCategoryId(null);
                setEditingCategoryName("");
              }}
              onRemoveCategory={(id) => void removeCategory(id)}
            />
          </div>
        </div>
        <QrCodeDialog
          open={Boolean(qrDialog)}
          title={qrDialog?.title || "QR"}
          description={qrDialog?.description || ""}
          linkLabel={qrDialog?.linkLabel || "Link"}
          printTitle={qrDialog?.printTitle || "Ubhona QR"}
          url={qrDialog?.url || ""}
          onClose={() => setQrDialog(null)}
        />
      </PageContainer>
    </DashboardLayout>
  );
}
