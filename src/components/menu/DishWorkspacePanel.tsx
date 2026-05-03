import * as React from "react";
import { Pencil, PlusCircle, QrCode, Trash2 } from "lucide-react";
import { DashboardPanel, SectionHeader } from "../dashboard/dashboard-primitives";
import { Button } from "../ui/Button";
import { EditorPanel } from "../ui/EditorPanel";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { UbhonaSelect, UbhonaSelectItem } from "../ui/ubhona-select";
import UploadField from "../uploads/UploadField";
import { cn } from "../../lib/utils";
import { radius, spacing, tokens, typography } from "../../design-system";
import type { Category, Dish } from "../../types/dashboard";
import type { UploadedMediaAsset } from "../../lib/uploads";

export type DishFormState = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  available: boolean;
  imageUrl: string;
  modelUrl: string;
};

type CategoryCount = Category & { count: number };

type DishWorkspacePanelProps = {
  restaurantId?: string;
  editingDishId: string | null;
  activeDish: Dish | null;
  dishForm: DishFormState;
  categories: CategoryCount[];
  isCategoryManagerOpen: boolean;
  newCategoryName: string;
  editingCategoryId: string | null;
  editingCategoryName: string;
  onDishFormChange: (patch: Partial<DishFormState>) => void;
  onSubmitDish: (event: React.FormEvent<HTMLFormElement>) => void;
  onResetDish: () => void;
  onCreateNewDish: () => void;
  onOpenDishQr: () => void;
  onToggleCategoryManager: () => void;
  onNewCategoryNameChange: (value: string) => void;
  onAddCategory: (event: React.FormEvent<HTMLFormElement>) => void;
  onStartCategoryEdit: (id: string, name: string) => void;
  onEditingCategoryNameChange: (value: string) => void;
  onSaveCategoryEdit: () => void;
  onCancelCategoryEdit: () => void;
  onRemoveCategory: (id: string) => void;
  onToggleCategoryAvailability: (category: CategoryCount) => void;
};

export function DishWorkspacePanel({
  restaurantId,
  editingDishId,
  activeDish,
  dishForm,
  categories,
  isCategoryManagerOpen,
  newCategoryName,
  editingCategoryId,
  editingCategoryName,
  onDishFormChange,
  onSubmitDish,
  onResetDish,
  onCreateNewDish,
  onOpenDishQr,
  onToggleCategoryManager,
  onNewCategoryNameChange,
  onAddCategory,
  onStartCategoryEdit,
  onEditingCategoryNameChange,
  onSaveCategoryEdit,
  onCancelCategoryEdit,
  onRemoveCategory,
  onToggleCategoryAvailability,
}: DishWorkspacePanelProps) {
  const modelFileName = dishForm.modelUrl ? dishForm.modelUrl.split("/").pop() || "Model linked" : "";
  const [thumbnailAsset, setThumbnailAsset] = React.useState<UploadedMediaAsset | null>(null);
  const [modelAsset, setModelAsset] = React.useState<UploadedMediaAsset | null>(null);

  React.useEffect(() => {
    if (!editingDishId) {
      setThumbnailAsset(null);
      setModelAsset(null);
    }
  }, [editingDishId]);

  return (
    <DashboardPanel className="space-y-5 p-5 lg:space-y-6 lg:p-6">
      <SectionHeader
        title={editingDishId ? "Edit Dish" : "Dish Workspace"}
        subtitle={
          editingDishId
            ? "Make changes here and keep the dish list visible while you work."
            : "Create the next live dish here, then upload media so your storefront and QR links feel complete."
        }
        action={
          editingDishId ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={onOpenDishQr}>
                <QrCode className="h-3.5 w-3.5" />
                Dish QR
              </Button>
              <Button size="sm" variant="ghost" onClick={onCreateNewDish}>
                New Dish
              </Button>
            </div>
          ) : null
        }
      />

      {!editingDishId ? (
        <div className={cn(tokens.classes.panelInset, "px-4 py-3 text-sm text-text-secondary/76")}>
          <span className="font-semibold text-text-primary">First dish checklist:</span> add a clear name, set the price, choose a category, then upload a thumbnail before sharing the menu QR.
        </div>
      ) : null}

      <EditorPanel className={cn("p-[18px]", spacing.stackMd)}>
        <div className={cn("flex flex-wrap items-start justify-between", spacing.gapMd)}>
          <div>
            <div className={cn("text-text-primary", typography.subSectionTitle)}>
              {editingDishId ? activeDish?.name || "Editing selected dish" : "Categories"}
            </div>
            <p className={cn("mt-1", typography.mutedBody)}>
              Keep category handling lightweight inside the dish workflow.
            </p>
          </div>
          <Button
            size="sm"
            variant={isCategoryManagerOpen ? "secondary" : "ghost"}
            className={cn(isCategoryManagerOpen && "border-primary/35 bg-primary/12 text-text-primary")}
            onClick={onToggleCategoryManager}
          >
            {isCategoryManagerOpen ? "Hide category tools" : "Quick category tools"}
          </Button>
        </div>

        <div className={cn("flex flex-wrap", spacing.gapSm)}>
          {categories.length ? (
            categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onDishFormChange({ categoryId: category.id })}
                className={cn(
                  `${radius.panel} border px-3 py-1 text-xs transition-colors hover:border-border-strong hover:text-text-primary`,
                  dishForm.categoryId === category.id
                    ? tokens.classes.categoryChipActive
                    : tokens.classes.categoryChipIdle
                )}
              >
                {category.name} ({category.count})
              </button>
            ))
          ) : (
            <span className="text-sm text-text-secondary/58">No categories yet.</span>
          )}
        </div>

        {isCategoryManagerOpen ? (
          <div className={cn("border-t border-border pt-4", spacing.stackSm)}>
            <form onSubmit={onAddCategory} className={cn(`grid sm:grid-cols-[1fr_auto]`, spacing.gapSm)}>
              <Input
                id="new-category-name"
                name="newCategoryName"
                value={newCategoryName}
                onChange={(event) => onNewCategoryNameChange(event.target.value)}
                placeholder="Create a new category"
                aria-label="Category name"
              />
              <Button type="submit" variant="secondary" className="sm:min-w-[124px]">
                Add Category
              </Button>
            </form>

            {categories.length ? (
              <div className={spacing.stackSm}>
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={cn(tokens.classes.mutedPanelRow, spacing.gapSm)}
                  >
                    {editingCategoryId === category.id ? (
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <Input
                          id={`edit-category-name-${category.id}`}
                          name={`editCategoryName${category.id}`}
                          value={editingCategoryName}
                          onChange={(event) => onEditingCategoryNameChange(event.target.value)}
                          aria-label={`Edit ${category.name}`}
                          className="sm:min-w-[180px]"
                        />
                        <Button size="sm" onClick={onSaveCategoryEdit}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onCancelCategoryEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-medium text-text-primary">{category.name}</div>
                          <div className="text-[11px] text-text-secondary/55">
                            {category.count} dishes - {category.menuControl?.isActive === false ? "Hidden on storefront" : "Visible on storefront"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-text-secondary/78 hover:text-text-primary"
                            onClick={() => onToggleCategoryAvailability(category)}
                          >
                            {category.menuControl?.isActive === false ? "Show" : "Hide"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                                    className="text-text-secondary/78 hover:text-text-primary"
                                    onClick={() => onStartCategoryEdit(category.id, category.name)}
                                  >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-200 hover:text-red-100"
                            onClick={() => onRemoveCategory(category.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </EditorPanel>

      <form onSubmit={onSubmitDish} className={cn("border-t border-border pt-4", spacing.stackMd)}>
        <div className={cn("grid sm:grid-cols-2", spacing.gapMd)}>
          <div>
            <label htmlFor="dish-name" className={cn("mb-1.5 block", typography.label)}>
              Dish Name
            </label>
            <Input
              id="dish-name"
              name="dishName"
              value={dishForm.name}
              onChange={(event) => onDishFormChange({ name: event.target.value })}
              placeholder="Dish name"
              aria-label="Dish name"
            />
          </div>
          <div>
            <label htmlFor="dish-price" className={cn("mb-1.5 block", typography.label)}>
              Price (KSh)
            </label>
            <Input
              id="dish-price"
              name="dishPrice"
              value={dishForm.price}
              onChange={(event) => onDishFormChange({ price: event.target.value })}
              placeholder="Price (e.g. 1200)"
              aria-label="Dish price"
              type="number"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div>
          <label htmlFor="dish-description" className={cn("mb-1.5 block", typography.label)}>
            Description
          </label>
          <Textarea
            id="dish-description"
            name="dishDescription"
            value={dishForm.description}
            onChange={(event) => onDishFormChange({ description: event.target.value })}
            placeholder="Short description"
            aria-label="Dish description"
          />
        </div>

        <div className={cn("grid sm:grid-cols-[minmax(0,1fr)_auto]", spacing.gapMd)}>
          <UbhonaSelect
            id="dish-category"
            name="dishCategory"
            value={dishForm.categoryId}
            onValueChange={(value) => onDishFormChange({ categoryId: value })}
            aria-label="Dish category"
            placeholder="Select category"
          >
            {categories.map((category) => (
              <UbhonaSelectItem key={category.id} value={category.id}>
                {category.name}
              </UbhonaSelectItem>
            ))}
          </UbhonaSelect>
          <label className={tokens.classes.availabilityControl}>
            <input
              id="dish-available"
              name="dishAvailable"
              type="checkbox"
              checked={dishForm.available}
              onChange={(event) => onDishFormChange({ available: event.target.checked })}
              className="h-4 w-4 rounded border-border bg-surface accent-[var(--color-primary)]"
            />
            Available
          </label>
        </div>

        <div className="space-y-2">
          <label htmlFor="dish-image-url" className={cn("mb-1.5 block", typography.label)}>
            Image URL
          </label>
          <Input
            id="dish-image-url"
            name="dishImageUrl"
            value={dishForm.imageUrl}
            onChange={(event) => onDishFormChange({ imageUrl: event.target.value })}
            placeholder="Image URL"
            aria-label="Dish image URL"
          />
          <p className="text-[11px] text-text-secondary/68">
            Uploading a thumbnail automatically fills this field. You can still paste a manual URL to override it.
          </p>
          <UploadField
            label="Upload Thumbnail"
            assetType="thumb"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            value={dishForm.imageUrl}
            onUploaded={(url) => onDishFormChange({ imageUrl: url })}
            onUploadedAsset={setThumbnailAsset}
            linkedFieldLabel="Image URL"
            restaurantId={restaurantId}
            dishId={editingDishId || undefined}
          />
          {thumbnailAsset ? (
            <p className="text-[11px] text-text-secondary/68">
              Stored in `{thumbnailAsset.bucket}` at `{thumbnailAsset.path}` ({Math.max(1, Math.round(thumbnailAsset.sizeBytes / 1024))} KB)
              {thumbnailAsset.width && thumbnailAsset.height ? ` • ${thumbnailAsset.width}x${thumbnailAsset.height}` : ""}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="dish-model-url" className={cn("mb-1.5 block", typography.label)}>
            3D Model URL (Optional)
          </label>
          <Input
            id="dish-model-url"
            name="dishModelUrl"
            value={dishForm.modelUrl}
            onChange={(event) => onDishFormChange({ modelUrl: event.target.value })}
            placeholder="Model URL (optional)"
            aria-label="Dish model URL"
          />
          <UploadField
            label="Upload 3D Model (.glb / .gltf)"
            assetType="model"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            value={dishForm.modelUrl}
            onUploaded={(url) => onDishFormChange({ modelUrl: url })}
            onUploadedAsset={setModelAsset}
            restaurantId={restaurantId}
            dishId={editingDishId || undefined}
          />
          {modelAsset ? (
            <p className="text-[11px] text-text-secondary/68">
              Stored in `{modelAsset.bucket}` at `{modelAsset.path}` ({Math.max(1, Math.round(modelAsset.sizeBytes / 1024))} KB)
            </p>
          ) : null}
        </div>

        {(dishForm.imageUrl || dishForm.modelUrl) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {dishForm.imageUrl ? (
              <div className={tokens.classes.previewFrame}>
                <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-text-secondary/68">
                  Thumbnail Preview
                </div>
                <img
                  src={dishForm.imageUrl}
                  alt={dishForm.name || "Dish preview"}
                  className="h-44 w-full object-cover"
                />
              </div>
            ) : (
              <div className={cn(tokens.classes.previewFrame, "grid min-h-[176px] place-items-center px-3 py-6 text-xs text-text-secondary/60")}>
                No thumbnail selected
              </div>
            )}
            <div className={cn(tokens.classes.previewFrame, "p-3")}>
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.08em] text-text-secondary/68">
                <span>3D Model</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    dishForm.modelUrl
                      ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
                      : "border-border bg-[color:var(--ui-note-icon-bg)] text-text-secondary/75"
                  )}
                >
                  {dishForm.modelUrl ? "Linked" : "Not linked"}
                </span>
              </div>
              {dishForm.modelUrl ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-border bg-[color:var(--ui-note-icon-bg)] px-2.5 py-2 text-xs text-text-secondary">
                    <div className="truncate font-medium text-text-primary">{modelFileName}</div>
                    <div className="truncate text-text-secondary/68">{dishForm.modelUrl}</div>
                  </div>
                  <a
                    href={dishForm.modelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-primary/15"
                  >
                    View model asset
                  </a>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-[color:var(--ui-note-icon-bg)] px-2.5 py-2 text-xs text-text-secondary/65">
                  No model linked yet
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" variant="primary" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {editingDishId ? "Save Dish Changes" : "Create Dish"}
          </Button>
          <Button type="button" variant="ghost" onClick={onResetDish}>
            Reset
          </Button>
        </div>
      </form>
    </DashboardPanel>
  );
}

