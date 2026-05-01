import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  platformTrackerDocument: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

describe("order-context.service", () => {
  beforeEach(() => {
    prismaMock.platformTrackerDocument.upsert.mockReset();
    prismaMock.platformTrackerDocument.findFirst.mockReset();
  });

  it("stores storefront/admin branch context with main fallback", async () => {
    const { setOrderBranchContext } = await import("../services/order-context.service.js");

    const branchId = await setOrderBranchContext({
      restaurantId: "resto-1",
      orderId: "order-1",
      branchId: "",
    });

    expect(branchId).toBe("main");
    expect(prismaMock.platformTrackerDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "order_context:resto-1:order-1" },
      }),
    );
  });

  it("resolves saved branch context and falls back to main when missing", async () => {
    const { getOrderBranchContext } = await import("../services/order-context.service.js");

    prismaMock.platformTrackerDocument.findFirst.mockResolvedValueOnce({
      payload: { branchId: "branch-west" },
    });
    await expect(
      getOrderBranchContext({
        restaurantId: "resto-1",
        orderId: "order-1",
      }),
    ).resolves.toBe("branch-west");

    prismaMock.platformTrackerDocument.findFirst.mockResolvedValueOnce(null);
    await expect(
      getOrderBranchContext({
        restaurantId: "resto-1",
        orderId: "order-2",
      }),
    ).resolves.toBe("main");
  });
});
