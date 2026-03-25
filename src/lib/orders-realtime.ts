type OrderRealtimeEvent = {
  restaurantId?: string;
  orderId?: string;
  reason?: string;
  timestamp: number;
};

const CHANNEL_NAME = "ubhona.orders.realtime";
const STORAGE_KEY = "ubhona:orders:realtime";
const WINDOW_EVENT = "ubhona:orders:realtime";

function safeParse(value: string | null): OrderRealtimeEvent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as OrderRealtimeEvent;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      restaurantId: parsed.restaurantId,
      orderId: parsed.orderId,
      reason: parsed.reason,
      timestamp: Number(parsed.timestamp) || Date.now(),
    };
  } catch {
    return null;
  }
}

function isForRestaurant(event: OrderRealtimeEvent, restaurantId?: string) {
  if (!restaurantId) return true;
  if (!event.restaurantId) return true;
  return event.restaurantId === restaurantId;
}

export function emitOrderRealtimeEvent(input: Omit<OrderRealtimeEvent, "timestamp">) {
  const payload: OrderRealtimeEvent = {
    ...input,
    timestamp: Date.now(),
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<OrderRealtimeEvent>(WINDOW_EVENT, { detail: payload }));
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  }
}

export function subscribeOrderRealtimeEvents(
  callback: (event: OrderRealtimeEvent) => void,
  options?: { restaurantId?: string }
) {
  if (typeof window === "undefined") return () => undefined;

  const { restaurantId } = options || {};

  const onWindowEvent = (event: Event) => {
    const custom = event as CustomEvent<OrderRealtimeEvent>;
    if (!custom.detail) return;
    if (!isForRestaurant(custom.detail, restaurantId)) return;
    callback(custom.detail);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const parsed = safeParse(event.newValue);
    if (!parsed) return;
    if (!isForRestaurant(parsed, restaurantId)) return;
    callback(parsed);
  };

  window.addEventListener(WINDOW_EVENT, onWindowEvent as EventListener);
  window.addEventListener("storage", onStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<OrderRealtimeEvent>) => {
      const payload = event.data;
      if (!payload) return;
      if (!isForRestaurant(payload, restaurantId)) return;
      callback(payload);
    };
  }

  return () => {
    window.removeEventListener(WINDOW_EVENT, onWindowEvent as EventListener);
    window.removeEventListener("storage", onStorage);
    if (channel) channel.close();
  };
}

