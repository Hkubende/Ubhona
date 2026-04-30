import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    category: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    $executeRaw: vi.fn(),
    category: { create: vi.fn() },
  },
  getOwnedRestaurant: vi.fn(),
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "owner@example.com",
      role: "restaurant_owner",
    };
    next();
  },
}));

vi.mock("../services/restaurant.service.js", () => ({
  getOwnedRestaurant: mocks.getOwnedRestaurant,
}));

import { categoriesRouter } from "../routes/categories.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/categories", categoriesRouter);
  return app;
}

describe("categoriesRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOwnedRestaurant.mockResolvedValue({
      id: "restaurant-1",
      ownerUserId: "user-1",
      name: "Demo Restaurant",
      slug: "demo-restaurant",
    });
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.category.create.mockResolvedValue({
      id: "cat-1",
      restaurantId: "restaurant-1",
      name: "Main",
      sortOrder: 0,
      createdAt: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("creates categories after binding the authenticated restaurant RLS session", async () => {
    const response = await request(buildApp())
      .post("/categories")
      .set("Authorization", "Bearer test-token")
      .send({
        name: "Main",
        sortOrder: 0,
      });

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect(String(mocks.tx.$executeRaw.mock.calls[0][0])).toContain("app.user_id");
    expect(String(mocks.tx.$executeRaw.mock.calls[1][0])).toContain("app.restaurant_id");
    expect(String(mocks.tx.$executeRaw.mock.calls[2][0])).toContain("app.is_admin");
    expect(mocks.tx.category.create).toHaveBeenCalledWith({
      data: {
        restaurantId: "restaurant-1",
        name: "Main",
        sortOrder: 0,
      },
    });
  });
});
