import * as React from "react";
import { ArrowLeft, Eye, Lock, PencilLine, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  addMenuCategory,
  loadCustomProducts,
  loadMenuCategories,
  removeMenuCategory,
  fetchDishes,
  saveCustomProducts,
  saveMenuCategories,
  upsertCustomProduct,
  type Dish,
} from "../lib/dishes";
import { deleteLocalAsset, isLocalAssetPath, saveLocalAsset } from "../lib/localAssets";
import {
  getEffectivePrice,
  loadOverrides,
  saveOverrides,
  type PriceOverrides,
} from "../lib/price-overrides";
import {
  getRecentOrders,
  ORDER_STATUS_OPTIONS,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from "../lib/orders";
import { getViews, resetViews } from "../lib/views";
import {
  canUseFeature,
  getCurrentPlan,
  getBrandingTheme,
  getRestaurantProfile,
  syncRestaurantProfile,
  type RestaurantProfile,
} from "../lib/restaurant";
import { isCurrentUserAdmin } from "../lib/admin";
const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.png`;
const EMPTY_PRODUCT = {
  id: "",
  cat: "",
  name: "",
  price: "",
  desc: "",
  model: "",
  thumb: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [dishes, setDishes] = React.useState<Dish[]>([]);
  const [restaurantProfile, setRestaurantProfile] = React.useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [overrides, setOverrides] = React.useState<PriceOverrides>({});
  const [overrideDrafts, setOverrideDrafts] = React.useState<Record<string, string>>({});
  const [customIds, setCustomIds] = React.useState<Set<string>>(new Set());
  const [viewsVersion, setViewsVersion] = React.useState(0);
  const [adminNotice, setAdminNotice] = React.useState("");
  const [recentOrders, setRecentOrders] = React.useState<Order[]>([]);
  const [newProduct, setNewProduct] = React.useState(EMPTY_PRODUCT);
  const [formError, setFormError] = React.useState("");
  const [formSuccess, setFormSuccess] = React.useState("");
  const [showNewProductForm, setShowNewProductForm] = React.useState(false);
  const [editingDishId, setEditingDishId] = React.useState<string | null>(null);
  const [menuCategories, setMenuCategories] = React.useState<string[]>([]);
  const [newCategory, setNewCategory] = React.useState("");
  const [thumbFile, setThumbFile] = React.useState<File | null>(null);
  const [modelFile, setModelFile] = React.useState<File | null>(null);
  const [uploadKey, setUploadKey] = React.useState(0);
  const brandingTheme = React.useMemo(() => getBrandingTheme(), [restaurantProfile]);
  const currentPlan = React.useMemo(() => getCurrentPlan(restaurantProfile), [restaurantProfile]);
  const analyticsEnabled = React.useMemo(
    () => canUseFeature("analytics", restaurantProfile),
    [restaurantProfile]
  );
  const adminAccess = React.useMemo(() => isCurrentUserAdmin(), []);

  const refreshCatalog = React.useCallback(() => {
    setLoading(true);
    return fetchDishes()
      .then((data) => {
        setDishes(data);
        const ids = new Set(loadCustomProducts().map((item) => item.id));
        setCustomIds(ids);
        const categorySeed = [
          ...loadMenuCategories(),
          ...data.map((item) => item.cat).filter((cat) => cat.trim()),
        ];
        const uniqueCategories = Array.from(new Set(categorySeed));
        setMenuCategories(uniqueCategories);
        saveMenuCategories(uniqueCategories);
        setError("");
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || "Failed to load dashboard");
        setLoading(false);
      });
  }, []);

  const refreshAdminState = React.useCallback(async () => {
    const remoteProfile = await syncRestaurantProfile();
    setRestaurantProfile(remoteProfile || getRestaurantProfile());
    setOverrides(loadOverrides());
    setRecentOrders(await getRecentOrders(5));
    setViewsVersion((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    void refreshAdminState();
    void refreshCatalog();
  }, [refreshCatalog, refreshAdminState]);

  React.useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const dish of dishes) {
      nextDrafts[dish.id] =
        overrides[dish.id] != null && Number.isFinite(Number(overrides[dish.id]))
          ? String(overrides[dish.id])
          : "";
    }
    setOverrideDrafts(nextDrafts);
  }, [dishes, overrides]);

  React.useEffect(() => {
    const syncAdmin = () => void refreshAdminState();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncAdmin();
    };
    window.addEventListener("focus", syncAdmin);
    window.addEventListener("pageshow", syncAdmin);
    window.addEventListener("storage", syncAdmin);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", syncAdmin);
      window.removeEventListener("pageshow", syncAdmin);
      window.removeEventListener("storage", syncAdmin);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshAdminState]);

  const totalViews = React.useMemo(
    () => dishes.reduce((sum, dish) => sum + getViews(dish.id), 0),
    [dishes, viewsVersion]
  );

  const topDish = React.useMemo(() => {
    if (!dishes.length) return null;
    return [...dishes].sort((a, b) => getViews(b.id) - getViews(a.id))[0];
  }, [dishes, viewsVersion]);

  const effectivePrice = (dish: Dish) => getEffectivePrice(dish, overrides);

  const updatePriceDraft = (id: string, value: string) => {
    setOverrideDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const persistPrices = () => {
    const next: PriceOverrides = {};
    for (const dish of dishes) {
      const raw = (overrideDrafts[dish.id] || "").trim();
      if (!raw) continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setAdminNotice(`Invalid override price for "${dish.name}". Use a number above 0.`);
        return;
      }
      next[dish.id] = parsed;
    }
    saveOverrides(next);
    setOverrides(next);
    setAdminNotice("Price overrides saved.");
  };

  const handleResetViews = () => {
    resetViews(dishes.map((dish) => dish.id));
    setViewsVersion((prev) => prev + 1);
    setAdminNotice("Views reset.");
  };

  const handleNewProductChange =
    (field: keyof typeof EMPTY_PRODUCT) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setNewProduct((prev) => {
        const next = { ...prev, [field]: value };
        if (field === "name" && !prev.id.trim()) {
          next.id = slugify(value);
        }
        return next;
      });
    };

  const addNewProduct = async () => {
    setFormError("");
    setFormSuccess("");
    const isEditing = !!editingDishId;
    const canonicalId = slugify(newProduct.id || newProduct.name);
    if (!canonicalId) {
      setFormError("Product name or ID is required.");
      return;
    }
    let resolvedThumb = newProduct.thumb.trim();
    let resolvedModel = newProduct.model.trim();
    try {
      resolvedThumb = thumbFile
        ? await saveLocalAsset(thumbFile, "thumb", canonicalId)
        : newProduct.thumb.trim();
      resolvedModel = modelFile
        ? await saveLocalAsset(modelFile, "model", canonicalId)
        : newProduct.model.trim();
    } catch {
      setFormError("Failed to save uploaded files. Try again.");
      return;
    }

    const nextProduct: Dish = {
      id: canonicalId,
      cat: newProduct.cat.trim(),
      name: newProduct.name.trim(),
      price: Number(newProduct.price),
      desc: newProduct.desc.trim(),
      model: resolvedModel,
      thumb: resolvedThumb,
    };

    if (
      !nextProduct.id ||
      !nextProduct.cat ||
      !nextProduct.name ||
      !nextProduct.desc ||
      !nextProduct.model ||
      !nextProduct.thumb ||
      !Number.isFinite(nextProduct.price) ||
      nextProduct.price <= 0
    ) {
      setFormError("Fill all fields with valid values before adding a product.");
      return;
    }

    if (
      !nextProduct.model.toLowerCase().endsWith(".glb") &&
      !isLocalAssetPath(nextProduct.model)
    ) {
      setFormError("Model URL/path must end with .glb, or upload a .glb file.");
      return;
    }

    if (!isEditing && dishes.some((dish) => dish.id === nextProduct.id)) {
      setFormError("A product with this ID already exists.");
      return;
    }

    upsertCustomProduct(nextProduct);
    if (!menuCategories.some((cat) => cat.toLowerCase() === nextProduct.cat.toLowerCase())) {
      const nextCategories = addMenuCategory(nextProduct.cat);
      setMenuCategories(nextCategories);
    }

    setNewProduct(EMPTY_PRODUCT);
    setEditingDishId(null);
    setThumbFile(null);
    setModelFile(null);
    setUploadKey((prev) => prev + 1);
    setFormSuccess(
      isEditing
        ? `Updated "${nextProduct.name}" in your local catalog.`
        : `Added "${nextProduct.name}" to your local catalog.`
    );
    void refreshCatalog();
  };

  const removeCustomProduct = async (id: string) => {
    try {
      const existing = loadCustomProducts().find((item) => item.id === id);
      if (existing) {
        await deleteLocalAsset(existing.thumb);
        await deleteLocalAsset(existing.model);
      }
      const custom = loadCustomProducts().filter((item) => item.id !== id);
      saveCustomProducts(custom);
      setAdminNotice("Custom product deleted.");
      void refreshCatalog();
    } catch {
      setAdminNotice("Delete failed. Try again.");
    }
  };

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    const next = addMenuCategory(value);
    setMenuCategories(next);
    setNewCategory("");
    setAdminNotice(`Category "${value}" added.`);
  };

  const deleteCategory = (category: string) => {
    const isUsed = dishes.some((dish) => dish.cat.toLowerCase() === category.toLowerCase());
    if (isUsed) {
      setAdminNotice(`Cannot remove "${category}" while dishes still use it.`);
      return;
    }
    const next = removeMenuCategory(category);
    setMenuCategories(next);
    setAdminNotice(`Category "${category}" removed.`);
  };

  const startEditDish = (dish: Dish) => {
    setShowNewProductForm(true);
    setEditingDishId(dish.id);
    setFormError("");
    setFormSuccess("");
    setThumbFile(null);
    setModelFile(null);
    setUploadKey((prev) => prev + 1);
    setNewProduct({
      id: dish.id,
      cat: dish.cat,
      name: dish.name,
      price: String(dish.price),
      desc: dish.desc,
      model: dish.model,
      thumb: dish.thumb,
    });
  };

  const setOrderStatus = (orderId: string, status: OrderStatus) => {
    void updateOrderStatus(orderId, status).then(async () => {
      setRecentOrders(await getRecentOrders(5));
      setAdminNotice(`Order ${orderId} marked as ${status}.`);
    });
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_SRC} alt="Ubhona" className="h-12 w-12 rounded-2xl object-cover" />
            <div>
              <div className="text-2xl font-black">
                <span className="text-orange-400">Ubhona</span> Dashboard
              </div>
              <p className="mt-1 text-sm text-white/60">Manage menu items, prices, and views.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.08]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Menu
            </button>

            <button
              onClick={persistPrices}
              className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400"
            >
              Save Price Overrides
            </button>

            <button
              onClick={handleResetViews}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-300"
            >
              Reset Views
            </button>

            <button
              onClick={() => setShowNewProductForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.08]"
            >
              <PlusCircle className="h-4 w-4" />
              Menu Builder
            </button>

            <button
              onClick={() => navigate("/app/menu")}
              className="rounded-2xl border border-emerald-400/35 bg-emerald-500/20 px-4 py-3 text-sm font-bold text-emerald-200 hover:bg-emerald-500/30"
            >
              Manage Menu
            </button>
            <button
              onClick={() => navigate("/app/orders")}
              className="rounded-2xl border border-orange-400/35 bg-orange-500/20 px-4 py-3 text-sm font-bold text-orange-200 hover:bg-orange-500/30"
            >
              Manage Orders
            </button>
            <button
              onClick={() => navigate(analyticsEnabled ? "/app/analytics" : "/pricing")}
              className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                analyticsEnabled
                  ? "border border-cyan-400/35 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
                  : "border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"
              }`}
            >
              {analyticsEnabled ? "Analytics" : "Unlock Analytics"}
            </button>
            <button
              onClick={() => navigate("/pricing")}
              className="rounded-2xl border border-orange-400/35 bg-orange-500/20 px-4 py-3 text-sm font-bold text-orange-200 hover:bg-orange-500/30"
            >
              Pricing
            </button>
            {adminAccess ? (
              <button
                onClick={() => navigate("/admin")}
                className="rounded-2xl border border-emerald-400/35 bg-emerald-500/20 px-4 py-3 text-sm font-bold text-emerald-200 hover:bg-emerald-500/30"
              >
                Admin Panel
              </button>
            ) : null}
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {restaurantProfile ? (
            <div className="md:col-span-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">
                Restaurant Profile
              </div>
              <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-2 text-xs text-white/50">Branding Preview</div>
                  <div
                    className="overflow-hidden rounded-2xl border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${brandingTheme.primary}33, ${brandingTheme.secondary}33)`,
                    }}
                  >
                    <div className="flex items-center gap-3 bg-black/35 p-3 backdrop-blur">
                      <img
                        src={restaurantProfile.logo || LOGO_SRC}
                        alt={restaurantProfile.restaurantName}
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                      <div>
                        <div className="font-bold text-white">{restaurantProfile.restaurantName}</div>
                        <div className="text-xs text-white/70">@{restaurantProfile.slug}</div>
                      </div>
                    </div>
                    <div className="p-3 text-sm text-white/75">
                      {restaurantProfile.shortDescription || "Add a short description in onboarding to customize your public storefront."}
                    </div>
                    <div className="flex items-center gap-2 px-3 pb-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brandingTheme.primary }} />
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brandingTheme.secondary }} />
                    </div>
                  </div>
                </div>
                {restaurantProfile.coverImage ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
                    <img
                      src={restaurantProfile.coverImage}
                      alt={`${restaurantProfile.restaurantName} cover`}
                      className="h-44 w-full rounded-xl object-cover"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/55">
                    No cover image set yet.
                  </div>
                )}
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[11px] text-white/55">Name</div>
                  <div className="mt-1 font-bold text-orange-300">{restaurantProfile.restaurantName}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[11px] text-white/55">Slug</div>
                  <div className="mt-1 font-mono text-white/85">{restaurantProfile.slug}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[11px] text-white/55">Email</div>
                  <div className="mt-1 text-white/85">{restaurantProfile.email}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[11px] text-white/55">Phone</div>
                  <div className="mt-1 text-white/85">{restaurantProfile.phone}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="text-[11px] text-white/55">Location</div>
                  <div className="mt-1 text-white/85">{restaurantProfile.location}</div>
                </div>
                <div className="rounded-2xl border border-orange-400/25 bg-orange-500/10 p-3">
                  <div className="text-[11px] text-white/55">Plan</div>
                  <div className="mt-1 font-bold text-orange-300">{currentPlan.label}</div>
                  <div className="text-[11px] text-white/60">Status: {currentPlan.status}</div>
                  {currentPlan.trialEndsAt ? (
                    <div className="text-[11px] text-white/60">
                      Trial ends: {new Date(currentPlan.trialEndsAt).toLocaleDateString("en-KE")}
                    </div>
                  ) : null}
                  {currentPlan.renewalDate ? (
                    <div className="text-[11px] text-white/60">
                      Renewal: {new Date(currentPlan.renewalDate).toLocaleDateString("en-KE")}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm text-white/55">Total dishes</div>
            <div className="mt-2 text-3xl font-black text-orange-400">{dishes.length}</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm text-white/55">Total views</div>
            <div className="mt-2 text-3xl font-black text-orange-400">{totalViews}</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm text-white/55">Top dish</div>
            <div className="mt-2 text-xl font-black text-orange-400">
              {topDish ? topDish.name : "-"}
            </div>
            <div className="mt-1 text-sm text-white/55">
              {topDish ? `${getViews(topDish.id)} views` : ""}
            </div>
          </div>
        </div>

        {adminNotice && (
          <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {adminNotice}
          </div>
        )}

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">
            Categories Builder
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="New category name"
              className="w-full max-w-xs rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={addCategory}
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-300"
            >
              Add Category
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {menuCategories.length ? (
              menuCategories.map((category) => (
                <div
                  key={category}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/85"
                >
                  <span>{category}</span>
                  <button
                    onClick={() => deleteCategory(category)}
                    className="rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] hover:bg-white/10"
                  >
                    x
                  </button>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/55">No categories added yet.</div>
            )}
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">
            Recent Orders
          </div>
          {recentOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/55">
              No orders yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs text-white/80">{order.id}</div>
                      <div className="text-[11px] text-white/50">
                        {new Date(order.createdAt).toLocaleString("en-KE")}
                      </div>
                    </div>
                    <div className="text-white/70">{order.items.length} item{order.items.length === 1 ? "" : "s"}</div>
                    <div className="font-bold text-orange-300">{formatKsh(order.total)}</div>
                    <div className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                      {order.status}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
                    {ORDER_STATUS_OPTIONS.map((status) => {
                      const active = order.status === status;
                      return (
                        <button
                          key={`${order.id}-${status}`}
                          onClick={() => setOrderStatus(order.id, status)}
                          className={`rounded-xl border px-2 py-1 text-[11px] font-semibold transition ${
                            active
                              ? "border-emerald-400/35 bg-emerald-500/20 text-emerald-200"
                              : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!analyticsEnabled ? (
          <div className="mb-8 rounded-3xl border border-amber-400/25 bg-amber-500/10 p-5">
            <div className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-200">
              <Lock className="h-4 w-4" />
              Pro Feature
            </div>
            <p className="text-sm text-white/75">
              Advanced analytics is available on Pro and Enterprise plans. Upgrade to unlock
              conversion, top dishes, and AR engagement insights.
            </p>
            <button
              onClick={() => navigate("/pricing")}
              className="mt-3 rounded-2xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400"
            >
              Compare Plans
            </button>
          </div>
        ) : null}

        {showNewProductForm && (
          <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex items-center gap-2 text-xl font-black">
              <PlusCircle className="h-5 w-5 text-emerald-300" />
              {editingDishId ? "Edit Dish" : "New Dish Details"}
            </div>
            <p className="mb-4 text-sm text-white/60">
              Build your restaurant menu from dashboard with category, pricing, thumbnail, and
              AR model path.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={newProduct.name}
                onChange={handleNewProductChange("name")}
                placeholder="Product name"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
              <input
                value={newProduct.id}
                onChange={handleNewProductChange("id")}
                placeholder="Unique ID (slug)"
                disabled={!!editingDishId}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <input
                list="menu-builder-categories"
                value={newProduct.cat}
                onChange={handleNewProductChange("cat")}
                placeholder="Category (e.g. Mains)"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
              <datalist id="menu-builder-categories">
                {menuCategories.map((category) => (
                  <option key={`category-${category}`} value={category} />
                ))}
              </datalist>
              <input
                type="number"
                min={1}
                value={newProduct.price}
                onChange={handleNewProductChange("price")}
                placeholder="Price (KSh)"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
              <input
                value={newProduct.thumb}
                onChange={handleNewProductChange("thumb")}
                placeholder="Thumbnail URL/path (optional when uploading)"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2"
              />
              <input
                key={`thumb-upload-${uploadKey}`}
                type="file"
                accept="image/*"
                onChange={(event) => setThumbFile(event.target.files?.[0] || null)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-3 file:py-1 file:text-xs file:font-bold file:text-black"
              />
              <input
                value={newProduct.model}
                onChange={handleNewProductChange("model")}
                placeholder="GLB URL/path (optional when uploading)"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2"
              />
              <input
                key={`model-upload-${uploadKey}`}
                type="file"
                accept=".glb,model/gltf-binary"
                onChange={(event) => setModelFile(event.target.files?.[0] || null)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-1 file:text-xs file:font-bold file:text-black"
              />
              <textarea
                value={newProduct.desc}
                onChange={handleNewProductChange("desc")}
                placeholder="Description"
                rows={3}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2"
              />
            </div>

            <p className="mt-3 text-xs text-white/55">
              You can either paste hosted paths or upload files directly. Uploaded assets are
              saved locally in this browser (IndexedDB).
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={addNewProduct}
                className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-300"
              >
                {editingDishId ? "Save Dish" : "Add Dish"}
              </button>
              {editingDishId && (
                <button
                  onClick={() => {
                    setEditingDishId(null);
                    setNewProduct(EMPTY_PRODUCT);
                    setThumbFile(null);
                    setModelFile(null);
                    setUploadKey((prev) => prev + 1);
                    setFormError("");
                    setFormSuccess("");
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.08]"
                >
                  Cancel Edit
                </button>
              )}
              {formError && <div className="text-sm text-red-300">{formError}</div>}
              {formSuccess && <div className="text-sm text-emerald-300">{formSuccess}</div>}
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/60">
            Loading dashboard...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/[0.04]">
                  <tr className="text-left text-sm text-white/60">
                    <th className="px-4 py-4">Dish</th>
                    <th className="px-4 py-4">Category</th>
                    <th className="px-4 py-4">Base Price</th>
                    <th className="px-4 py-4">Override</th>
                    <th className="px-4 py-4">Views</th>
                    <th className="px-4 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dishes.map((dish) => (
                    <tr key={dish.id} className="border-t border-white/10">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={dish.thumb}
                            alt={dish.name}
                            className="h-12 w-12 rounded-2xl object-cover"
                            onError={(event) => {
                              const img = event.currentTarget;
                              if (img.dataset.fallbackApplied === "1") return;
                              img.dataset.fallbackApplied = "1";
                              img.src = LOGO_SRC;
                            }}
                          />
                          <div>
                            <div className="font-bold">
                              {dish.name}
                              {customIds.has(dish.id) && (
                                <span className="ml-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  custom
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-white/45">{dish.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/70">{dish.cat}</td>
                      <td className="px-4 py-4 text-orange-400">{formatKsh(dish.price)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <PencilLine className="h-4 w-4 text-white/45" />
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={overrideDrafts[dish.id] ?? ""}
                            onChange={(e) => updatePriceDraft(dish.id, e.target.value)}
                            placeholder={String(effectivePrice(dish))}
                            className="w-28 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-2 text-white/70">
                          <Eye className="h-4 w-4" />
                          {getViews(dish.id)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEditDish(dish)}
                            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.08]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => navigate(`/ar?dish=${encodeURIComponent(dish.id)}`)}
                            disabled={!dish.model.trim()}
                            className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Open AR
                          </button>
                          {!dish.model.trim() && <div className="text-xs text-red-200">Missing model</div>}
                          {customIds.has(dish.id) && (
                            <button
                              onClick={() => removeCustomProduct(dish.id)}
                              className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


