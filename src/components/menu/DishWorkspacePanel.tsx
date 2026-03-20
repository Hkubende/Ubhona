import * as React from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import { DashboardPanel, SectionHeader } from "../dashboard/dashboard-primitives";
import { Button } from "../ui/Button";
import { EditorPanel } from "../ui/EditorPanel";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { UbhonaSelect, UbhonaSelectItem } from "../ui/ubhona-select";
import { cn } from "../../lib/utils";
import { radius, spacing, tokens, typography } from "../../design-system";
import type { Category, Dish } from "../../types/dashboard";

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
  onToggleCategoryManager: () => void;
  onNewCategoryNameChange: (value: string) => void;
  onAddCategory: (event: React.FormEvent<HTMLFormElement>) => void;
  onStartCategoryEdit: (id: string, name: string) => void;
  onEditingCategoryNameChange: (value: string) => void;
  onSaveCategoryEdit: () => void;
  onCancelCategoryEdit: () => void;
  onRemoveCategory: (id: string) => void;
};

export function DishWorkspacePanel({
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
  onToggleCategoryManager,
  onNewCategoryNameChange,
  onAddCategory,
  onStartCategoryEdit,
  onEditingCategoryNameChange,
  onSaveCategoryEdit,
  onCancelCategoryEdit,
  onRemoveCategory,
}: DishWorkspacePanelProps) {
  return (
    <DashboardPanel className="space-y-4">
      <SectionHeader
        title={editingDishId ? "Edit Dish" : "Dish Workspace"}
        subtitle={
          editingDishId
            ? "Make changes here and keep the dish list visible while you work."
            : "Create dishes and manage categories in the same compact working area."
        }
        action={
          editingDishId ? (
            <Button size="sm" variant="ghost" onClick={onCreateNewDish}>
              New Dish
            </Button>
          ) : null
        }
      />

      <EditorPanel className={spacing.stackLg}>
        <div className={cn("flex flex-wrap items-start justify-between", spacing.gapMd)}>
          <div>
            <div className={cn("text-text-primary", typography.subSectionTitle)}>
              {editingDishId ? activeDish?.name || "Editing selected dish" : "Categories"}
            </div>
            <p className={cn("mt-1", typography.mutedBody)}>
              Use categories directly in the dish workflow instead of a separate builder section.
            </p>
          </div>
          <Button
            size="sm"
            variant={isCategoryManagerOpen ? "secondary" : "ghost"}
            className={cn(isCategoryManagerOpen && "border-primary/35 bg-primary/12 text-text-primary")}
            onClick={onToggleCategoryManager}
          >
            {isCategoryManagerOpen ? "Hide categories" : "Manage categories"}
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
                  `${radius.panel} border px-3 py-1 text-xs transition-colors`,
                  dishForm.categoryId === category.id
                    ? tokens.classes.categoryChipActive
                    : tokens.classes.categoryChipIdle
                )}
              >
                {category.name} ({category.count})
              </button>
            ))
          ) : (
            <span className="text-sm text-white/55">No categories yet.</span>
          )}
        </div>

        {isCategoryManagerOpen ? (
          <div className={cn(`border-t border-white/10 pt-4`, spacing.stackMd)}>
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
                                  <div className="text-[11px] text-text-secondary/55">{category.count} dishes</div>
                        </div>
                        <div className="flex items-center gap-2">
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

      <form onSubmit={onSubmitDish} className={spacing.stackMd}>
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
              className="h-4 w-4 rounded border-white/20 bg-black/30 accent-[#E4572E]"
            />
            Available
          </label>
        </div>

        <div>
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
        </div>

        <div>
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
        </div>

        {dishForm.imageUrl ? (
          <div className={tokens.classes.previewFrame}>
            <img
              src={dishForm.imageUrl}
              alt={dishForm.name || "Dish preview"}
              className="h-40 w-full object-cover"
            />
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
