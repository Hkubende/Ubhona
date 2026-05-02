import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const categoryCreateMock = vi.fn();
const runWithTenantContextMock = vi.fn();
const upsertCategoryMenuControlMock = vi.fn();
const upsertCategoryMenuControlTxMock = vi.fn();

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "owner@example.com",
      role: "restaurant_owner",
      restaurantId: "restaurant-1",
    };
    next();
  },
}));

vi.mock("../prisma.js", () => ({
  runWithTenantContext: runWithTenantContextMock,
}));

vi.mock("../services/category-control.service.js", () => ({
  listCategoryMenuControls: vi.fn(),
  upsertCategoryMenuControl: upsertCategoryMenuControlMock,
  upsertCategoryMenuControlTx: upsertCategoryMenuControlTxMock,
}));

describe("categoriesRouter POST /", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runWithTenantContextMock.mockImplementation(async ({ fn }) =>
      fn({
        category: {
          create: categoryCreateMock,
        },
      })
    );
    categoryCreateMock.mockResolvedValue({
      id: "cat-1",
      restaurantId: "restaurant-1",
      name: "Main",
      sortOrder: 0,
    });
    upsertCategoryMenuControlTxMock.mockResolvedValue({
      restaurantId: "restaurant-1",
      categoryId: "cat-1",
      isActive: true,
      updatedAt: "2026-04-28T00:00:00.000Z",
    });
  });

  it("binds tenant DB context from the authenticated restaurant before category creation", async () => {
    const { categoriesRouter } = await import("../routes/categories.js");
    const app = express();
    app.use(express.json());
    app.use(categoriesRouter);

    const response = await request(app).post("/").send({
      name: "Main",
      sortOrder: 0,
      isActive: true,
    });

    expect(response.status).toBe(200);
    expect(runWithTenantContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        restaurantId: "restaurant-1",
        isAdmin: false,
        fn: expect.any(Function),
      })
    );
    expect(categoryCreateMock).toHaveBeenCalledWith({
      data: {
        restaurantId: "restaurant-1",
        name: "Main",
        sortOrder: 0,
      },
    });
    expect(upsertCategoryMenuControlTxMock).toHaveBeenCalledWith(expect.any(Object), {
      restaurantId: "restaurant-1",
      categoryId: "cat-1",
      isActive: true,
    });
  });
});
