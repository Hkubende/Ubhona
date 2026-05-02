import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
  },
  getOwnedRestaurant: vi.fn(),
  getRestaurantPaymentProfile: vi.fn(),
  getRestaurantPaymentStatus: vi.fn(),
  upsertRestaurantPaymentProfile: vi.fn(),
  validateRestaurantPaymentProfile: vi.fn(),
  activateRestaurantPaymentProfile: vi.fn(),
  disableRestaurantPaymentProfile: vi.fn(),
  getOrderPaymentStatus: vi.fn(),
  getMpesaRuntimeStatus: vi.fn(() => ({ ready: true, env: "sandbox", required: {} })),
  handleStkCallback: vi.fn(),
  initiateStkPushForOrder: vi.fn(),
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

vi.mock("../services/payment-profile.service.js", () => ({
  getRestaurantPaymentProfile: mocks.getRestaurantPaymentProfile,
  getRestaurantPaymentStatus: mocks.getRestaurantPaymentStatus,
  upsertRestaurantPaymentProfile: mocks.upsertRestaurantPaymentProfile,
  validateRestaurantPaymentProfile: mocks.validateRestaurantPaymentProfile,
  activateRestaurantPaymentProfile: mocks.activateRestaurantPaymentProfile,
  disableRestaurantPaymentProfile: mocks.disableRestaurantPaymentProfile,
}));

vi.mock("../services/payment.service.js", () => ({
  getOrderPaymentStatus: mocks.getOrderPaymentStatus,
  getMpesaRuntimeStatus: mocks.getMpesaRuntimeStatus,
  handleStkCallback: mocks.handleStkCallback,
  initiateStkPushForOrder: mocks.initiateStkPushForOrder,
}));

import { paymentsRouter } from "../routes/payments.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/payments", paymentsRouter);
  return app;
}

describe("Payment profile route access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects restaurant managers from managing payment profiles", async () => {
    mocks.verify.mockReturnValue({ sub: "manager-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "manager-1",
      email: "manager@demo.com",
      role: "restaurant_manager",
    });
    mocks.getOwnedRestaurant.mockResolvedValue({ id: "rest-1" });

    const app = buildApp();
    const response = await request(app)
      .get("/payments/profile")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(403);
    expect(mocks.getRestaurantPaymentProfile).not.toHaveBeenCalled();
  });

  it("loads the owner profile using the owned restaurant tenant context only", async () => {
    mocks.verify.mockReturnValue({ sub: "owner-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      email: "owner@demo.com",
      role: "restaurant_owner",
    });
    mocks.getOwnedRestaurant.mockResolvedValue({ id: "rest-1" });
    mocks.getRestaurantPaymentProfile.mockResolvedValue({ id: "profile-1", restaurantId: "rest-1" });

    const app = buildApp();
    const response = await request(app)
      .get("/payments/profile")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(mocks.getRestaurantPaymentProfile).toHaveBeenCalledWith("rest-1");
    expect(response.body.profile.restaurantId).toBe("rest-1");
  });

  it("loads the owner payment readiness status using the owned restaurant tenant context only", async () => {
    mocks.verify.mockReturnValue({ sub: "owner-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "owner-1",
      email: "owner@demo.com",
      role: "restaurant_owner",
    });
    mocks.getOwnedRestaurant.mockResolvedValue({ id: "rest-1" });
    mocks.getRestaurantPaymentStatus.mockResolvedValue({
      hasProfile: true,
      profileStatus: "active",
      lastValidationResult: "valid",
      lastValidationError: null,
      lastValidationAt: "2026-04-19T00:00:00.000Z",
      readyForPaymentInitiation: true,
    });

    const app = buildApp();
    const response = await request(app)
      .get("/payments/profile/status")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(mocks.getRestaurantPaymentStatus).toHaveBeenCalledWith("rest-1");
    expect(response.body.status.readyForPaymentInitiation).toBe(true);
  });
});