import { listRestaurantDocuments, upsertRestaurantDocument } from "./tenant-document.service.js";

export const STAFF_NOTIFICATION_ROLES = ["owner", "admin", "manager", "waiter", "kitchen", "cashier"] as const;
export const STAFF_NOTIFICATION_CATEGORIES = ["updates", "alerts", "reminders"] as const;

export type StaffNotificationRole = (typeof STAFF_NOTIFICATION_ROLES)[number];
export type StaffNotificationCategory = (typeof STAFF_NOTIFICATION_CATEGORIES)[number];

export type StaffNotification = {
  id: string;
  restaurantId: string;
  audienceRoles: StaffNotificationRole[];
  category: StaffNotificationCategory;
  title: string;
  description: string;
  createdAt: string;
  orderId?: string | null;
};

const PREFIX = "staff_notification:";

function notificationKey(restaurantId: string, id: string) {
  return `${PREFIX}${restaurantId}:${id}`;
}

function nowIso() {
  return new Date().toISOString();
}

function rid() {
  return `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapNotification(payload: unknown): StaffNotification | null {
  const row = asRecord(payload);
  const id = String(row.id || "");
  const restaurantId = String(row.restaurantId || "");
  const category = String(row.category || "").trim().toLowerCase();
  if (!id || !restaurantId) return null;
  if (!STAFF_NOTIFICATION_CATEGORIES.includes(category as StaffNotificationCategory)) return null;
  const audienceRoles = Array.isArray(row.audienceRoles)
    ? row.audienceRoles
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value): value is StaffNotificationRole => STAFF_NOTIFICATION_ROLES.includes(value as StaffNotificationRole))
    : [];
  return {
    id,
    restaurantId,
    audienceRoles,
    category: category as StaffNotificationCategory,
    title: String(row.title || ""),
    description: String(row.description || ""),
    createdAt: String(row.createdAt || nowIso()),
    orderId: row.orderId == null ? null : String(row.orderId),
  };
}

export function isStaffNotificationRole(value: unknown): value is StaffNotificationRole {
  return STAFF_NOTIFICATION_ROLES.includes(String(value || "").trim().toLowerCase() as StaffNotificationRole);
}

export async function createStaffNotification(input: {
  restaurantId: string;
  audienceRoles: StaffNotificationRole[];
  category: StaffNotificationCategory;
  title: string;
  description: string;
  orderId?: string | null;
}) {
  const id = rid();
  const notification: StaffNotification = {
    id,
    restaurantId: input.restaurantId,
    audienceRoles: [...new Set(input.audienceRoles)].filter((role) => isStaffNotificationRole(role)),
    category: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    createdAt: nowIso(),
    orderId: input.orderId || null,
  };
  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key: notificationKey(input.restaurantId, id),
    payload: notification,
  });
  return notification;
}

export async function listStaffNotifications(input: {
  restaurantId: string;
  role?: StaffNotificationRole;
  limit?: number;
}) {
  const rows = await listRestaurantDocuments({
    restaurantId: input.restaurantId,
    keyPrefix: `${PREFIX}${input.restaurantId}:`,
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(100, Number(input.limit || 20))),
  });
  return rows
    .map((row) => mapNotification(row.payload))
    .filter((row): row is StaffNotification => !!row)
    .filter((row) => (input.role ? row.audienceRoles.includes(input.role) : true));
}

export async function createOrderLifecycleNotifications(input: {
  restaurantId: string;
  orderId: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  tableNumber?: string | null;
  customerName?: string | null;
}) {
  const label = input.tableNumber ? `Table ${input.tableNumber}` : input.customerName?.trim() || "Guest order";
  if (input.status === "pending") {
    return Promise.all([
      createStaffNotification({
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        audienceRoles: ["manager", "kitchen"],
        category: "alerts",
        title: "New order received",
        description: `${label} created order ${input.orderId} and it is waiting for confirmation.`,
      }),
      createStaffNotification({
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        audienceRoles: ["waiter"],
        category: "updates",
        title: "Order added to service queue",
        description: `${label} is now visible on the staff board.`,
      }),
    ]);
  }
  if (input.status === "ready") {
    return Promise.all([
      createStaffNotification({
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        audienceRoles: ["waiter", "cashier", "manager"],
        category: "alerts",
        title: "Order ready to serve",
        description: `${label} is marked ready for serving or payment handling.`,
      }),
    ]);
  }
  if (input.status === "cancelled") {
    return Promise.all([
      createStaffNotification({
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        audienceRoles: ["manager", "kitchen", "waiter", "cashier"],
        category: "updates",
        title: "Order cancelled",
        description: `${label} was cancelled and removed from the active workflow.`,
      }),
    ]);
  }
  return Promise.all([
    createStaffNotification({
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      audienceRoles: ["manager"],
      category: "updates",
      title: `Order ${input.status}`,
      description: `${label} moved to ${input.status}.`,
    }),
  ]);
}
