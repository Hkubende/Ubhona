import * as React from "react";
import { ArrowLeft, PencilLine, PlusCircle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  addCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type RestaurantCategory,
} from "../lib/categories";
import {
  addRestaurantDish,
  deleteRestaurantDish,
  getRestaurantDishes,
  updateRestaurantDish,
  type RestaurantDish,
} from "../lib/restaurant-dishes";
import {
  getCurrentPlan,
  getDishLimit,
  syncRestaurantProfile,
  type RestaurantProfile,
} from "../lib/restaurant";
import UploadField from "../components/uploads/UploadField";

const EMPTY_DISH_FORM = {
  categoryId: "",
  name: "",
  desc: "",
  price: "",
  thumb: "",
  model: "",
  isAvailable: true,
};

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function MenuManager() {
  const navigate = useNavigate();
  const [categories, setCategories] = React.useState<RestaurantCategory[]>([]);
  const [dishes, setDishes] = React.useState<RestaurantDish[]>([]);
  const [newCategory, setNewCategory] = React.useState("");
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = React.useState("");
  const [dishForm, setDishForm] = React.useState(EMPTY_DISH_FORM);
  const [editingDishId, setEditingDishId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const [restaurantProfile, setRestaurantProfile] = React.useState<RestaurantProfile | null>(null);

  const refresh = React.useCallback(async () => {
    const [nextCategories, nextDishes] = await Promise.all([
      getCategories(),
      getRestaurantDishes(),
    ]);
    setCategories(nextCategories);
    setDishes(nextDishes);
  }, []);

  React.useEffect(() => {
    void refresh();
    void syncRestaurantProfile().then((profile) => setRestaurantProfile(profile || null));
  }, [refresh]);

  const currentPlan = React.useMemo(() => getCurrentPlan(restaurantProfile), [restaurantProfile]);
  const dishLimit = React.useMemo(() => getDishLimit(restaurantProfile), [restaurantProfile]);
  const dishLimitReached = dishLimit != null && dishes.length >= dishLimit && !editingDishId;

  const categoryNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const onAddCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    try {
      await addCategory({ name, sortOrder: categories.length });
      setNewCategory("");
      setNotice(`Category "${name}" added.`);
      setError("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    }
  };

  const onDeleteCategory = async (id: string) => {
    const hasLinkedDishes = dishes.some((dish) => dish.categoryId === id);
    if (hasLinkedDishes) {
      setError("Cannot delete category with linked dishes. Move or delete dishes first.");
      return;
    }
    try {
      await deleteCategory(id);
      setNotice("Category deleted.");
      setError("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category.");
    }
  };

  const onSaveCategory = async (id: string) => {
    const name = editingCategoryName.trim();
    if (!name) return;
    try {
      await updateCategory(id, { name });
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setNotice("Category updated.");
      setError("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category.");
    }
  };

  const resetDishForm = () => {
    setEditingDishId(null);
    setDishForm({
      ...EMPTY_DISH_FORM,
      categoryId: categories[0]?.id || "",
    });
  };

  const onSaveDish = async () => {
    setError("");
    if (dishLimitReached) {
      setError(`Your ${currentPlan.label} plan allows up to ${dishLimit} dishes. Upgrade to add more.`);
      return;
    }
    const parsedPrice = Number(dishForm.price);
    if (
      !dishForm.categoryId ||
      !dishForm.name.trim() ||
      !dishForm.desc.trim() ||
      !dishForm.thumb.trim() ||
      !dishForm.model.trim() ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0
    ) {
      setError("Fill all dish fields with valid values.");
      return;
    }
    const payload = {
      categoryId: dishForm.categoryId,
      name: dishForm.name.trim(),
      desc: dishForm.desc.trim(),
      price: parsedPrice,
      thumb: dishForm.thumb.trim(),
      model: dishForm.model.trim(),
      isAvailable: dishForm.isAvailable,
    };
    if (editingDishId) {
      try {
        await updateRestaurantDish(editingDishId, payload);
        setNotice("Dish updated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update dish.");
        return;
      }
    } else {
      try {
        await addRestaurantDish(payload);
        setNotice("Dish added.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add dish.");
        return;
      }
    }
    resetDishForm();
    await refresh();
  };

  const onEditDish = (dish: RestaurantDish) => {
    setEditingDishId(dish.id);
    setDishForm({
      categoryId: dish.categoryId,
      name: dish.name,
      desc: dish.desc,
      price: String(dish.price),
      thumb: dish.thumb,
      model: dish.model,
      isAvailable: dish.isAvailable,
    });
  };

  const onDeleteDish = async (id: string) => {
    try {
      await deleteRestaurantDish(id);
      setNotice("Dish deleted.");
      setError("");
      if (editingDishId === id) resetDishForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dish.");
    }
  };

  const onToggleDish = async (dish: RestaurantDish) => {
    try {
      await updateRestaurantDish(dish.id, { isAvailable: !dish.isAvailable });
      setNotice(`"${dish.name}" marked ${dish.isAvailable ? "unavailable" : "available"}.`);
      setError("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dish availability.");
    }
  };

  React.useEffect(() => {
    if (!dishForm.categoryId && categories.length) {
      setDishForm((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, dishForm.categoryId]);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
          <div>
            <div className="text-2xl font-black">
              <span className="text-orange-400">Ubhona</span>
              <span className="text-emerald-400"> Menu Manager</span>
            </div>
            <div className="mt-1 text-sm text-white/60">Manage restaurant categories and dishes.</div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>

        {notice ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          <div className="font-bold">
            Plan: {currentPlan.label}
            {dishLimit == null ? " (Unlimited dishes)" : ` (${dishes.length}/${dishLimit} dishes)`}
          </div>
          {dishLimitReached ? (
            <div className="mt-1 text-xs text-orange-200">
              Dish limit reached. Upgrade plan to continue adding new dishes.
            </div>
          ) : null}
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">Categories</div>
            <div className="mb-3 flex gap-2">
              <input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="Add category..."
                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={onAddCategory}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-bold text-black hover:bg-emerald-300"
              >
                <PlusCircle className="h-4 w-4" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {categories.length ? (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2"
                  >
                    {editingCategoryId === category.id ? (
                      <input
                        value={editingCategoryName}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                        className="flex-1 rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-sm outline-none"
                      />
                    ) : (
                      <div className="font-semibold text-white/90">{category.name}</div>
                    )}
                    <div className="flex items-center gap-2">
                      {editingCategoryId === category.id ? (
                        <button
                          onClick={() => onSaveCategory(category.id)}
                          className="rounded-xl bg-emerald-400 px-2.5 py-1 text-xs font-bold text-black"
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCategoryId(category.id);
                            setEditingCategoryName(category.name);
                          }}
                          className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-white"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteCategory(category.id)}
                        className="rounded-xl border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/55">
                  No categories yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">
              {editingDishId ? "Edit Dish" : "Add Dish"}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={dishForm.categoryId}
                onChange={(event) => setDishForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                value={dishForm.name}
                onChange={(event) => setDishForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Dish name"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
              <input
                type="number"
                min={1}
                value={dishForm.price}
                onChange={(event) => setDishForm((prev) => ({ ...prev, price: event.target.value }))}
                placeholder="Price"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={dishForm.isAvailable}
                  onChange={(event) =>
                    setDishForm((prev) => ({ ...prev, isAvailable: event.target.checked }))
                  }
                />
                Available
              </label>
              <input
                value={dishForm.thumb}
                onChange={(event) => setDishForm((prev) => ({ ...prev, thumb: event.target.value }))}
                placeholder="Thumbnail path/url"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2"
              />
              <UploadField
                label="Upload Thumbnail"
                assetType="thumb"
                accept="image/png,image/jpeg,image/webp"
                value={dishForm.thumb}
                onUploaded={(url) => setDishForm((prev) => ({ ...prev, thumb: url }))}
                className="md:col-span-2"
              />
              <input
                value={dishForm.model}
                onChange={(event) => setDishForm((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="Model path/url"
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2"
              />
              <UploadField
                label="Upload 3D Model (.glb)"
                assetType="model"
                accept=".glb,model/gltf-binary"
                value={dishForm.model}
                onUploaded={(url) => setDishForm((prev) => ({ ...prev, model: url }))}
                className="md:col-span-2"
              />
              <textarea
                value={dishForm.desc}
                onChange={(event) => setDishForm((prev) => ({ ...prev, desc: event.target.value }))}
                placeholder="Description"
                rows={3}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none md:col-span-2"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onSaveDish}
                disabled={dishLimitReached}
                className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-300"
              >
                {editingDishId ? "Save Dish" : "Add Dish"}
              </button>
              {editingDishId ? (
                <button
                  onClick={resetDishForm}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-white hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 text-sm font-black uppercase tracking-wide text-white/70">Dishes</div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-white/[0.04] text-left text-sm text-white/60">
                <tr>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Availability</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id} className="border-t border-white/10 text-sm">
                    <td className="px-3 py-3">
                      <div className="font-bold">{dish.name}</div>
                      <div className="text-xs text-white/55">{dish.desc}</div>
                    </td>
                    <td className="px-3 py-3 text-white/75">
                      {categoryNameById.get(dish.categoryId) || "Unknown"}
                    </td>
                    <td className="px-3 py-3 text-orange-300">{formatKsh(dish.price)}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => onToggleDish(dish)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          dish.isAvailable
                            ? "border-emerald-400/35 bg-emerald-500/20 text-emerald-200"
                            : "border-white/15 bg-white/10 text-white/75"
                        }`}
                      >
                        {dish.isAvailable ? "Available" : "Unavailable"}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEditDish(dish)}
                          className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDeleteDish(dish.id)}
                          className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!dishes.length ? (
            <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm text-white/55">
              No restaurant dishes yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
