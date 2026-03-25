import { buildCartLines, type Cart } from "./cart";
import type { Dish } from "./dishes";
import { api } from "./api";
import { canCreateOrderWithPlan, recordOrderCreated, recordPaymentUpdate } from "./growth";
import { emitOrderRealtimeEvent } from "./orders-realtime";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

export type OrderPaymentMethod = "manual_mpesa" | "stk_push";
export type OrderSource = "customer" | "admin" | "waiter";

export type OrderItem = {
  dishId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type Order = {
  id: string;
  restaurantId?: string;
  restaurantSlug?: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  customerNotes?: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: OrderPaymentMethod;
  paymentReference: string;
  source?: OrderSource;
  takenByWaiterId?: string;
  takenByWaiterName?: string;
};

export type PublicOrderTracking = {
  id: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentReference: string;
  customerName?: string | null;
  customerPhone?: string | null;
  tableNumber?: string | null;
  estimatedMinutes?: number;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    phone?: string | null;
    location?: string | null;
  };
  items: Array<{
    id: string;
    dishId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
};

export type StorefrontCreateOrderPayload = {
  restaurantId: string;
  branchId?: string;
  restaurantSlug?: string;
  items: Array<{ dishId: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
  whatsappNumber?: string;
  whatsappOptIn?: boolean;
  tableNumber?: string;
  customerNotes?: string;
  createdAt?: string;
  status?: OrderStatus;
  paymentMethod?: OrderPaymentMethod;
  paymentReference?: string;
  paymentStatus?: string;
  source?: OrderSource;
  takenByWaiterId?: string;
  takenByWaiterName?: string;
  itemSnapshots?: Array<{
    dishId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotalAmount?: number;
  totalAmount?: number;
};

export const ORDERS_KEY = "mv_orders_v1";
const ORDER_TRACKING_TOKENS_KEY = "mv_order_tracking_tokens_v1";

type LooseRecord = Record<string, unknown>;

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== "object") return {};
  return value as LooseRecord;
}

function writeCache(orders: Order[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function readTrackingTokens(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_TRACKING_TOKENS_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [orderId, token] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof token !== "string" || !token.trim()) continue;
      out[String(orderId)] = token.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function writeTrackingTokens(tokens: Record<string, string>) {
  localStorage.setItem(ORDER_TRACKING_TOKENS_KEY, JSON.stringify(tokens));
}

function saveOrderTrackingToken(orderId: string, token: string) {
  if (!orderId || !token) return;
  const existing = readTrackingTokens();
  existing[orderId] = token;
  writeTrackingTokens(existing);
}

export function getOrderTrackingToken(orderId: string) {
  const row = readTrackingTokens();
  return row[String(orderId || "").trim()] || "";
}

function sortOrders(rows: Order[]) {
  return [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function mergeOrders(existing: Order[], incoming: Order[]) {
  const byId = new Map<string, Order>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);
  return sortOrders([...byId.values()]);
}

function normalizeOrderItem(value: unknown): OrderItem | null {
  const row = toRecord(value);
  const dishId = String(row.dishId || "");
  if (!dishId) return null;
  const quantity = Math.max(1, Math.floor(Number(row.quantity || 1)));
  const unitPrice = Number(row.priceSnapshot ?? row.unitPrice ?? 0);
  const subtotal = Number(row.subtotal ?? quantity * unitPrice);
  return {
    dishId,
    name: String(row.nameSnapshot ?? row.name ?? dishId),
    quantity,
    unitPrice,
    subtotal: Number.isFinite(subtotal) ? subtotal : quantity * unitPrice,
  };
}

function sanitizeOrder(value: unknown): Order | null {
  const row = toRecord(value);
  const id = String(row.id || "");
  if (!id) return null;
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems
    .map((item) => normalizeOrderItem(item))
    .filter((item): item is OrderItem => !!item);
  const totalFromItems = items.reduce((sum, item) => sum + item.subtotal, 0);
  const subtotal = Number(row.subtotalAmount ?? row.subtotal ?? totalFromItems);
  const total = Number(row.totalAmount ?? row.total ?? totalFromItems);
  const statusValue = String(row.status || "pending").toLowerCase();
  const status: OrderStatus = ORDER_STATUS_OPTIONS.includes(statusValue as OrderStatus)
    ? (statusValue as OrderStatus)
    : "pending";
  const paymentMethod = String(row.paymentMethod || "").toLowerCase() === "stk_push" ? "stk_push" : "manual_mpesa";
  const sourceValue = String(row.source || "").toLowerCase();
  const source: OrderSource = sourceValue === "admin" ? "admin" : sourceValue === "waiter" ? "waiter" : "customer";
  return {
    id,
    restaurantId: String(row.restaurantId || "") || undefined,
    restaurantSlug: String(row.restaurantSlug || "") || undefined,
    createdAt: String(row.createdAt || new Date().toISOString()),
    items,
    subtotal: Number.isFinite(subtotal) ? subtotal : totalFromItems,
    total: Number.isFinite(total) ? total : totalFromItems,
    customerName: String(row.customerName || "") || undefined,
    customerPhone: String(row.customerPhone || "") || undefined,
    tableNumber: String(row.tableNumber || "") || undefined,
    customerNotes: String(row.customerNotes || "") || undefined,
    status,
    paymentStatus: String(row.paymentStatus || "unpaid"),
    paymentMethod,
    paymentReference: String(row.paymentReference || ""),
    source,
    takenByWaiterId: String(row.takenByWaiterId || "") || undefined,
    takenByWaiterName: String(row.takenByWaiterName || "") || undefined,
  };
}

function readCache(): Order[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return sortOrders(
      raw
      .map((row) => sanitizeOrder(row))
      .filter((row): row is Order => !!row)
    );
  } catch {
    return [];
  }
}

function mapOrder(row: unknown): Order {
  return (
    sanitizeOrder(row) || {
      id: createOrderId(),
      createdAt: new Date().toISOString(),
      items: [],
      subtotal: 0,
      total: 0,
      status: "pending",
      paymentStatus: "unpaid",
      paymentMethod: "manual_mpesa",
      paymentReference: "",
      source: "customer",
      takenByWaiterId: undefined,
      takenByWaiterName: undefined,
    }
  );
}

function toServerOrderPayload(order: Order) {
  return {
    id: order.id,
    restaurantId: order.restaurantId,
    restaurantSlug: order.restaurantSlug || "",
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      dishId: item.dishId,
      nameSnapshot: item.name,
      priceSnapshot: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    subtotalAmount: order.subtotal,
    totalAmount: order.total,
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    tableNumber: order.tableNumber || "",
    customerNotes: order.customerNotes || "",
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference || order.id,
    source: order.source || "customer",
    takenByWaiterId: order.takenByWaiterId || "",
    takenByWaiterName: order.takenByWaiterName || "",
    status: order.status,
  };
}

export function createOrderId() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MV4-${stamp}-${rand}`;
}

export async function loadOrders(params?: { restaurantId?: string; status?: OrderStatus }): Promise<Order[]> {
  try {
    const query = new URLSearchParams();
    if (params?.restaurantId) query.set("restaurantId", params.restaurantId);
    if (params?.status) query.set("status", params.status);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const rows = await api.get<unknown[]>(`/orders${suffix}`);
    const mapped = rows.map(mapOrder);
    writeCache(mergeOrders(readCache(), mapped));
    return mapped.filter((order) => {
      if (params?.restaurantId && order.restaurantId !== params.restaurantId) return false;
      if (params?.status && order.status !== params.status) return false;
      return true;
    });
  } catch {
    const cached = readCache();
    return cached.filter((order) => {
      if (params?.restaurantId && order.restaurantId !== params.restaurantId) return false;
      if (params?.status && order.status !== params.status) return false;
      return true;
    });
  }
}

export function saveOrders(orders: Order[]) {
  writeCache(orders);
}

export function createPaymentReference() {
  return `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function getPaymentMethodLabel(method: OrderPaymentMethod) {
  return method === "manual_mpesa" ? "Manual M-Pesa" : "STK Push";
}

export function buildOrderItemsFromCart(
  cart: Cart,
  dishes: Dish[],
  priceResolver: (dish: Dish) => number
) {
  return buildCartLines(cart, dishes, priceResolver).map((line) => ({
    dishId: line.dishId,
    name: line.dish.name,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    subtotal: line.subtotal,
  }));
}

export function getOrderTotal(items: OrderItem[]) {
  return items.reduce((sum, row) => sum + row.subtotal, 0);
}

export async function createOrderFromCart(
  cart: Cart,
  dishes: Dish[],
  priceResolver: (dish: Dish) => number,
  paymentMethod: OrderPaymentMethod,
  paymentReference: string,
  fixedOrderId?: string
): Promise<Order | null> {
  const items = buildOrderItemsFromCart(cart, dishes, priceResolver);
  if (!items.length) return null;
  const total = getOrderTotal(items);
  const id = fixedOrderId || createOrderId();
  const reference = paymentMethod === "manual_mpesa" ? (paymentReference.trim() || id) : paymentReference.trim();
  return {
    id,
    createdAt: new Date().toISOString(),
    items,
    subtotal: total,
    total,
    status: "pending",
    paymentStatus: "pending",
    paymentMethod,
    paymentReference: reference,
  };
}

export async function createAndStoreOrderFromCart(
  cart: Cart,
  dishes: Dish[],
  priceResolver: (dish: Dish) => number,
  paymentMethod: OrderPaymentMethod,
  paymentReference: string,
  fixedOrderId?: string
) {
  const order = await createOrderFromCart(
    cart,
    dishes,
    priceResolver,
    paymentMethod,
    paymentReference,
    fixedOrderId
  );
  if (!order) return null;

  try {
    const response = await api.post<unknown>("/orders/admin", toServerOrderPayload(order));
    const saved = mapOrder(response);
    const next = [saved, ...readCache().filter((item) => item.id !== saved.id)];
    writeCache(next);
    return saved;
  } catch {
    const next = [order, ...readCache().filter((item) => item.id !== order.id)];
    writeCache(next);
    return order;
  }
}

function createLocalStorefrontOrder(payload: StorefrontCreateOrderPayload): Order {
  const id = createOrderId();
  const items: OrderItem[] = (payload.itemSnapshots || payload.items).map((item) => {
    const row = toRecord(item);
    const quantity = Math.max(1, Math.floor(Number(row.quantity || 1)));
    const unitPrice = Number(row.unitPrice || 0);
    const subtotal = Number(row.subtotal || quantity * unitPrice);
    return {
      dishId: String(row.dishId || ""),
      name: String(row.name || row.dishId || "Dish"),
      quantity,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      subtotal: Number.isFinite(subtotal) ? subtotal : quantity * (Number.isFinite(unitPrice) ? unitPrice : 0),
    };
  });
  const total = Number(payload.totalAmount ?? items.reduce((sum, item) => sum + item.subtotal, 0));
  const subtotal = Number(payload.subtotalAmount ?? total);
  return {
    id,
    restaurantId: payload.restaurantId,
    restaurantSlug: payload.restaurantSlug?.trim() || undefined,
    createdAt: payload.createdAt || new Date().toISOString(),
    items,
    subtotal: Number.isFinite(subtotal) ? subtotal : Number.isFinite(total) ? total : 0,
    total: Number.isFinite(total) ? total : 0,
    customerName: payload.customerName?.trim() || undefined,
    customerPhone: payload.customerPhone?.trim() || undefined,
    tableNumber: payload.tableNumber?.trim() || undefined,
    customerNotes: payload.customerNotes?.trim() || undefined,
    status: payload.status || "pending",
    paymentStatus: String(payload.paymentStatus || "unpaid"),
    paymentMethod: payload.paymentMethod === "stk_push" ? "stk_push" : "manual_mpesa",
    paymentReference: String(payload.paymentReference || id),
    source: payload.source || "customer",
    takenByWaiterId: payload.takenByWaiterId?.trim() || undefined,
    takenByWaiterName: payload.takenByWaiterName?.trim() || undefined,
  };
}

export async function createStorefrontOrder(payload: StorefrontCreateOrderPayload): Promise<string> {
  const orderLimitGate = canCreateOrderWithPlan(payload.restaurantId);
  if (!orderLimitGate.allowed) throw new Error(orderLimitGate.reason);
  const trimmedPayload = {
    restaurantId: payload.restaurantId,
    branchId: payload.branchId?.trim() || "",
    restaurantSlug: payload.restaurantSlug?.trim() || "",
    items: payload.items,
    subtotalAmount: payload.subtotalAmount ?? payload.totalAmount ?? 0,
    totalAmount: payload.totalAmount ?? 0,
    customerName: payload.customerName?.trim() || "",
    customerPhone: payload.customerPhone?.trim() || "",
    whatsappNumber: payload.whatsappNumber?.trim() || "",
    whatsappOptIn: Boolean(payload.whatsappOptIn),
    tableNumber: payload.tableNumber?.trim() || "",
    customerNotes: payload.customerNotes?.trim() || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    status: payload.status || "pending",
    paymentMethod: payload.paymentMethod || "manual_mpesa",
    paymentReference: payload.paymentReference?.trim() || "",
    paymentStatus: payload.paymentStatus?.trim() || "",
    source: payload.source || "customer",
    takenByWaiterId: payload.takenByWaiterId?.trim() || "",
    takenByWaiterName: payload.takenByWaiterName?.trim() || "",
  };
  try {
    const response = await api.post<unknown>("/orders", trimmedPayload);
    const row = toRecord(response);
    const orderId = String(row.orderId || row.id || "");
    if (!orderId) throw new Error("Order was created but no order ID was returned.");
    const trackingToken = String(row.trackingToken || "").trim();
    if (trackingToken) saveOrderTrackingToken(orderId, trackingToken);

    const localOrder = createLocalStorefrontOrder(payload);
    localOrder.id = orderId;
    const next = [localOrder, ...readCache().filter((order) => order.id !== orderId)];
    writeCache(next);
    recordOrderCreated(localOrder.restaurantId || payload.restaurantId, localOrder.total, localOrder.createdAt);
    emitOrderRealtimeEvent({
      restaurantId: localOrder.restaurantId || payload.restaurantId,
      orderId,
      reason: "order_created",
    });
    return orderId;
  } catch {
    const order = createLocalStorefrontOrder(payload);
    const next = [order, ...readCache().filter((item) => item.id !== order.id)];
    writeCache(next);
    recordOrderCreated(order.restaurantId || payload.restaurantId, order.total, order.createdAt);
    emitOrderRealtimeEvent({
      restaurantId: order.restaurantId || payload.restaurantId,
      orderId: order.id,
      reason: "order_created_offline",
    });
    return order.id;
  }
}

export function setLocalStorefrontOrderPayment(
  orderId: string,
  restaurantId: string,
  payment: {
    paymentMethod?: OrderPaymentMethod;
    paymentStatus?: string;
    paymentReference?: string;
  }
) {
  const next = readCache().map((order) => {
    if (order.id !== orderId || order.restaurantId !== restaurantId) return order;
    return {
      ...order,
      paymentMethod: payment.paymentMethod || order.paymentMethod,
      paymentStatus: payment.paymentStatus || order.paymentStatus,
      paymentReference: payment.paymentReference || order.paymentReference || order.id,
    };
  });
  writeCache(next);
  const updated = next.find((order) => order.id === orderId && order.restaurantId === restaurantId) || null;
  if (updated) {
    recordPaymentUpdate(updated, payment.paymentStatus);
    emitOrderRealtimeEvent({
      restaurantId,
      orderId,
      reason: "payment_updated",
    });
  }
  return updated;
}

export async function getStorefrontOrder(orderId: string, restaurantId: string): Promise<Order> {
  try {
    const response = await api.get<unknown>(
      `/orders/${encodeURIComponent(orderId)}?restaurantId=${encodeURIComponent(restaurantId)}`
    );
    const mapped = mapOrder(response);
    const next = [mapped, ...readCache().filter((order) => order.id !== mapped.id)];
    writeCache(next);
    return mapped;
  } catch {
    const row = readCache().find((order) => order.id === orderId && order.restaurantId === restaurantId);
    if (!row) throw new Error("Order not found.");
    return row;
  }
}

export async function getPublicOrderTracking(orderId: string, trackingToken?: string): Promise<PublicOrderTracking> {
  try {
    const effectiveToken = String(trackingToken || "").trim() || getOrderTrackingToken(orderId);
    if (effectiveToken) {
      saveOrderTrackingToken(orderId, effectiveToken);
    }
    const suffix = effectiveToken ? `?token=${encodeURIComponent(effectiveToken)}` : "";
    const response = await api.get<unknown>(`/orders/${encodeURIComponent(orderId)}/public${suffix}`);
    const row = toRecord(response);
    const items = Array.isArray(row.items)
      ? row.items
          .map((value) => {
            const item = toRecord(value);
            return {
              id: String(item.id || ""),
              dishId: String(item.dishId || ""),
              name: String(item.name || "Dish"),
              quantity: Number(item.quantity || 0),
              unitPrice: Number(item.unitPrice || 0),
              subtotal: Number(item.subtotal || 0),
            };
          })
          .filter((item) => item.id && item.dishId && item.quantity > 0)
      : [];
    const restaurant = toRecord(row.restaurant);
    return {
      id: String(row.id || orderId),
      status: String(row.status || "pending"),
      createdAt: String(row.createdAt || new Date().toISOString()),
      totalAmount: Number(row.totalAmount || 0),
      paymentStatus: String(row.paymentStatus || "pending"),
      paymentMethod: String(row.paymentMethod || "manual_mpesa"),
      paymentReference: String(row.paymentReference || ""),
      customerName: row.customerName ? String(row.customerName) : null,
      customerPhone: row.customerPhone ? String(row.customerPhone) : null,
      tableNumber: row.tableNumber ? String(row.tableNumber) : null,
      estimatedMinutes: Number.isFinite(Number(row.estimatedMinutes)) ? Number(row.estimatedMinutes) : undefined,
      restaurant: {
        id: String(restaurant.id || ""),
        name: String(restaurant.name || "Restaurant"),
        slug: String(restaurant.slug || ""),
        phone: restaurant.phone ? String(restaurant.phone) : null,
        location: restaurant.location ? String(restaurant.location) : null,
      },
      items,
    };
  } catch {
    const cached = readCache().find((order) => order.id === orderId);
    if (!cached) throw new Error("Order not found.");
    return {
      id: cached.id,
      status: cached.status,
      createdAt: cached.createdAt,
      totalAmount: cached.total,
      paymentStatus: cached.paymentStatus,
      paymentMethod: cached.paymentMethod,
      paymentReference: cached.paymentReference,
      customerName: cached.customerName || null,
      customerPhone: cached.customerPhone || null,
      tableNumber: cached.tableNumber || null,
      restaurant: {
        id: cached.restaurantId || "local_restaurant",
        name: "Restaurant",
        slug: cached.restaurantSlug || "demo",
        phone: null,
        location: null,
      },
      items: cached.items.map((item, index) => ({
        id: `${cached.id}-${index}`,
        dishId: item.dishId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
    };
  }
}

export async function getRecentOrders(limit = 5, params?: { restaurantId?: string; status?: OrderStatus }) {
  const orders = await loadOrders(params);
  return orders.slice(0, Math.max(0, Math.floor(limit)));
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  params?: { restaurantId?: string }
) {
  const matchesRestaurant = (order: Order) => {
    if (!params?.restaurantId) return true;
    return order.restaurantId === params.restaurantId;
  };
  try {
    const response = await api.patch<unknown>(`/orders/${orderId}/status`, {
      status,
      ...(params?.restaurantId ? { restaurantId: params.restaurantId } : {}),
    });
    const updated = mapOrder(response);
    const next = readCache().map((order) =>
      order.id === orderId && matchesRestaurant(order) ? { ...order, ...updated } : order
    );
    writeCache(next);
    emitOrderRealtimeEvent({
      restaurantId: params?.restaurantId,
      orderId,
      reason: "status_updated",
    });
    return next;
  } catch {
    const next = readCache().map((order) =>
      order.id === orderId && matchesRestaurant(order) ? { ...order, status } : order
    );
    writeCache(next);
    emitOrderRealtimeEvent({
      restaurantId: params?.restaurantId,
      orderId,
      reason: "status_updated_offline",
    });
    return next;
  }
}
