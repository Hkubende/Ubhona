import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    restaurant: { findUnique: vi.fn() },
  },
  getOwnedRestaurant: vi.fn(),
  getAnalyticsSummary: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mocks.verify,
  },
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
}));

vi.mock("../services/restaurant.service.js", () => ({
  getOwnedRestaurant: mocks.getOwnedRestaurant,
}));

vi.mock("../services/analytics.service.js", () => ({
  ANALYTICS_EVENT_TYPES: [
    "page_view",
    "dish_view",
    "ar_open",
    "add_to_cart",
    "checkout_start",
    "order_created",
    "payment_success",
    "payment_failed",
  ],
  getAnalyticsSummary: mocks.getAnalyticsSummary,
  getConversionMetrics: vi.fn(),
  getTopDishes: vi.fn(),
  recordAnalyticsEvent: vi.fn(),
}));

import { analyticsRouter } from "../routes/analytics.js";
import { getDishLimit, hasPlanFeature } from "../services/subscription.service.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/analytics", analyticsRouter);
  return app;
}

describe("Plan feature helpers", () => {
  it("starter plan has expected limits and gates", () => {
    expect(getDishLimit("starter")).toBe(25);
    expect(hasPlanFeature("starter", "analytics")).toBe(false);
    expect(hasPlanFeature("starter", "ar")).toBe(false);
  });

  it("pro plan unlocks analytics/ar/custom branding", () => {
    expect(getDishLimit("pro")).toBeNull();
    expect(hasPlanFeature("pro", "analytics")).toBe(true);
    expect(hasPlanFeature("pro", "ar")).toBe(true);
    expect(hasPlanFeature("pro", "customBranding")).toBe(true);
  });

  it("enterprise plan includes enterprise capabilities", () => {
    expect(hasPlanFeature("enterprise", "advancedAnalytics")).toBe(true);
    expect(hasPlanFeature("enterprise", "staffAccounts")).toBe(true);
    expect(hasPlanFeature("enterprise", "multiBranch")).toBe(true);
  });
});

describe("Analytics route plan gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue({ sub: "user-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@demo.com",
      role: "restaurant_owner",
    });
  });

  it("rejects unauthenticated requests", async () => {
    const app = buildApp();
    const response = await request(app).get("/analytics/summary");
    expect(response.status).toBe(401);
  });

  it("rejects starter plan for analytics summary", async () => {
    mocks.getOwnedRestaurant.mockResolvedValue({
      id: "rest-1",
      subscriptionPlan: "starter",
    });

    const app = buildApp();
    const response = await request(app)
      .get("/analytics/summary")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/Upgrade to Pro/i);
  });

  it("allows pro plan analytics summary", async () => {
    mocks.getOwnedRestaurant.mockResolvedValue({
      id: "rest-1",
      subscriptionPlan: "pro",
    });
    mocks.getAnalyticsSummary.mockResolvedValue({
      periodDays: 30,
      totals: {},
      rates: {},
      mostViewedDishes: [],
      mostOrderedDishes: [],
    });

    const app = buildApp();
    const response = await request(app)
      .get("/analytics/summary")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(mocks.getAnalyticsSummary).toHaveBeenCalledWith("rest-1", 30);
  });
});
