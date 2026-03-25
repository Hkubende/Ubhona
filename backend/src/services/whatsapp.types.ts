export type WhatsAppMessageType =
  | "order_placed"
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "order_completed"
  | "director_thank_you";

export type WhatsAppProviderName = "meta_cloud" | "twilio" | "mock";

export type WhatsAppTemplatePayload = {
  orderId: string;
  orderTrackingUrl?: string;
  restaurantName: string;
  customerName?: string | null;
  status?: string;
  totalAmount?: number;
  directorName?: string;
  paymentStatus?: string;
};

export type WhatsAppSendRequest = {
  to: string;
  templateName: string;
  languageCode?: string;
  messageType: WhatsAppMessageType;
  payload: WhatsAppTemplatePayload;
};

export type WhatsAppSendResult = {
  ok: boolean;
  provider: WhatsAppProviderName;
  providerMessageId?: string;
  failureReason?: string;
  raw?: unknown;
};

export type RestaurantWhatsAppSettings = {
  enabled: boolean;
  directorName: string;
  senderBehavior: "default" | "restaurant";
  provider: WhatsAppProviderName;
  updatedAt: string;
};

export type OrderWhatsAppPreference = {
  orderId: string;
  restaurantId: string;
  optedIn: boolean;
  whatsappNumber: string | null;
  source: "checkout" | "admin" | "api";
  updatedAt: string;
};
