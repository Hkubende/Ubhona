import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  platformTrackerDocument: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

describe("notification.service", () => {
  beforeEach(() => {
    prismaMock.platformTrackerDocument.upsert.mockReset();
    prismaMock.platformTrackerDocument.findMany.mockReset();
  });

  it("creates notifications with role audiences", async () => {
    const { createStaffNotification } = await import("../services/notification.service.js");

    const row = await createStaffNotification({
      restaurantId: "resto-1",
      audienceRoles: ["manager", "kitchen", "manager"],
      category: "alerts",
      title: "New order received",
      description: "Order 100 is waiting.",
    });

    expect(row.audienceRoles).toEqual(["manager", "kitchen"]);
    expect(prismaMock.platformTrackerDocument.upsert).toHaveBeenCalledOnce();
  });

  it("filters the notification feed by role", async () => {
    const { listStaffNotifications } = await import("../services/notification.service.js");

    prismaMock.platformTrackerDocument.findMany.mockResolvedValueOnce([
      {
        payload: {
          id: "notif-1",
          restaurantId: "resto-1",
          audienceRoles: ["manager", "kitchen"],
          category: "alerts",
          title: "Kitchen order",
          description: "Order pending",
          createdAt: "2026-04-16T00:00:00.000Z",
        },
      },
      {
        payload: {
          id: "notif-2",
          restaurantId: "resto-1",
          audienceRoles: ["cashier"],
          category: "updates",
          title: "Cashier order",
          description: "Order ready",
          createdAt: "2026-04-16T00:01:00.000Z",
        },
      },
    ]);

    const managerRows = await listStaffNotifications({
      restaurantId: "resto-1",
      role: "manager",
    });

    expect(managerRows).toHaveLength(1);
    expect(managerRows[0]?.id).toBe("notif-1");
  });
});
