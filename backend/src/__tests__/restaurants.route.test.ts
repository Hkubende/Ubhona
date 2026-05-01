import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedRestaurant: vi.fn(),
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
  createRestaurant: vi.fn(),
  getRestaurantBySlug: vi.fn(),
  getOwnedRestaurant: mocks.getOwnedRestaurant,
  updateRestaurant: vi.fn(),
}));

vi.mock("../services/billing.service.js", () => ({
  getRestaurantBillingSnapshot: vi.fn(),
  upgradeRestaurantPlan: vi.fn(),
}));

vi.mock("../services/subscription.service.js", () => ({
  mapSubscriptionSummary: vi.fn(() => ({ plan: "starter", status: "trialing" })),
  SUBSCRIPTION_PLANS: ["starter", "growth", "pro"],
  SUBSCRIPTION_STATUSES: ["trialing", "active", "past_due", "canceled"],
}));

vi.mock("../services/whatsapp.service.js", () => ({
  getRestaurantWhatsAppSettings: vi.fn(),
  getWhatsAppLogsForRestaurant: vi.fn(),
  updateRestaurantWhatsAppSettings: vi.fn(),
}));

vi.mock("../services/activity.service.js", () => ({
  createApprovalRequest: vi.fn(),
  getRestaurantActivityHistory: vi.fn(),
  listApprovalRequests: vi.fn(),
  recordActivityEvent: vi.fn(),
  requiresApprovalForAction: vi.fn(() => false),
  reviewApprovalRequest: vi.fn(),
}));

vi.mock("../services/stock.service.js", () => ({
  listBranchDishStockOverrides: vi.fn(),
}));

vi.mock("../prisma.js", () => ({
  prisma: {},
}));

import { restaurantRouter } from "../routes/restaurants.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/restaurants", restaurantRouter);
  return app;
}

describe("restaurantRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports missing owned restaurant as a quiet status response", async () => {
    mocks.getOwnedRestaurant.mockResolvedValue(null);

    const response = await request(buildApp()).get("/restaurants/me/status").set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ exists: false, restaurant: null });
  });
});
