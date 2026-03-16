import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    restaurant: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    order: { count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
    payment: { count: vi.fn(), findMany: vi.fn() },
    platformTrackerDocument: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mocks.verify,
  },
}));

vi.mock("../prisma.js", () => ({
  prisma: mocks.prisma,
}));

import { adminRouter } from "../routes/admin.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  return app;
}

describe("Admin authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    const app = buildApp();
    const response = await request(app).get("/admin/metrics");
    expect(response.status).toBe(401);
  });

  it("rejects non-admin users", async () => {
    mocks.verify.mockReturnValue({ sub: "user-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@demo.com",
      role: "restaurant_owner",
    });

    const app = buildApp();
    const response = await request(app)
      .get("/admin/metrics")
      .set("Authorization", "Bearer test-token");
    expect(response.status).toBe(403);
  });

  it("allows platform_admin users", async () => {
    mocks.verify.mockReturnValue({ sub: "admin-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@demo.com",
      role: "platform_admin",
    });
    mocks.prisma.restaurant.count.mockResolvedValue(2);
    mocks.prisma.order.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
    mocks.prisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 12000 } });
    mocks.prisma.restaurant.groupBy
      .mockResolvedValueOnce([{ subscriptionPlan: "starter", _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ subscriptionStatus: "active", _count: { _all: 2 } }]);
    mocks.prisma.payment.count.mockResolvedValue(1);

    const app = buildApp();
    const response = await request(app)
      .get("/admin/metrics")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.restaurants).toBe(2);
    expect(response.body.totalRevenue).toBe(12000);
  });
});
