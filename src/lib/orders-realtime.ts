import { getApiBaseUrl, getAuthToken, isApiReachable } from "./api";

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

function parseEventStreamChunk(
  buffer: string,
  onMessage: (event: OrderRealtimeEvent) => void
) {
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() || "";
  for (const frame of frames) {
    const dataLines = frame
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) continue;
    const parsed = safeParse(dataLines.join("\n"));
    if (!parsed) continue;
    onMessage(parsed);
  }
  return remainder;
}

export function subscribeBackendOrderEvents(
  callback: (event: OrderRealtimeEvent) => void,
  options?: { restaurantId?: string }
) {
  if (typeof window === "undefined") return () => undefined;

  const apiBase = getApiBaseUrl();
  const token = getAuthToken();
  if (!apiBase || !token) return () => undefined;

  const { restaurantId } = options || {};
  const controller = new AbortController();
  let stopped = false;
  let reconnectTimer: number | null = null;

  const connect = async () => {
    if (stopped) return;
    if (!(await isApiReachable().catch(() => false))) {
      reconnectTimer = window.setTimeout(connect, 5_000);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/orders/events`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseEventStreamChunk(buffer, (event) => {
          if (!isForRestaurant(event, restaurantId)) return;
          callback(event);
        });
      }
    } catch {
      // Existing short polling remains the authoritative fallback when streaming is unavailable.
    } finally {
      if (!stopped) {
        reconnectTimer = window.setTimeout(connect, 5_000);
      }
    }
  };

  void connect();

  return () => {
    stopped = true;
    controller.abort();
    if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
  };
}
