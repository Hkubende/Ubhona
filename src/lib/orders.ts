import { buildCartLines, type Cart } from "./cart";
import type { Dish } from "./dishes";
import { api } from "./api";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed";
export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
];

export type OrderPaymentMethod = "manual_mpesa" | "stk_push";

export type OrderItem = {
  dishId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type Order = {
  id: string;
  createdAt: string;
  items: OrderItem[];
  total: number;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: OrderPaymentMethod;
  paymentReference: string;
};

export type StorefrontCreateOrderPayload = {
  restaurantId: string;
  items: Array<{ dishId: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
};

export const ORDERS_KEY = "mv_orders_v1";

function writeCache(orders: Order[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function readCache(): Order[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw as Order[];
  } catch {
    return [];
  }
}

function mapOrder(row: any): Order {
  return {
    id: String(row.id),
    createdAt: String(row.createdAt || new Date().toISOString()),
    items: Array.isArray(row.items)
      ? row.items.map((item: any) => ({
          dishId: String(item.dishId || ""),
          name: String(item.nameSnapshot || item.name || ""),
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.priceSnapshot || item.unitPrice || 0),
          subtotal: Number(item.subtotal || 0),
        }))
      : [],
    total: Number(row.totalAmount || row.total || 0),
    customerName: String(row.customerName || "") || undefined,
    customerPhone: String(row.customerPhone || "") || undefined,
    tableNumber: String(row.tableNumber || "") || undefined,
    status: (row.status as OrderStatus) || "pending",
    paymentStatus: String(row.paymentStatus || "unpaid"),
    paymentMethod: row.paymentMethod === "stk_push" ? "stk_push" : "manual_mpesa",
    paymentReference: String(row.paymentReference || ""),
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
    const rows = await api.get<any[]>(`/orders${suffix}`);
    const mapped = rows.map(mapOrder);
    writeCache(mapped);
    return mapped;
  } catch {
    return readCache();
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

  const response = await api.post<any>("/orders/admin", {
    id: order.id,
    items: order.items.map((item) => ({
      dishId: item.dishId,
      nameSnapshot: item.name,
      priceSnapshot: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    totalAmount: order.total,
    paymentStatus: "pending",
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    status: order.status,
  });
  const saved = mapOrder(response);
  const next = [saved, ...readCache()];
  writeCache(next);
  return saved;
}

export async function createStorefrontOrder(payload: StorefrontCreateOrderPayload): Promise<string> {
  const response = await api.post<any>("/orders", payload);
  const orderId = String(response?.orderId || response?.id || "");
  if (!orderId) {
    throw new Error("Order was created but no order ID was returned.");
  }
  return orderId;
}

export async function getStorefrontOrder(orderId: string, restaurantId: string): Promise<Order> {
  const response = await api.get<any>(
    `/orders/${encodeURIComponent(orderId)}?restaurantId=${encodeURIComponent(restaurantId)}`
  );
  return mapOrder(response);
}

export async function getRecentOrders(limit = 5, params?: { restaurantId?: string; status?: OrderStatus }) {
  const orders = await loadOrders(params);
  return orders.slice(0, Math.max(0, Math.floor(limit)));
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  try {
    const response = await api.patch<any>(`/orders/${orderId}/status`, { status });
    const updated = mapOrder(response);
    const next = readCache().map((order) => (order.id === orderId ? updated : order));
    writeCache(next);
    return next;
  } catch {
    const next = readCache().map((order) =>
      order.id === orderId ? { ...order, status } : order
    );
    writeCache(next);
    return next;
  }
}
