import { EventEmitter } from "node:events";
import { getRedisPublisher, getRedisSubscriber, isRedisConfigured } from "../lib/redis.js";

export type OrderRealtimeEventType = "order.created" | "order.status_updated";

export type OrderRealtimeEvent = {
  type: OrderRealtimeEventType;
  restaurantId: string;
  orderId: string;
  status?: string;
  source: "storefront" | "admin" | "orders_api";
  createdAt: string;
};

const ORDER_EVENTS_CHANNEL = "ubhona:orders:events";
const emitter = new EventEmitter();
let redisSubscriptionStarted = false;

function emitLocal(event: OrderRealtimeEvent) {
  emitter.emit("order-event", event);
}

function parseOrderEvent(payload: string) {
  try {
    const parsed = JSON.parse(payload) as Partial<OrderRealtimeEvent>;
    if (!parsed.restaurantId || !parsed.orderId || !parsed.type) return null;
    return {
      type: parsed.type,
      restaurantId: parsed.restaurantId,
      orderId: parsed.orderId,
      status: parsed.status,
      source: parsed.source || "orders_api",
      createdAt: parsed.createdAt || new Date().toISOString(),
    } satisfies OrderRealtimeEvent;
  } catch {
    return null;
  }
}

async function ensureRedisSubscription() {
  if (!isRedisConfigured() || redisSubscriptionStarted) return;
  redisSubscriptionStarted = true;
  const subscriber = await getRedisSubscriber();
  if (!subscriber) return;
  try {
    await subscriber.subscribe(ORDER_EVENTS_CHANNEL, (payload) => {
      const event = parseOrderEvent(payload);
      if (event) emitLocal(event);
    });
  } catch (error) {
    redisSubscriptionStarted = false;
    console.warn("[orders] redis order event subscription unavailable", error instanceof Error ? error.message : String(error));
  }
}

export async function publishOrderRealtimeEvent(event: OrderRealtimeEvent) {
  emitLocal(event);
  const publisher = await getRedisPublisher();
  if (!publisher) return;
  try {
    await publisher.publish(ORDER_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (error) {
    console.warn("[orders] redis order event publish skipped", error instanceof Error ? error.message : String(error));
  }
}

export async function subscribeOrderRealtimeEvents(
  restaurantId: string,
  handler: (event: OrderRealtimeEvent) => void
) {
  await ensureRedisSubscription();
  const listener = (event: OrderRealtimeEvent) => {
    if (event.restaurantId !== restaurantId) return;
    handler(event);
  };
  emitter.on("order-event", listener);
  return () => {
    emitter.off("order-event", listener);
  };
}
