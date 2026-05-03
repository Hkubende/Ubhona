import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    restaurant: { findUnique: vi.fn() },
    category: { findMany: vi.fn() },
    dish: { findMany: vi.fn() },
  },
  runWithPublicStorefrontDbContext: vi.fn(),
  listCategoryMenuControls: vi.fn(),
  listBranchDishStockOverrides: vi.fn(),
  findRestaurantDocumentByKey: vi.fn(),
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
}));

vi.mock("../db-rls.js", () => ({
  runWithPublicStorefrontDbContext: mocks.runWithPublicStorefrontDbContext,
}));

vi.mock("../services/category-control.service.js", () => ({
  listCategoryMenuControls: mocks.listCategoryMenuControls,
}));

vi.mock("../services/stock.service.js", () => ({
  listBranchDishStockOverrides: mocks.listBranchDishStockOverrides,
}));

vi.mock("../services/tenant-document.service.js", () => ({
  findRestaurantDocumentByKey: mocks.findRestaurantDocumentByKey,
}));

import { getPublicStorefrontPayload } from "../services/public-storefront.service.js";

describe("public-storefront.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runWithPublicStorefrontDbContext.mockImplementation((_restaurantId, callback) => callback());
    mocks.prisma.restaurant.findUnique.mockResolvedValue({
      id: "rest-1",
      slug: "demo",
      name: "Demo Restaurant",
      location: "Nairobi",
      logoUrl: "logo.jpg",
      coverImage: "cover.jpg",
      themePrimary: "#FF6A1A",
      themeSecondary: "#E8D8C3",
      shortDescription: "Public storefront",
      subscriptionPlan: "enterprise",
    });
    mocks.prisma.category.findMany.mockResolvedValue([
      { id: "cat-1", name: "Burgers", sortOrder: 0 },
      { id: "cat-2", name: "Hidden", sortOrder: 1 },
    ]);
    mocks.prisma.dish.findMany.mockResolvedValue([
      {
        id: "dish-1",
        restaurantId: "rest-1",
        categoryId: "cat-1",
        name: "Public Burger",
        description: "Visible",
        price: 1200,
        thumbUrl: "thumb.jpg",
        modelUrl: "model.glb",
        isAvailable: true,
      },
      {
        id: "dish-2",
        restaurantId: "rest-1",
        categoryId: "cat-2",
        name: "Hidden Burger",
        description: "Hidden",
        price: 900,
        thumbUrl: "hidden.jpg",
        modelUrl: "",
        isAvailable: true,
      },
    ]);
    mocks.listCategoryMenuControls.mockResolvedValue([
      { categoryId: "cat-1", isActive: true },
      { categoryId: "cat-2", isActive: false },
    ]);
    mocks.listBranchDishStockOverrides.mockResolvedValue([
      {
        dishId: "dish-2",
        availability_status: "available",
        stock_quantity: 10,
        low_stock_threshold: 5,
        hidden_from_public_menu: true,
      },
    ]);
    mocks.findRestaurantDocumentByKey.mockResolvedValue({
      payload: { auto_hide_unavailable_dishes: true },
    });
  });

  it("returns only storefront-safe fields and filters hidden/internal menu rows", async () => {
    const payload = await getPublicStorefrontPayload({
      slug: "demo",
      branchId: "main",
    });

    expect(mocks.runWithPublicStorefrontDbContext).toHaveBeenCalledWith("rest-1", expect.any(Function));
    expect(payload).toEqual({
      restaurant: {
        id: "rest-1",
        slug: "demo",
        name: "Demo Restaurant",
        location: "Nairobi",
        logoUrl: "logo.jpg",
        coverImage: "cover.jpg",
        themePrimary: "#FF6A1A",
        themeSecondary: "#E8D8C3",
        shortDescription: "Public storefront",
      },
      categories: [{ id: "cat-1", name: "Burgers", sortOrder: 0 }],
      dishes: [
        {
          id: "dish-1",
          restaurantId: "rest-1",
          categoryId: "cat-1",
          name: "Public Burger",
          description: "Visible",
          price: 1200,
          thumbUrl: "thumb.jpg",
          modelUrl: "model.glb",
          isAvailable: true,
          availability_status: "available",
          stock_quantity: null,
          low_stock_threshold: 5,
          hidden_from_public_menu: false,
          branchId: "main",
        },
      ],
    });
    expect(payload?.restaurant).not.toHaveProperty("subscriptionPlan");
  });

  it("returns null when the slug does not resolve to a restaurant", async () => {
    mocks.prisma.restaurant.findUnique.mockResolvedValue(null);

    const payload = await getPublicStorefrontPayload({
      slug: "missing",
      branchId: "main",
    });

    expect(payload).toBeNull();
    expect(mocks.runWithPublicStorefrontDbContext).not.toHaveBeenCalled();
  });
});
