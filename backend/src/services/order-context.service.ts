import { findRestaurantDocumentByKey, upsertRestaurantDocument } from "./tenant-document.service.js";

const ORDER_CONTEXT_PREFIX = "order_context:";

function orderContextKey(restaurantId: string, orderId: string) {
  return `${ORDER_CONTEXT_PREFIX}${restaurantId}:${orderId}`;
}

export async function setOrderBranchContext(input: {
  restaurantId: string;
  orderId: string;
  branchId?: string | null;
}) {
  const branchId = String(input.branchId || "").trim() || "main";
  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key: orderContextKey(input.restaurantId, input.orderId),
    payload: {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      branchId,
    },
  });
  return branchId;
}

export async function getOrderBranchContext(input: {
  restaurantId: string;
  orderId: string;
}) {
  const row = await findRestaurantDocumentByKey({
    restaurantId: input.restaurantId,
    key: orderContextKey(input.restaurantId, input.orderId),
    select: { payload: true },
  });
  const payload =
    row && row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return String(payload.branchId || "").trim() || "main";
}
