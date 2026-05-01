import { platformApi, type StorefrontCreateOrderPayload } from "./platform-api";
import { initializeStorefrontPaymentShell, type StorefrontPaymentMethod } from "../lib/storefront-payments";
import { getOrderTrackingToken } from "../lib/orders";
import { platformStore } from "../state/platform-store";
import type { OrderStatus } from "../types/dashboard";
import { emitAutomationEvent, getCurrentBranchId } from "./automation-engine";

type PlaceOrderWorkflowInput = {
  restaurant: {
    id: string;
    name: string;
    slug?: string;
  };
  payload: StorefrontCreateOrderPayload;
  paymentMethod: StorefrontPaymentMethod;
  analyticsSource: string;
  analyticsMetadata?: Record<string, unknown>;
};

export async function placeStorefrontOrderWorkflow(input: PlaceOrderWorkflowInput) {
  const orderId = await platformApi.orders.createStorefrontOrder(input.payload);
  platformStore.setSessionContext({ restaurantId: input.restaurant.id, role: "customer" });
  platformStore.recordWorkflowEvent({
    restaurantId: input.restaurant.id,
    orderId,
    role: "customer",
    stage: "order_created",
    message: "Customer order created and added to restaurant queue.",
  });
  platformStore.upsertOrderStatus(orderId, "pending");

  const paymentShell = initializeStorefrontPaymentShell({
    orderId,
    restaurantId: input.restaurant.id,
    method: input.paymentMethod,
    customerPhone: input.payload.customerPhone,
  });
  platformStore.recordWorkflowEvent({
    restaurantId: input.restaurant.id,
    orderId,
    role: "customer",
    stage: "payment_pending",
    message: `Payment initialized via ${input.paymentMethod}.`,
    metadata: {
      paymentReference: paymentShell.paymentReference,
      paymentStatus: paymentShell.paymentStatus,
    },
  });

  const liveOrder = await platformApi.orders.getStorefrontOrder(orderId, input.restaurant.id).catch(() => null);
  if (liveOrder) {
    await emitAutomationEvent({
      type: "ORDER_CREATED",
      context: {
        restaurantId: input.restaurant.id,
        branchId: getCurrentBranchId(),
        role: "customer",
        order: {
          id: liveOrder.id,
          createdAt: liveOrder.createdAt,
          customerName: liveOrder.customerName,
          customerPhone: liveOrder.customerPhone,
          tableNumber: liveOrder.tableNumber,
          customerNotes: liveOrder.customerNotes,
          paymentStatus: liveOrder.paymentStatus,
          paymentMethod: liveOrder.paymentMethod,
          paymentReference: liveOrder.paymentReference,
          subtotal: liveOrder.subtotal,
          total: liveOrder.total,
          status: liveOrder.status,
          items: liveOrder.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.subtotal,
          })),
        },
      },
    });
  }
  if (liveOrder) {
    platformStore.recordWorkflowEvent({
      restaurantId: input.restaurant.id,
      orderId,
      role: "manager",
      stage: "order_assigned",
      message: "Automation engine queued order-created automations.",
    });
  }

  await platformApi.analytics.trackEvent({
    restaurantId: input.restaurant.id,
    eventType: "order_placed",
    orderId,
    source: input.analyticsSource,
    metadata: input.analyticsMetadata,
  });

  if (typeof window !== "undefined") {
    sessionStorage.setItem(`ubhona:auto_printed_order:${orderId}`, "1");
  }

  return { orderId, paymentShell, trackingToken: getOrderTrackingToken(orderId) || undefined };
}

export async function updateOrderStatusWorkflow(input: {
  restaurantId: string;
  orderId: string;
  status: OrderStatus;
  role: "owner" | "admin" | "manager" | "waiter" | "kitchen" | "cashier";
}) {
  const previousStatus = platformStore.getState().orderStatusById[input.orderId] || "";
  await platformApi.orders.setStatus(input.restaurantId, input.orderId, input.status);
  platformStore.setSessionContext({ restaurantId: input.restaurantId, role: input.role });
  platformStore.upsertOrderStatus(input.orderId, input.status);
  platformStore.recordWorkflowEvent({
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    role: input.role,
    stage: input.status === "completed" ? "order_completed" : input.status === "cancelled" ? "order_cancelled" : "order_assigned",
    message: `Order moved to ${input.status}.`,
  });
  void platformApi.orders
    .getStorefrontOrder(input.orderId, input.restaurantId)
    .then((updated) =>
      emitAutomationEvent({
        type: "ORDER_STATUS_CHANGED",
        context: {
          restaurantId: input.restaurantId,
          branchId: getCurrentBranchId(),
          role: input.role,
          order: {
            id: updated.id,
            createdAt: updated.createdAt,
            customerName: updated.customerName,
            customerPhone: updated.customerPhone,
            tableNumber: updated.tableNumber,
            customerNotes: updated.customerNotes,
            paymentStatus: updated.paymentStatus,
            paymentMethod: updated.paymentMethod,
            paymentReference: updated.paymentReference,
            subtotal: updated.subtotal,
            total: updated.total,
            status: updated.status,
            items: updated.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.subtotal,
            })),
          },
          before: { status: previousStatus || undefined },
          after: { status: updated.status },
        },
      })
    )
    .catch(() => undefined);
}
