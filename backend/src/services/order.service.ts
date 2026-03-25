import { prisma } from "../prisma.js";
import type { BillingRestaurantRecord } from "./billing.service.js";
import { getRestaurantLimitStatus, incrementRestaurantUsage } from "./billing.service.js";
import {
  handleOrderStatusWhatsAppNotifications,
  registerOrderWhatsAppPreference,
  sendOrderPlacedMessage,
} from "./whatsapp.service.js";
import { recordActivityEvent } from "./activity.service.js";
import { getBranchDishStockOverride } from "./stock.service.js";
import { deductInventoryForOrderTransition } from "./inventory.service.js";

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
  const dishes = (await prisma.dish.findMany({
    where: {
      restaurantId: input.restaurantId,
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
    if (stockOverride?.availability_status === "unavailable" || stockOverride?.hidden_from_public_menu) {
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
        itemsCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount,
        branchId,
      },
    },
  });

  await incrementRestaurantUsage(restaurant as BillingRestaurantRecord, "ordersPerMonth", 1);
  await recordActivityEvent({
    actorUserId: restaurant.ownerUserId,
    actorRole: "restaurant_owner",
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
      itemsCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
      tableNumber: input.tableNumber || null,
      customerName: input.customerName || null,
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

  return { order, totalAmount };
}

export async function getRestaurantOrders(input: {
  restaurantId: string;
  status?: "pending" | "confirmed" | "preparing" | "ready" | "completed";
}) {
  return prisma.order.findMany({
    where: {
      restaurantId: input.restaurantId,
      ...(input.status ? { status: input.status } : {}),
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateRestaurantOrderStatus(input: {
  restaurantId: string;
  orderId: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed";
  actorUserId?: string;
  actorRole?: "platform_admin" | "restaurant_owner" | "restaurant_manager" | "staff";
}) {
  const existing = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    select: { id: true, status: true, paymentStatus: true },
  });
  if (!existing) {
    throw new Error("Order not found.");
  }
  const isStatusChange = existing.status !== input.status;
  if (isStatusChange && (input.status === "confirmed" || input.status === "preparing")) {
    await deductInventoryForOrderTransition({
      restaurantId: input.restaurantId,
      branchId: "main",
      orderId: input.orderId,
      toStatus: input.status,
      actor: input.actorUserId
        ? { userId: input.actorUserId, role: input.actorRole || "restaurant_owner" }
        : undefined,
    });
  }
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: { status: input.status },
    include: { items: true },
  });
  await handleOrderStatusWhatsAppNotifications({
    orderId: order.id,
    restaurantId: input.restaurantId,
    status: input.status,
  });
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: { ownerUserId: true },
  });
  if (!restaurant) {
    throw new Error("Restaurant not found.");
  }
  await recordActivityEvent({
    actorUserId: input.actorUserId || restaurant.ownerUserId,
    actorRole: input.actorRole || "restaurant_owner",
    action: "order_status_changed",
    entityType: "order",
    entityId: order.id,
    organizationId: input.restaurantId,
    restaurantId: input.restaurantId,
    source: "orders_api",
    before: { status: existing.status, paymentStatus: existing.paymentStatus },
    after: { status: order.status, paymentStatus: order.paymentStatus },
  });
  return order;
}
