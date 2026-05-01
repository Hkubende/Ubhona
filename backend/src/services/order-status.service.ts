export const ORDER_STATUS_VALUES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type OrderLifecycleStatus = (typeof ORDER_STATUS_VALUES)[number];

const ORDER_STATUS_TRANSITIONS: Record<OrderLifecycleStatus, readonly OrderLifecycleStatus[]> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isOrderLifecycleStatus(value: unknown): value is OrderLifecycleStatus {
  return ORDER_STATUS_VALUES.includes(String(value || "").trim().toLowerCase() as OrderLifecycleStatus);
}

export function getAllowedOrderStatusTransitions(status: OrderLifecycleStatus): readonly OrderLifecycleStatus[] {
  return ORDER_STATUS_TRANSITIONS[status];
}

export function assertValidOrderStatusTransition(current: string, next: string) {
  const normalizedCurrent = String(current || "").trim().toLowerCase();
  const normalizedNext = String(next || "").trim().toLowerCase();

  if (!isOrderLifecycleStatus(normalizedCurrent)) {
    throw new Error(`Unsupported current order status: ${current}`);
  }
  if (!isOrderLifecycleStatus(normalizedNext)) {
    throw new Error(`Unsupported target order status: ${next}`);
  }

  if (normalizedCurrent === normalizedNext) return;

  const allowedTransitions = getAllowedOrderStatusTransitions(normalizedCurrent);
  if (allowedTransitions.includes(normalizedNext)) return;

  throw new Error(
    `Invalid order status transition from ${normalizedCurrent} to ${normalizedNext}. Allowed: ${
      allowedTransitions.length ? allowedTransitions.join(", ") : "none"
    }.`,
  );
}
