import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  platformTrackerDocument: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

describe("category-control.service", () => {
  beforeEach(() => {
    prismaMock.platformTrackerDocument.findMany.mockReset();
    prismaMock.platformTrackerDocument.findFirst.mockReset();
    prismaMock.platformTrackerDocument.upsert.mockReset();
  });

  it("lists persisted category controls", async () => {
    const { listCategoryMenuControls } = await import("../services/category-control.service.js");
    prismaMock.platformTrackerDocument.findMany.mockResolvedValueOnce([
      {
        payload: {
          restaurantId: "resto-1",
          categoryId: "cat-1",
          isActive: false,
          updatedAt: "2026-04-16T12:00:00.000Z",
        },
      },
    ]);

    await expect(listCategoryMenuControls({ restaurantId: "resto-1" })).resolves.toEqual([
      {
        restaurantId: "resto-1",
        categoryId: "cat-1",
        isActive: false,
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
    ]);
  });

  it("defaults missing category controls to active when upserting", async () => {
    const { upsertCategoryMenuControl } = await import("../services/category-control.service.js");
    prismaMock.platformTrackerDocument.findFirst.mockResolvedValueOnce(null);

    const row = await upsertCategoryMenuControl({
      restaurantId: "resto-1",
      categoryId: "cat-1",
    });

    expect(row.isActive).toBe(true);
    expect(prismaMock.platformTrackerDocument.upsert).toHaveBeenCalledOnce();
  });
});
