import { runWithPublicStorefrontDbContext } from "../db-rls.js";
import { prisma } from "../prisma.js";
import { normalizePhone } from "./payment.service.js";
import { sendWhatsAppTemplateMessage } from "./whatsapp-provider.service.js";
import { issueOrderTrackingToken } from "./order-tracking-token.service.js";
import {
  createRestaurantDocument,
  findRestaurantDocumentByKey,
  listRestaurantDocuments,
  upsertRestaurantDocument,
} from "./tenant-document.service.js";
import type {
  OrderWhatsAppPreference,
  RestaurantWhatsAppSettings,
  WhatsAppMessageType,
} from "./whatsapp.types.js";

const SETTINGS_KEY_PREFIX = "whatsapp_settings:";
const PREF_KEY_PREFIX = "whatsapp_pref:";
const DISPATCH_KEY_PREFIX = "whatsapp_dispatch:";
const LOG_KEY_PREFIX = "whatsapp_log:";
const AUTOMATION_SETTINGS_KEY_PREFIX = "automation_settings:";

const DEFAULT_SETTINGS: RestaurantWhatsAppSettings = {
  enabled: false,
  directorName: "Restaurant Director",
  senderBehavior: "default",
  provider: "mock",
  updatedAt: new Date(0).toISOString(),
};

function settingsKey(restaurantId: string) {
  return `${SETTINGS_KEY_PREFIX}${restaurantId}`;
}

function prefKey(restaurantId: string, orderId: string) {
  return `${PREF_KEY_PREFIX}${restaurantId}:${orderId}`;
}

function dispatchKey(restaurantId: string, orderId: string, messageType: WhatsAppMessageType) {
  return `${DISPATCH_KEY_PREFIX}${restaurantId}:${orderId}:${messageType}`;
}

function logKey(restaurantId: string, orderId: string, messageType: WhatsAppMessageType) {
  return `${LOG_KEY_PREFIX}${restaurantId}:${orderId}:${messageType}:${Date.now()}`;
}

function automationSettingsKey(restaurantId: string) {
  return `${AUTOMATION_SETTINGS_KEY_PREFIX}${restaurantId}`;
}

async function getAutomationWhatsAppFlags(restaurantId: string) {
  const row = await findRestaurantDocumentByKey({
    restaurantId,
    key: automationSettingsKey(restaurantId),
    select: { payload: true },
  });
  const payload = ((row?.payload as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  return {
    whatsappStatusUpdatesEnabled:
      payload.whatsapp_status_updates_enabled == null ? true : Boolean(payload.whatsapp_status_updates_enabled),
    directorThankYouEnabled:
      payload.director_thank_you_enabled == null ? true : Boolean(payload.director_thank_you_enabled),
  };
}

async function writeLog(input: {
  orderId: string;
  restaurantId: string;
  messageType: WhatsAppMessageType;
  phoneNumber: string | null;
  sendStatus: "sent" | "failed" | "skipped";
  provider: string;
  providerReference?: string;
  failureReason?: string;
  payload?: unknown;
}) {
  await createRestaurantDocument({
    restaurantId: input.restaurantId,
    key: logKey(input.restaurantId, input.orderId, input.messageType),
    payload: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      messageType: input.messageType,
      phoneNumber: input.phoneNumber,
      sendStatus: input.sendStatus,
      provider: input.provider,
      providerReference: input.providerReference || null,
      failureReason: input.failureReason || null,
      payload: input.payload || null,
      createdAt: new Date().toISOString(),
    },
  });
}

export async function getRestaurantWhatsAppSettings(restaurantId: string): Promise<RestaurantWhatsAppSettings> {
  const row = await findRestaurantDocumentByKey({
    restaurantId,
    key: settingsKey(restaurantId),
    select: { payload: true },
  });
  const payload = ((row?.payload as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  const providerRaw = String(payload.provider || process.env.WHATSAPP_PROVIDER || "mock").trim().toLowerCase();
  const provider = providerRaw === "meta_cloud" || providerRaw === "twilio" ? providerRaw : "mock";
  return {
    enabled: Boolean(payload.enabled),
    directorName: String(payload.directorName || DEFAULT_SETTINGS.directorName),
    senderBehavior: payload.senderBehavior === "restaurant" ? "restaurant" : "default",
    provider,
    updatedAt: String(payload.updatedAt || DEFAULT_SETTINGS.updatedAt),
  };
}

export async function updateRestaurantWhatsAppSettings(
  restaurantId: string,
  input: Partial<Pick<RestaurantWhatsAppSettings, "enabled" | "directorName" | "senderBehavior" | "provider">>
) {
  const existing = await getRestaurantWhatsAppSettings(restaurantId);
  const next: RestaurantWhatsAppSettings = {
    enabled: input.enabled ?? existing.enabled,
    directorName: String(input.directorName || existing.directorName || DEFAULT_SETTINGS.directorName).trim(),
    senderBehavior: input.senderBehavior || existing.senderBehavior || "default",
    provider: input.provider || existing.provider || "mock",
    updatedAt: new Date().toISOString(),
  };
  await upsertRestaurantDocument({
    restaurantId,
    key: settingsKey(restaurantId),
    payload: next,
  });
  return next;
}

export async function registerOrderWhatsAppPreference(input: {
  orderId: string;
  restaurantId: string;
  optedIn: boolean;
  whatsappNumber?: string | null;
  source?: "checkout" | "admin" | "api";
}) {
  const normalizedNumber = input.whatsappNumber ? normalizePhone(input.whatsappNumber) : null;
  const payload: OrderWhatsAppPreference = {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    optedIn: Boolean(input.optedIn),
    whatsappNumber: normalizedNumber,
    source: input.source || "checkout",
    updatedAt: new Date().toISOString(),
  };
  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key: prefKey(input.restaurantId, input.orderId),
    payload,
  });
  return payload;
}

export async function getOrderWhatsAppPreference(orderId: string, restaurantId: string): Promise<OrderWhatsAppPreference | null> {
  const row = await findRestaurantDocumentByKey({
    restaurantId,
    key: prefKey(restaurantId, orderId),
    select: { payload: true },
  });
  if (!row) return null;
  const payload = (row.payload as Record<string, unknown>) || {};
  return {
    orderId: String(payload.orderId || orderId),
    restaurantId: String(payload.restaurantId || ""),
    optedIn: Boolean(payload.optedIn),
    whatsappNumber: payload.whatsappNumber ? String(payload.whatsappNumber) : null,
    source: payload.source === "admin" || payload.source === "api" ? payload.source : "checkout",
    updatedAt: String(payload.updatedAt || new Date().toISOString()),
  };
}

function getTemplateName(messageType: WhatsAppMessageType) {
  const envMap: Record<WhatsAppMessageType, string> = {
    order_placed: process.env.WHATSAPP_TEMPLATE_ORDER_PLACED || "ubhona_order_placed",
    order_confirmed: process.env.WHATSAPP_TEMPLATE_ORDER_CONFIRMED || "ubhona_order_confirmed",
    order_preparing: process.env.WHATSAPP_TEMPLATE_ORDER_PREPARING || "ubhona_order_preparing",
    order_ready: process.env.WHATSAPP_TEMPLATE_ORDER_READY || "ubhona_order_ready",
    order_completed: process.env.WHATSAPP_TEMPLATE_ORDER_COMPLETED || "ubhona_order_completed",
    director_thank_you: process.env.WHATSAPP_TEMPLATE_DIRECTOR_THANK_YOU || "ubhona_director_thank_you",
  };
  return envMap[messageType];
}

function getOrderTrackingUrl(orderId: string, trackingToken: string) {
  const base = String(process.env.APP_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  const path = `/order/${encodeURIComponent(orderId)}?token=${encodeURIComponent(trackingToken)}`;
  return base ? `${base}${path}` : path;
}

async function sendOrderMessage(input: {
  orderId: string;
  restaurantId: string;
  messageType: WhatsAppMessageType;
  status?: string;
  paymentStatus?: string;
}) {
  // WhatsApp delivery can run from callbacks and background side effects where
  // no authenticated app actor is present. The tenant is still proven by
  // restaurantId, so use the synthetic public tenant context for protected
  // order reads instead of bypassing RLS entirely.
  const [settings, preference, order, restaurant] = await Promise.all([
    getRestaurantWhatsAppSettings(input.restaurantId),
    getOrderWhatsAppPreference(input.orderId, input.restaurantId),
    runWithPublicStorefrontDbContext(input.restaurantId, () =>
      prisma.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          restaurantId: true,
          customerName: true,
          customerPhone: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
        },
      })
    ),
    prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { id: true, name: true },
    }),
  ]);

  const phone = preference?.whatsappNumber || (order?.customerPhone ? normalizePhone(order.customerPhone) : null);
  const provider = settings.provider || "mock";

  if (!settings.enabled) {
    await writeLog({
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      messageType: input.messageType,
      phoneNumber: phone,
      sendStatus: "skipped",
      provider,
      failureReason: "whatsapp_notifications_disabled",
    });
    return;
  }
  if (!preference?.optedIn) {
    await writeLog({
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      messageType: input.messageType,
      phoneNumber: phone,
      sendStatus: "skipped",
      provider,
      failureReason: "customer_not_opted_in",
    });
    return;
  }
  if (!phone) {
    await writeLog({
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      messageType: input.messageType,
      phoneNumber: null,
      sendStatus: "failed",
      provider,
      failureReason: "missing_or_invalid_whatsapp_number",
    });
    return;
  }

  const dedupeKey = dispatchKey(input.restaurantId, input.orderId, input.messageType);
  const existingDispatch = await findRestaurantDocumentByKey({
    restaurantId: input.restaurantId,
    key: dedupeKey,
    select: { id: true },
  });
  if (existingDispatch) return;

  const templateName = getTemplateName(input.messageType);
  const trackingToken = issueOrderTrackingToken({
    orderId: input.orderId,
    restaurantId: order?.restaurantId || input.restaurantId,
  });
  const sendResult = await sendWhatsAppTemplateMessage({
    to: phone,
    templateName,
    messageType: input.messageType,
    languageCode: "en",
    payload: {
      orderId: input.orderId,
      orderTrackingUrl: getOrderTrackingUrl(input.orderId, trackingToken),
      restaurantName: restaurant?.name || "Ubhona Restaurant",
      customerName: order?.customerName || null,
      status: input.status || order?.status || "",
      totalAmount: order?.totalAmount || 0,
      directorName: settings.directorName,
      paymentStatus: input.paymentStatus || order?.paymentStatus || "",
    },
  });

  await upsertRestaurantDocument({
    restaurantId: input.restaurantId,
    key: dedupeKey,
    payload: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      messageType: input.messageType,
      sentAt: new Date().toISOString(),
      sendStatus: sendResult.ok ? "sent" : "failed",
      provider: sendResult.provider,
      providerReference: sendResult.providerMessageId || null,
      failureReason: sendResult.failureReason || null,
    },
  });

  await writeLog({
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    messageType: input.messageType,
    phoneNumber: phone,
    sendStatus: sendResult.ok ? "sent" : "failed",
    provider: sendResult.provider,
    providerReference: sendResult.providerMessageId,
    failureReason: sendResult.failureReason,
    payload: sendResult.raw,
  });
}

export async function sendOrderPlacedMessage(orderId: string, restaurantId: string) {
  await sendOrderMessage({ orderId, restaurantId, messageType: "order_placed" });
}

export async function sendOrderConfirmedMessage(orderId: string, restaurantId: string) {
  await sendOrderMessage({ orderId, restaurantId, messageType: "order_confirmed", status: "confirmed" });
}

export async function sendPreparingMessage(orderId: string, restaurantId: string) {
  await sendOrderMessage({ orderId, restaurantId, messageType: "order_preparing", status: "preparing" });
}

export async function sendReadyMessage(orderId: string, restaurantId: string) {
  await sendOrderMessage({ orderId, restaurantId, messageType: "order_ready", status: "ready" });
}

export async function sendCompletedMessage(orderId: string, restaurantId: string) {
  await sendOrderMessage({ orderId, restaurantId, messageType: "order_completed", status: "completed" });
}

export async function sendDirectorThankYouMessage(orderId: string, restaurantId: string) {
  await sendOrderMessage({ orderId, restaurantId, messageType: "director_thank_you", status: "completed" });
}

export async function handleOrderStatusWhatsAppNotifications(input: {
  orderId: string;
  restaurantId: string;
  status: string;
}) {
  const flags = await getAutomationWhatsAppFlags(input.restaurantId);
  if (!flags.whatsappStatusUpdatesEnabled) return;
  const status = String(input.status || "").trim().toLowerCase();
  if (status === "confirmed") {
    await sendOrderConfirmedMessage(input.orderId, input.restaurantId);
    return;
  }
  if (status === "preparing") {
    await sendPreparingMessage(input.orderId, input.restaurantId);
    return;
  }
  if (status === "ready") {
    await sendReadyMessage(input.orderId, input.restaurantId);
    return;
  }
  if (status === "completed") {
    await sendCompletedMessage(input.orderId, input.restaurantId);
    if (flags.directorThankYouEnabled) {
      await sendDirectorThankYouMessage(input.orderId, input.restaurantId);
    }
  }
}

export async function getWhatsAppLogsForRestaurant(restaurantId: string, limit = 100) {
  const rows = await listRestaurantDocuments({
    restaurantId,
    keyPrefix: `${LOG_KEY_PREFIX}`,
    take: Math.max(1, Math.min(200, Math.floor(limit))),
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row: { payload: unknown }) => row.payload);
}
