import { runWithPublicStorefrontDbContext } from "../db-rls.js";
import { prisma } from "../prisma.js";
import { listCategoryMenuControls } from "./category-control.service.js";
import { getEffectiveDishMenuState } from "./menu-control.service.js";
import { listBranchDishStockOverrides } from "./stock.service.js";
import { findRestaurantDocumentByKey } from "./tenant-document.service.js";

const AUTOMATION_SETTINGS_KEY_PREFIX = "automation_settings:";
const DEFAULT_AUTOMATION_SETTINGS = {
  auto_hide_unavailable_dishes: false,
};

export type PublicStorefrontRestaurant = {
  id: string;
  slug: string;
  name: string;
  location: string;
  logoUrl: string | null;
  coverImage: string | null;
  themePrimary: string | null;
  themeSecondary: string | null;
  shortDescription: string | null;
};

export type PublicStorefrontCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type PublicStorefrontDish = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  thumbUrl: string;
  modelUrl: string;
  isAvailable: boolean;
  availability_status: "available" | "low_stock" | "unavailable";
  stock_quantity: number | null;
  low_stock_threshold: number;
  hidden_from_public_menu: boolean;
  branchId: string;
};

export type PublicStorefrontPayload = {
  restaurant: PublicStorefrontRestaurant;
  categories: PublicStorefrontCategory[];
  dishes: PublicStorefrontDish[];
};

function automationSettingsKey(restaurantId: string) {
  return `${AUTOMATION_SETTINGS_KEY_PREFIX}${restaurantId}`;
}

function toLooseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

export async function getPublicRestaurantBySlug(slug: string): Promise<PublicStorefrontRestaurant | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: normalizeSlug(slug) },
    select: {
      id: true,
      slug: true,
      name: true,
      location: true,
      logoUrl: true,
      coverImage: true,
      themePrimary: true,
      themeSecondary: true,
      shortDescription: true,
    },
  });

  if (!restaurant) return null;
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    location: restaurant.location,
    logoUrl: restaurant.logoUrl,
    coverImage: restaurant.coverImage,
    themePrimary: restaurant.themePrimary,
    themeSecondary: restaurant.themeSecondary,
    shortDescription: restaurant.shortDescription,
  };
}

export async function getPublicStorefrontPayload(input: {
  slug: string;
  branchId: string;
}): Promise<PublicStorefrontPayload | null> {
  const restaurant = await getPublicRestaurantBySlug(input.slug);
  if (!restaurant) return null;

  return runWithPublicStorefrontDbContext(restaurant.id, async () => {
    const [categories, dishes, controls, overrides, automationRow] = await Promise.all([
      prisma.category.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
        },
      }),
      prisma.dish.findMany({
        where: { restaurantId: restaurant.id, isAvailable: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          restaurantId: true,
          categoryId: true,
          name: true,
          description: true,
          price: true,
          thumbUrl: true,
          modelUrl: true,
          isAvailable: true,
        },
      }),
      listCategoryMenuControls({ restaurantId: restaurant.id }),
      listBranchDishStockOverrides({ restaurantId: restaurant.id, branchId: input.branchId }),
      findRestaurantDocumentByKey({
        restaurantId: restaurant.id,
        key: automationSettingsKey(restaurant.id),
        select: { payload: true },
      }),
    ]);

    const controlByCategoryId = new Map(controls.map((item) => [item.categoryId, item]));
    const overrideByDishId = new Map(overrides.map((item) => [item.dishId, item]));
    const automationSettings = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      ...toLooseRecord(automationRow?.payload),
    };
    const autoHideUnavailable = Boolean(automationSettings.auto_hide_unavailable_dishes);

    const activeCategoryIds = new Set(
      categories
        .filter((category) => {
          const menuControl = controlByCategoryId.get(category.id);
          return menuControl?.isActive !== false;
        })
        .map((category) => category.id)
    );

    const publicDishes = dishes
      .map((dish) => {
        const override = overrideByDishId.get(dish.id);
        const menuControl = getEffectiveDishMenuState({
          branchId: input.branchId,
          isAvailable: dish.isAvailable,
          stockOverride: override,
        });

        const availabilityStatus =
          menuControl.status === "paused" ? "unavailable" : menuControl.status;

        return {
          id: dish.id,
          restaurantId: dish.restaurantId,
          categoryId: dish.categoryId,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          thumbUrl: dish.thumbUrl,
          modelUrl: dish.modelUrl,
          isAvailable: menuControl.isOrderable,
          availability_status: availabilityStatus,
          stock_quantity: override?.stock_quantity ?? null,
          low_stock_threshold: override?.low_stock_threshold ?? 5,
          hidden_from_public_menu: Boolean(override?.hidden_from_public_menu),
          branchId: input.branchId,
          menuControl,
        };
      })
      .filter((dish) => activeCategoryIds.has(dish.categoryId))
      .filter((dish) => dish.menuControl.isVisibleOnPublicMenu)
      .filter((dish) => (autoHideUnavailable ? dish.menuControl.status !== "unavailable" : true))
      .map(({ menuControl: _menuControl, ...dish }) => dish);

    const visibleCategoryIds = new Set(publicDishes.map((dish) => dish.categoryId));
    const publicCategories = categories.filter((category) => {
      return activeCategoryIds.has(category.id) && visibleCategoryIds.has(category.id);
    });

    return {
      restaurant,
      categories: publicCategories,
      dishes: publicDishes,
    };
  });
}
