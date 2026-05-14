import { createClient, type RedisClientType } from "redis";

const redisUrl = String(process.env.REDIS_URL || "").trim();

let publisher: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;
let publisherConnectPromise: Promise<RedisClientType | null> | null = null;
let subscriberConnectPromise: Promise<RedisClientType | null> | null = null;

function attachErrorLogger(client: RedisClientType, role: "publisher" | "subscriber") {
  client.on("error", (error) => {
    console.warn(`[redis] ${role} error`, error instanceof Error ? error.message : String(error));
  });
}

async function connectClient(role: "publisher" | "subscriber") {
  if (!redisUrl) return null;
  const client = createClient({ url: redisUrl }) as RedisClientType;
  attachErrorLogger(client, role);
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.warn(`[redis] ${role} unavailable`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

export function isRedisConfigured() {
  return Boolean(redisUrl);
}

export async function getRedisPublisher() {
  if (!redisUrl) return null;
  if (publisher?.isOpen) return publisher;
  if (!publisherConnectPromise) {
    publisherConnectPromise = connectClient("publisher").then((client) => {
      publisher = client;
      publisherConnectPromise = null;
      return client;
    });
  }
  return publisherConnectPromise;
}

export async function getRedisSubscriber() {
  if (!redisUrl) return null;
  if (subscriber?.isOpen) return subscriber;
  if (!subscriberConnectPromise) {
    subscriberConnectPromise = connectClient("subscriber").then((client) => {
      subscriber = client;
      subscriberConnectPromise = null;
      return client;
    });
  }
  return subscriberConnectPromise;
}
