import * as React from "react";
import { Check, Copy, ImageOff, Pencil, PlusCircle, Search, Trash2 } from "lucide-react";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  DataTable,
  DashboardPanel,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
  StatusBadge,
} from "../components/dashboard/dashboard-primitives";
import { DishWorkspacePanel, type DishFormState } from "../components/menu/DishWorkspacePanel";
import { Button } from "../components/ui/Button";
import { ImageThumbnail } from "../components/ui/ImageThumbnail";
import { Input } from "../components/ui/Input";
import { UbhonaActionMenu } from "../components/ui/ubhona-action-menu";
import { UbhonaSelect, UbhonaSelectItem } from "../components/ui/ubhona-select";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import { useRestaurantMenuBuilder } from "../hooks/use-restaurant-menu-builder";
import { getFilteredDishes, normalizeDishInput, sortCategories } from "../lib/menu-builder";
import { cn } from "../lib/utils";
import { radius, spacing, tokens, typography } from "../design-system";
import type { RestaurantProfile } from "../lib/restaurant";
import type { Dish } from "../types/dashboard";

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
  } = useRestaurantMenuBuilder();

  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = React.useState("");
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = React.useState(false);
  const [dishForm, setDishForm] = React.useState<DishFormState>(EMPTY_DISH_FORM);
  const [editingDishId, setEditingDishId] = React.useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = React.useState<Record<string, string>>({});
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
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
  }, [data]);

  const sortedCategories = React.useMemo(() => sortCategories(categories), [categories]);
  const categoryNameById = React.useMemo(
    () => new Map(sortedCategories.map((category) => [category.id, category.name])),
    [sortedCategories]
  );
  const filteredDishes = React.useMemo(
    () => getFilteredDishes(dishes, search, categoryFilter),
    [categoryFilter, dishes, search]
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
      if (editingDishId) {
        await editDish(editingDishId, payload);
      } else {
        await createDish(payload);
      }
      resetDishForm(payload.categoryId || sortedCategories[0]?.id || "");
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

  const onCreateDishFromHeader = React.useCallback(() => {
    resetDishForm();
    setIsCategoryManagerOpen((current) => current || !sortedCategories.length);
    scrollToWorkspace();
  }, [resetDishForm, scrollToWorkspace, sortedCategories.length]);

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
        <Button variant="primary" size="sm" className="gap-2" onClick={onCreateDishFromHeader}>
          <PlusCircle className="h-4 w-4" />
          Add Dish
        </Button>
      }
    >
      <PageContainer className={spacing.stackLg}>
        <DashboardPanel className={spacing.stackLg}>
          <SectionHeader
            title="Menu Controls"
            subtitle="One search and one category filter for the full menu workspace."
            action={
              <div className={cn(tokens.classes.metricChip, "py-1")}>
                {resultsSummary}
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

        <div className={cn("grid xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,420px)]", spacing.gapLg)}>
          <div className={cn("order-2 xl:order-1", spacing.stackLg)}>
            <DashboardPanel className={cn("overflow-hidden", spacing.stackLg)}>
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
                        <div
                          key={dish.id}
                          onClick={() => populateDishForm(dish)}
                          className={cn(
                            tokens.classes.panelInset,
                            "cursor-pointer space-y-3 p-3.5 transition",
                            editingDishId === dish.id && "border-primary/45 bg-primary/[0.09]"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <ImageThumbnail src={dish.imageUrl} name={dish.name} />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-text-primary">{dish.name}</div>
                              <p className={cn("mt-1", typography.mutedBody)}>{dish.description}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={cn("inline-flex", tokens.classes.inlineChip)}>
                                  {categoryNameById.get(dish.categoryId) || "Unknown"}
                                </span>
                                <StatusBadge status={dish.available ? "ready" : "offline"} />
                              </div>
                            </div>
                            <div onClick={(event) => event.stopPropagation()}>
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
                                    key: "toggle",
                                    label: dish.available ? "Mark unavailable" : "Mark available",
                                    onSelect: () => void onToggleAvailability(dish),
                                  },
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
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
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
                        </div>
                      );
                    })}
                  </div>

                  <DataTable className={cn(tokens.classes.tableShell, "hidden lg:block")}>
                  <table className="min-w-full text-sm">
                    <thead className={tokens.classes.tableHeader}>
                      <tr>
                        <th className="px-4 py-3">Dish</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
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
                            <td className="px-4 py-3.5">
                              <div className={cn("flex min-w-[280px] items-start", spacing.gapMd)}>
                                <ImageThumbnail src={dish.imageUrl} name={dish.name} />
                                <div className="min-w-0">
                                  <div className="font-semibold text-text-primary">{dish.name}</div>
                                  <p className={cn("mt-1", typography.mutedBody)}>{dish.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={cn("inline-flex", tokens.classes.inlineChip)}>
                                {categoryNameById.get(dish.categoryId) || "Unknown"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
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
                              <div className="mt-1 text-[11px] text-white/45">{formatKsh(dish.price)} current</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusBadge status={dish.available ? "ready" : "offline"} />
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
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
                                      key: "toggle",
                                      label: dish.available ? "Mark unavailable" : "Mark available",
                                      onSelect: () => void onToggleAvailability(dish),
                                    },
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
            <DishWorkspacePanel
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
      </PageContainer>
    </DashboardLayout>
  );
}
