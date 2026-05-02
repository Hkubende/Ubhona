import { runWithPublicStorefrontDbContext } from "../db-rls.js";
import { prisma, runWithTenantContext } from "../prisma.js";
import type { BillingRestaurantRecord } from "./billing.service.js";
import { getRestaurantLimitStatus, incrementRestaurantUsage } from "./billing.service.js";
import {
  handleOrderStatusWhatsAppNotifications,
  registerOrderWhatsAppPreference,
  sendOrderPlacedMessage,
} from "./whatsapp.service.js";
import { recordActivityEvent } from "./activity.service.js";
import { STOREFRONT_CHECKOUT_SYSTEM_ACTOR_KEY, STOREFRONT_CHECKOUT_SYSTEM_ROLE } from "./system-actors.js";
import { getBranchDishStockOverride } from "./stock.service.js";
import { deductInventoryForOrderTransition } from "./inventory.service.js";
import {
  assertValidOrderStatusTransition,
  type OrderLifecycleStatus,
} from "./order-status.service.js";
import { getOrderBranchContext, setOrderBranchContext } from "./order-context.service.js";
import { createOrderLifecycleNotifications } from "./notification.service.js";
import { getEffectiveDishMenuState } from "./menu-control.service.js";

export type StorefrontOrderInput = {
  restaurantId: string;
  branchId?: string;
  items: Array<{ dishId: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  whatsappOptIn?: boolean;
  whatsappNumber?: string;
};

export async function createStorefrontOrder(input: StorefrontOrderInput) {
  const branchId = String(input.branchId || "").trim() || "main";
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: {
      id: true,
      ownerUserId: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      createdAt: true,
      trialEndsAt: true,
      renewalDate: true,
    },
  });
  if (!restaurant) {
    throw new Error("Restaurant not found.");
  }
  const monthlyOrderLimit = await getRestaurantLimitStatus(restaurant as BillingRestaurantRecord, "ordersPerMonth");
  if (monthlyOrderLimit.reached) {
    throw new Error(
      `Your current plan allows up to ${monthlyOrderLimit.usageLimit} orders/month. Upgrade to continue receiving orders.`
    );
  }

  const requestedDishIds = [...new Set(input.items.map((item) => item.dishId))];
  const { order, totalAmount, itemsCount } = await runWithPublicStorefrontDbContext(input.restaurantId, async () => {
    const dishes = (await prisma.dish.findMany({
      where: {
        id: { in: requestedDishIds },
        isAvailable: true,
      },
      select: { id: true, name: true, price: true },
    })) as Array<{ id: string; name: string; price: number }>;
    const dishMap = new Map<string, { id: string; name: string; price: number }>(
      dishes.map((dish: { id: string; name: string; price: number }) => [dish.id, dish])
    );
    const invalidDishId = requestedDishIds.find((dishId) => !dishMap.has(dishId));
    if (invalidDishId) {
      throw new Error(`Invalid or unavailable dish: ${invalidDishId}`);
    }
    for (const dishId of requestedDishIds) {
      const stockOverride = await getBranchDishStockOverride({
        restaurantId: input.restaurantId,
        branchId,
        dishId,
      });
      const dish = dishMap.get(dishId);
      const menuControl = getEffectiveDishMenuState({
        branchId,
        isAvailable: Boolean(dish),
        stockOverride,
      });
      if (!menuControl.isOrderable) {
        throw new Error(`Dish ${dishId} is unavailable for branch ${branchId}.`);
      }
    }

    const orderItems = input.items.map((item) => {
      const dish = dishMap.get(item.dishId)!;
      const priceSnapshot = Number(dish.price);
      return {
        dishId: item.dishId,
        nameSnapshot: dish.name,
        priceSnapshot,
        quantity: item.quantity,
        subtotal: priceSnapshot * item.quantity,
      };
    });
    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const itemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

    const order = await prisma.order.create({
      data: {
        restaurantId: input.restaurantId,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        tableNumber: input.tableNumber?.trim() || null,
        totalAmount,
        paymentStatus: "unpaid",
        paymentMethod: "manual_mpesa",
        paymentReference: "",
        status: "pending",
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    });

    await prisma.analyticsEvent.create({
      data: {
        restaurantId: input.restaurantId,
        orderId: order.id,
        eventType: "order_created",
        source: "storefront",
        metadata: {
          itemsCount,
          totalAmount,
          branchId,
        },
      },
    });

    return { order, totalAmount, itemsCount };
  });

  await incrementRestaurantUsage(restaurant as BillingRestaurantRecord, "ordersPerMonth", 1);
  await setOrderBranchContext({
    restaurantId: input.restaurantId,
    orderId: order.id,
    branchId,
  });
  await recordActivityEvent({
    systemActorKey: STOREFRONT_CHECKOUT_SYSTEM_ACTOR_KEY,
    actorRole: STOREFRONT_CHECKOUT_SYSTEM_ROLE,
    action: "order_created",
    entityType: "order",
    entityId: order.id,
    organizationId: input.restaurantId,
    restaurantId: input.restaurantId,
    source: "storefront_checkout",
    after: {
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: totalAmount,
      itemsCount,
      tableNumber: input.tableNumber || null,
      customerName: input.customerName || null,
      branchId,
    },
    metadata: {
      actorType: "storefront_checkout",
      branchId,
    },
  });

  await registerOrderWhatsAppPreference({
    orderId: order.id,
    restaurantId: input.restaurantId,
    optedIn: Boolean(input.whatsappOptIn),
    whatsappNumber: input.whatsappNumber || input.customerPhone || null,
    source: "checkout",
  });
  if (input.whatsappOptIn) {
    await sendOrderPlacedMessage(order.id, input.restaurantId);
  }
  await createOrderLifecycleNotifications({
    restaurantId: input.restaurantId,
    orderId: order.id,
    status: "pending",
    tableNumber: order.tableNumber,
    customerName: order.customerName,
  });

  return { order, totalAmount };
}

export async function getRestaurantOrders(input: {
  restaurantId: string;
  status?: OrderLifecycleStatus;
  userId: string;
  isAdmin: boolean;
}) {
  return runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) =>
      tx.order.findMany({
        where: {
          ...(input.status ? { status: input.status } : {}),
        },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
  });
}

export async function updateRestaurantOrderStatus(input: {
  restaurantId: string;
  orderId: string;
  status: OrderLifecycleStatus;
  actorUserId: string;
  actorRole: "platform_admin" | "restaurant_owner" | "restaurant_manager" | "staff";
  isAdmin: boolean;
}) {
  const existing = await runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.actorUserId,
    isAdmin: input.isAdmin,
    fn: async (tx) =>
      tx.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, status: true, paymentStatus: true },
      }),
  });
  if (!existing) {
    throw new Error("Order not found.");
  }
  const isStatusChange = existing.status !== input.status;
  if (isStatusChange) {
    assertValidOrderStatusTransition(existing.status, input.status);
  }
  if (isStatusChange && (input.status === "confirmed" || input.status === "preparing")) {
    try {
      const branchId = await getOrderBranchContext({
        restaurantId: input.restaurantId,
        orderId: input.orderId,
      });
      await deductInventoryForOrderTransition({
        restaurantId: input.restaurantId,
        branchId,
        orderId: input.orderId,
        toStatus: input.status,
        actor: { userId: input.actorUserId, role: input.actorRole },
      });
    } catch (error) {
      console.warn("[orders] inventory deduction skipped during status update", {
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        status: input.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const order = await runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.actorUserId,
    isAdmin: input.isAdmin,
    fn: async (tx) =>
      tx.order.update({
        where: { id: existing.id },
        data: { status: input.status },
        include: { items: true },
      }),
  });

  // Status persistence is authoritative; post-update notifications/audit should not hold the HTTP response open.
  void (async () => {
    try {
      await handleOrderStatusWhatsAppNotifications({
        orderId: order.id,
        restaurantId: input.restaurantId,
        status: input.status,
      });
    } catch (error) {
      console.warn("[orders] whatsapp status notification skipped after status update", {
        restaurantId: input.restaurantId,
        orderId: order.id,
        status: input.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await createOrderLifecycleNotifications({
        restaurantId: input.restaurantId,
        orderId: order.id,
        status: input.status,
        tableNumber: (order as { tableNumber?: string | null }).tableNumber || null,
        customerName: (order as { customerName?: string | null }).customerName || null,
      });
    } catch (error) {
      console.warn("[orders] staff notification skipped after status update", {
        restaurantId: input.restaurantId,
        orderId: order.id,
        status: input.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await recordActivityEvent({
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "order_status_changed",
        entityType: "order",
        entityId: order.id,
        organizationId: input.restaurantId,
        restaurantId: input.restaurantId,
        source: "orders_api",
        before: { status: existing.status, paymentStatus: existing.paymentStatus },
        after: { status: order.status, paymentStatus: order.paymentStatus },
      });
    } catch (error) {
      console.warn("[orders] activity log skipped after status update", {
        restaurantId: input.restaurantId,
        orderId: order.id,
        status: input.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return order;
}