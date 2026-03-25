export type SharedOrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export const SHARED_ORDER_STATUS_FLOW: SharedOrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export function normalizeOrderStatus(status: string | null | undefined): SharedOrderStatus {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pending" || normalized === "placed") return "placed";
  if (normalized === "confirmed") return "confirmed";
  if (normalized === "preparing") return "preparing";
  if (normalized === "ready") return "ready";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled") return "cancelled";
  return "placed";
}

export function toApiOrderStatus(status: SharedOrderStatus): "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled" {
  return status === "placed" ? "pending" : status;
}

export function getSharedStatusLabel(status: string | null | undefined) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "placed") return "Placed";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "preparing") return "Preparing";
  if (normalized === "ready") return "Ready";
  if (normalized === "completed") return "Completed";
  return "Cancelled";
}

