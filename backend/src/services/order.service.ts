import { prisma } from "../prisma.js";

export type StorefrontOrderInput = {
  restaurantId: string;
  items: Array<{ dishId: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
};

export async function createStorefrontOrder(input: StorefrontOrderInput) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: { id: true },
  });
  if (!restaurant) {
    throw new Error("Restaurant not found.");
  }

  const requestedDishIds = [...new Set(input.items.map((item) => item.dishId))];
  const dishes = await prisma.dish.findMany({
    where: {
      restaurantId: input.restaurantId,
      id: { in: requestedDishIds },
      isAvailable: true,
    },
    select: { id: true, name: true, price: true },
  });
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const invalidDishId = requestedDishIds.find((dishId) => !dishMap.has(dishId));
  if (invalidDishId) {
    throw new Error(`Invalid or unavailable dish: ${invalidDishId}`);
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
      },
    },
  });

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
}) {
  const existing = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Order not found.");
  }
  return prisma.order.update({
    where: { id: existing.id },
    data: { status: input.status },
    include: { items: true },
  });
}
