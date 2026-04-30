import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    restaurant: { findUnique: vi.fn() },
  },
  runWithRestaurantDbSession: vi.fn(),
  recordAnalyticsEvent: vi.fn(),
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
}));

vi.mock("../middleware/rate-limit.js", () => ({
  authAwareRateLimitKey: vi.fn(),
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/db-session.service.js", () => ({
  runWithRestaurantDbSession: mocks.runWithRestaurantDbSession,
}));

vi.mock("../services/billing.service.js", () => ({
  isRestaurantFeatureEnabled: vi.fn(),
}));

vi.mock("../services/restaurant.service.js", () => ({
  getOwnedRestaurant: vi.fn(),
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
  getAnalyticsSummary: vi.fn(),
  getConversionMetrics: vi.fn(),
  getTopDishes: vi.fn(),
  recordAnalyticsEvent: mocks.recordAnalyticsEvent,
}));

import { analyticsRouter } from "../routes/analytics.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/analytics", analyticsRouter);
  return app;
}

describe("analyticsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.restaurant.findUnique.mockResolvedValue({
      id: "restaurant-1",
      ownerUserId: "user-1",
    });
    mocks.runWithRestaurantDbSession.mockImplementation(async (_input, callback) => callback({ tx: true }));
    mocks.recordAnalyticsEvent.mockResolvedValue({
      id: "event-1",
      eventType: "page_view",
      createdAt: new Date("2026-04-30T00:00:00.000Z"),
    });
  });

  it("records public analytics events inside the restaurant DB session", async () => {
    const response = await request(buildApp()).post("/analytics/events").send({
      restaurantId: "restaurant-1",
      eventType: "page_view",
      source: "storefront",
      sessionId: "session-1",
    });

    expect(response.status).toBe(201);
    expect(mocks.prisma.restaurant.findUnique).toHaveBeenCalledWith({
      where: { id: "restaurant-1" },
      select: { id: true, ownerUserId: true },
    });
    expect(mocks.runWithRestaurantDbSession).toHaveBeenCalledWith(
      {
        userId: "user-1",
        restaurantId: "restaurant-1",
        isAdmin: false,
      },
      expect.any(Function)
    );
    expect(mocks.recordAnalyticsEvent).toHaveBeenCalledWith(
      {
        restaurantId: "restaurant-1",
        eventType: "page_view",
        source: "storefront",
        sessionId: "session-1",
      },
      { tx: true }
    );
    expect(response.body).toMatchObject({ ok: true, event: { id: "event-1", eventType: "page_view" } });
  });
});
