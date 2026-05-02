import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadAssetServerManaged: vi.fn(),
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
  requireAppAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "owner@example.com",
      role: "restaurant_owner",
      restaurantId: "restaurant-1",
    };
    next();
  },
}));

vi.mock("../middleware/rate-limit.js", () => ({
  authAwareRateLimitKey: vi.fn(),
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/restaurant.service.js", () => ({
  getOwnedRestaurant: vi.fn(),
}));

vi.mock("../services/upload.service.js", () => ({
  completeUpload: vi.fn(),
  prepareUpload: vi.fn(),
  uploadAssetServerManaged: mocks.uploadAssetServerManaged,
}));

import { uploadsRouter } from "../routes/uploads.js";

function buildApp() {
  const app = express();
  app.use("/api/uploads", uploadsRouter);
  return app;
}

describe("uploadsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadAssetServerManaged.mockResolvedValue({
      url: "https://storage.example.com/thumb.png",
      path: "restaurant-1/dish-1/thumbnail.png",
      bucket: "dish-thumbnails",
    });
  });

  it("uploads thumbnails after binding the authenticated restaurant DB session", async () => {
    const response = await request(buildApp())
      .post("/api/uploads/thumbnail")
      .set("Authorization", "Bearer test-token")
      .field("restaurantId", "restaurant-1")
      .field("dishId", "dish-1")
      .attach("file", Buffer.from("fake-png"), {
        filename: "thumb.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(mocks.uploadAssetServerManaged).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      userId: "user-1",
      isAdmin: false,
      dishId: "dish-1",
      fileName: "thumb.png",
      fileType: "image/png",
      bytes: expect.any(Buffer),
      assetType: "thumb",
      uploadedBy: "user-1",
    });
    expect(response.body).toMatchObject({
      ok: true,
      url: "https://storage.example.com/thumb.png",
      path: "restaurant-1/dish-1/thumbnail.png",
      bucket: "dish-thumbnails",
    });
  });
});
