import type {
  WhatsAppProviderName,
  WhatsAppSendRequest,
  WhatsAppSendResult,
} from "./whatsapp.types.js";

type WhatsAppProviderAdapter = {
  name: WhatsAppProviderName;
  sendTemplateMessage(input: WhatsAppSendRequest): Promise<WhatsAppSendResult>;
};

type MetaSendResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

type TwilioSendResponse = {
  sid?: string;
  message?: string;
};

function normalizeProvider(value: string | undefined): WhatsAppProviderName {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "meta" || normalized === "meta_cloud" || normalized === "whatsapp_cloud") return "meta_cloud";
  if (normalized === "twilio") return "twilio";
  return "mock";
}

function makeMockResult(input: WhatsAppSendRequest): WhatsAppSendResult {
  return {
    ok: true,
    provider: "mock",
    providerMessageId: `mock-${Date.now()}`,
    raw: {
      templateName: input.templateName,
      to: input.to,
      messageType: input.messageType,
      payload: input.payload,
    },
  };
}

const mockProvider: WhatsAppProviderAdapter = {
  name: "mock",
  async sendTemplateMessage(input) {
    return makeMockResult(input);
  },
};

const metaCloudProvider: WhatsAppProviderAdapter = {
  name: "meta_cloud",
  async sendTemplateMessage(input) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_META_ACCESS_TOKEN || "";
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_META_PHONE_NUMBER_ID || "";
    if (!token || !phoneNumberId) {
      return {
        ok: false,
        provider: "meta_cloud",
        failureReason:
          "Missing Meta Cloud config. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
      };
    }
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.languageCode || "en" },
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as MetaSendResponse | null;
    const providerMessageId = Array.isArray(body?.messages)
      ? String(body?.messages[0]?.id || "")
      : "";
    return {
      ok: response.ok,
      provider: "meta_cloud",
      providerMessageId: providerMessageId || undefined,
      failureReason: response.ok ? undefined : String(body?.error?.message || "Meta API request failed."),
      raw: body,
    };
  },
};

const twilioProvider: WhatsAppProviderAdapter = {
  name: "twilio",
  async sendTemplateMessage(input) {
    const sid = process.env.TWILIO_ACCOUNT_SID || "";
    const token = process.env.TWILIO_AUTH_TOKEN || "";
    const from = process.env.TWILIO_WHATSAPP_FROM || "";
    if (!sid || !token || !from) {
      return {
        ok: false,
        provider: "twilio",
        failureReason:
          "Missing Twilio config. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM.",
      };
    }
    const body = new URLSearchParams();
    body.set("From", from);
    body.set("To", `whatsapp:${input.to}`);
    body.set(
      "Body",
      `Template ${input.templateName} -> Order ${input.payload.orderId} (${input.payload.restaurantName})`
    );
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const result = (await response.json().catch(() => null)) as TwilioSendResponse | null;
    return {
      ok: response.ok,
      provider: "twilio",
      providerMessageId: String(result?.sid || ""),
      failureReason: response.ok ? undefined : String(result?.message || "Twilio API request failed."),
      raw: result,
    };
  },
};

export function getWhatsAppProviderAdapter(): WhatsAppProviderAdapter {
  const provider = normalizeProvider(process.env.WHATSAPP_PROVIDER);
  if (provider === "meta_cloud") return metaCloudProvider;
  if (provider === "twilio") return twilioProvider;
  return mockProvider;
}

export async function sendWhatsAppTemplateMessage(input: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
  const provider = getWhatsAppProviderAdapter();
  const result = await provider.sendTemplateMessage(input);
  if (!result.provider) {
    return { ...result, provider: provider.name };
  }
  return result;
}
