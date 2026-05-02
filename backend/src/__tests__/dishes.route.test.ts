import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  tx: {
    $executeRaw: vi.fn(),
    dish: { create: vi.fn() },
  },
  getOwnedRestaurant: vi.fn(),
  getRestaurantLimitStatus: vi.fn(),
  incrementRestaurantUsage: vi.fn(),
  recordActivityEvent: vi.fn(),
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
  runWithTenantContext: vi.fn(async ({ userId, restaurantId, isAdmin, fn }) =>
    mocks.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.restaurant_id', ${restaurantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_admin', ${isAdmin ? "true" : "false"}, true)`;
      return fn(tx);
    })
  ),
}));

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

vi.mock("../services/restaurant.service.js", () => ({
  getOwnedRestaurant: mocks.getOwnedRestaurant,
}));

vi.mock("../services/billing.service.js", () => ({
  getRestaurantLimitStatus: mocks.getRestaurantLimitStatus,
  incrementRestaurantUsage: mocks.incrementRestaurantUsage,
  decrementRestaurantUsage: vi.fn(),
}));

vi.mock("../services/activity.service.js", () => ({
  createApprovalRequest: vi.fn(),
  getRestaurantActivityHistory: vi.fn(),
  recordActivityEvent: mocks.recordActivityEvent,
  requiresApprovalForAction: vi.fn(() => false),
}));

vi.mock("../services/stock.service.js", () => ({
  getBranchDishStockOverride: vi.fn(),
  listBranchDishStockOverrides: vi.fn(),
  removeBranchDishStockOverride: vi.fn(),
  upsertBranchDishStockOverride: vi.fn(),
}));

import { dishesRouter } from "../routes/dishes.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/dishes", dishesRouter);
  return app;
}

describe("dishesRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOwnedRestaurant.mockResolvedValue({
      id: "restaurant-1",
      ownerUserId: "user-1",
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      subscriptionPlan: "starter",
      subscriptionStatus: "trialing",
      createdAt: new Date("2026-04-30T00:00:00.000Z"),
      trialEndsAt: null,
      renewalDate: null,
    });
    mocks.getRestaurantLimitStatus.mockResolvedValue({ reached: false, usageLimit: 25, currentUsage: 0, remaining: 25 });
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.dish.create.mockResolvedValue({
      id: "dish-1",
      restaurantId: "restaurant-1",
      categoryId: "cat-1",
      name: "Burger",
      description: "Added during onboarding.",
      price: 950,
      thumbUrl: "https://example.com/thumb.png",
      modelUrl: "",
      isAvailable: true,
      createdAt: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("creates dishes and updates usage inside the authenticated restaurant DB session", async () => {
    const response = await request(buildApp())
      .post("/dishes")
      .set("Authorization", "Bearer test-token")
      .send({
        categoryId: "cat-1",
        name: "Burger",
        description: "Added during onboarding.",
        price: 950,
        thumbnail_url: "https://example.com/thumb.png",
        isAvailable: true,
      });

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect(String(mocks.tx.$executeRaw.mock.calls[0][0])).toContain("app.user_id");
    expect(String(mocks.tx.$executeRaw.mock.calls[1][0])).toContain("app.restaurant_id");
    expect(String(mocks.tx.$executeRaw.mock.calls[2][0])).toContain("app.is_admin");
    expect(mocks.getRestaurantLimitStatus).toHaveBeenCalledWith(expect.objectContaining({ id: "restaurant-1" }), "dishes");
    expect(mocks.tx.dish.create).toHaveBeenCalledWith({
      data: {
        restaurantId: "restaurant-1",
        categoryId: "cat-1",
        name: "Burger",
        description: "Added during onboarding.",
        price: 950,
        thumbUrl: "https://example.com/thumb.png",
        modelUrl: "",
        isAvailable: true,
      },
    });
    expect(mocks.incrementRestaurantUsage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "restaurant-1" }),
      "dishes",
      1
    );
  });
});
