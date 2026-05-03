import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  restaurant: { findUnique: vi.fn() },
  dish: { findMany: vi.fn() },
  order: { create: vi.fn() },
  analyticsEvent: { create: vi.fn() },
};

const runWithPublicStorefrontDbContextMock = vi.fn(async (_restaurantId, fn) => fn());
const runWithTenantContextMock = vi.fn();
const getRestaurantLimitStatusMock = vi.fn();
const incrementRestaurantUsageMock = vi.fn();
const registerOrderWhatsAppPreferenceMock = vi.fn();
const sendOrderPlacedMessageMock = vi.fn();
const handleOrderStatusWhatsAppNotificationsMock = vi.fn();
const recordActivityEventMock = vi.fn();
const getBranchDishStockOverrideMock = vi.fn();
const deductInventoryForOrderTransitionMock = vi.fn();
const assertValidOrderStatusTransitionMock = vi.fn();
const getOrderBranchContextMock = vi.fn();
const setOrderBranchContextMock = vi.fn();
const createOrderLifecycleNotificationsMock = vi.fn();
const getEffectiveDishMenuStateMock = vi.fn();

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
  runWithTenantContext: runWithTenantContextMock,
}));

vi.mock("../db-rls.js", () => ({
  runWithPublicStorefrontDbContext: runWithPublicStorefrontDbContextMock,
}));

vi.mock("../services/billing.service.js", () => ({
  getRestaurantLimitStatus: getRestaurantLimitStatusMock,
  incrementRestaurantUsage: incrementRestaurantUsageMock,
}));

vi.mock("../services/whatsapp.service.js", () => ({
  registerOrderWhatsAppPreference: registerOrderWhatsAppPreferenceMock,
  sendOrderPlacedMessage: sendOrderPlacedMessageMock,
  handleOrderStatusWhatsAppNotifications: handleOrderStatusWhatsAppNotificationsMock,
}));

vi.mock("../services/activity.service.js", () => ({
  recordActivityEvent: recordActivityEventMock,
}));

vi.mock("../services/stock.service.js", () => ({
  getBranchDishStockOverride: getBranchDishStockOverrideMock,
}));

vi.mock("../services/inventory.service.js", () => ({
  deductInventoryForOrderTransition: deductInventoryForOrderTransitionMock,
}));

vi.mock("../services/order-status.service.js", () => ({
  assertValidOrderStatusTransition: assertValidOrderStatusTransitionMock,
}));

vi.mock("../services/order-context.service.js", () => ({
  getOrderBranchContext: getOrderBranchContextMock,
  setOrderBranchContext: setOrderBranchContextMock,
}));

vi.mock("../services/notification.service.js", () => ({
  createOrderLifecycleNotifications: createOrderLifecycleNotificationsMock,
}));

vi.mock("../services/menu-control.service.js", () => ({
  getEffectiveDishMenuState: getEffectiveDishMenuStateMock,
}));

describe("order.service storefront audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.restaurant.findUnique.mockResolvedValue({
      id: "rest-1",
      ownerUserId: "owner-1",
      subscriptionPlan: "growth",
      subscriptionStatus: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      trialEndsAt: null,
      renewalDate: null,
    });
    getRestaurantLimitStatusMock.mockResolvedValue({
      usageLimit: null,
      currentUsage: 5,
      reached: false,
      remaining: null,
    });
    prismaMock.dish.findMany.mockResolvedValue([
      { id: "dish-1", name: "Burger", price: 1200 },
    ]);
    getBranchDishStockOverrideMock.mockResolvedValue(null);
    getEffectiveDishMenuStateMock.mockReturnValue({ isOrderable: true });
    prismaMock.order.create.mockResolvedValue({
      id: "order-1",
      restaurantId: "rest-1",
      status: "pending",
      paymentStatus: "unpaid",
      tableNumber: null,
      customerName: "Alice",
      items: [],
    });
    prismaMock.analyticsEvent.create.mockResolvedValue({ id: "event-1" });
    incrementRestaurantUsageMock.mockResolvedValue(undefined);
    setOrderBranchContextMock.mockResolvedValue(undefined);
    recordActivityEventMock.mockResolvedValue(undefined);
    registerOrderWhatsAppPreferenceMock.mockResolvedValue(undefined);
    sendOrderPlacedMessageMock.mockResolvedValue(undefined);
    createOrderLifecycleNotificationsMock.mockResolvedValue(undefined);
  });

  it("uses an explicit system actor for storefront-created orders", async () => {
    const { createStorefrontOrder } = await import("../services/order.service.js");

    await createStorefrontOrder({
      restaurantId: "rest-1",
      branchId: "main",
      items: [{ dishId: "dish-1", quantity: 2 }],
      customerName: "Alice",
      customerPhone: "254700000001",
      whatsappOptIn: false,
    });

    expect(runWithPublicStorefrontDbContextMock).toHaveBeenCalledWith("rest-1", expect.any(Function));
    expect(recordActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        systemActorKey: "storefront_checkout",
        actorRole: "restaurant_owner",
        action: "order_created",
        entityType: "order",
        source: "storefront_checkout",
      })
    );
    expect(recordActivityEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: expect.anything() })
    );
  });
});
