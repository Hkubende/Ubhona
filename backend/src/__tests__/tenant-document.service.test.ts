import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  platformTrackerDocument: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

describe("tenant-document.service", () => {
  beforeEach(() => {
    prismaMock.platformTrackerDocument.findFirst.mockReset();
    prismaMock.platformTrackerDocument.findMany.mockReset();
    prismaMock.platformTrackerDocument.upsert.mockReset();
    prismaMock.platformTrackerDocument.create.mockReset();
    prismaMock.platformTrackerDocument.deleteMany.mockReset();
  });

  it("scopes reads by restaurantId at the prisma boundary", async () => {
    const { findRestaurantDocumentByKey } = await import("../services/tenant-document.service.js");
    prismaMock.platformTrackerDocument.findFirst.mockResolvedValueOnce({ payload: { ok: true } });

    await findRestaurantDocumentByKey({
      restaurantId: "resto-a",
      key: "order_context:resto-a:order-1",
      select: { payload: true },
    });

    expect(prismaMock.platformTrackerDocument.findFirst).toHaveBeenCalledWith({
      where: {
        key: "order_context:resto-a:order-1",
        restaurantId: "resto-a",
      },
      select: { payload: true },
    });
  });

  it("rejects cross-tenant document access before the db query runs", async () => {
    const { upsertRestaurantDocument } = await import("../services/tenant-document.service.js");

    await expect(
      upsertRestaurantDocument({
        restaurantId: "resto-a",
        key: "order_context:resto-b:order-1",
        payload: { restaurantId: "resto-b" },
      }),
    ).rejects.toThrow("Tenant document key does not belong to the requested restaurant.");

    expect(prismaMock.platformTrackerDocument.upsert).not.toHaveBeenCalled();
  });

  it("writes restaurantId explicitly on upsert create and update paths", async () => {
    const { upsertRestaurantDocument } = await import("../services/tenant-document.service.js");
    prismaMock.platformTrackerDocument.upsert.mockResolvedValueOnce({ id: "doc-1" });

    await upsertRestaurantDocument({
      restaurantId: "resto-a",
      key: "order_context:resto-a:order-1",
      payload: { ok: true },
    });

    expect(prismaMock.platformTrackerDocument.upsert).toHaveBeenCalledWith({
      where: { key: "order_context:resto-a:order-1" },
      create: {
        key: "order_context:resto-a:order-1",
        restaurantId: "resto-a",
        payload: { ok: true },
      },
      update: {
        restaurantId: "resto-a",
        payload: { ok: true },
      },
    });
  });
});
