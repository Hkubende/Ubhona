import { prisma } from "../prisma.js";

type MpesaConfig = {
  env: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
};

function getMpesaConfig(): MpesaConfig {
  const env = (process.env.MPESA_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
  const consumerKey = process.env.MPESA_CONSUMER_KEY || "";
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET || "";
  const shortcode = process.env.MPESA_SHORTCODE || "";
  const passkey = process.env.MPESA_PASSKEY || "";
  const callbackUrl = process.env.MPESA_CALLBACK_URL || "";
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    throw new Error(
      "Missing M-Pesa env vars. Required: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL."
    );
  }
  return { env, consumerKey, consumerSecret, shortcode, passkey, callbackUrl };
}

export function normalizePhone(input: string) {
  const raw = String(input || "").trim().replace(/[^\d+]/g, "");
  if (/^07\d{8}$/.test(raw)) return `254${raw.slice(1)}`;
  if (/^2547\d{8}$/.test(raw)) return raw;
  if (/^\+2547\d{8}$/.test(raw)) return raw.slice(1);
  return null;
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

async function getAccessToken(config: MpesaConfig) {
  const base = config.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error("Failed to get M-Pesa access token.");
  }
  return body.access_token;
}

export async function initiateStkPushForOrder(input: {
  orderId: string;
  phone: string;
  restaurantId?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, totalAmount: true, paymentStatus: true, restaurantId: true },
  });
  if (!order) {
    throw new Error("Order not found.");
  }
  if (input.restaurantId && input.restaurantId !== order.restaurantId) {
    throw new Error("Order does not belong to this restaurant.");
  }
  if (order.paymentStatus === "paid") {
    throw new Error("Order is already paid.");
  }

  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("Invalid phone. Use 07XXXXXXXX or 2547XXXXXXXX.");
  }

  const config = getMpesaConfig();
  const timestamp = getTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
  const token = await getAccessToken(config);
  const base = config.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(order.totalAmount)),
    PartyA: phone,
    PartyB: config.shortcode,
    PhoneNumber: phone,
    CallBackURL: config.callbackUrl,
    AccountReference: order.id,
    TransactionDesc: "MenuVista Order",
  };

  const stkResponse = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const stkBody = (await stkResponse.json().catch(() => null)) as
    | {
        ResponseCode?: string;
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResponseDescription?: string;
        errorMessage?: string;
      }
    | null;

  const accepted = stkResponse.ok && stkBody?.ResponseCode === "0";
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: "mpesa",
      phone,
      amount: payload.Amount,
      status: accepted ? "processing" : "failed",
      checkoutRequestId: stkBody?.CheckoutRequestID || null,
      merchantRequestId: stkBody?.MerchantRequestID || null,
      resultCode: accepted ? 0 : -1,
      resultDesc: stkBody?.ResponseDescription || stkBody?.errorMessage || "STK request failed",
      requestPayload: payload,
      responsePayload: stkBody ?? {},
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentMethod: "stk_push",
      paymentStatus: accepted ? "processing" : "failed",
      paymentReference: stkBody?.CheckoutRequestID || payment.id,
    },
  });

  if (!accepted) {
    await prisma.analyticsEvent.create({
      data: {
        restaurantId: order.restaurantId,
        orderId: order.id,
        eventType: "payment_failed",
        source: "stk_request",
        metadata: {
          reason: stkBody?.errorMessage || stkBody?.ResponseDescription || "STK request failed",
          checkoutRequestId: stkBody?.CheckoutRequestID || null,
        },
      },
    });
  }

  return {
    accepted,
    payment,
    checkoutRequestId: stkBody?.CheckoutRequestID || "",
    error: stkBody?.errorMessage || stkBody?.ResponseDescription || "STK request failed",
  };
}

export async function handleStkCallback(callback: any) {
  const stkCallback = callback?.Body?.stkCallback;
  if (!stkCallback) {
    throw new Error("Invalid callback payload.");
  }
  const checkoutRequestId = String(stkCallback.CheckoutRequestID || "");
  const resultCode = Number(stkCallback.ResultCode ?? -1);
  const resultDesc = String(stkCallback.ResultDesc || "");

  const payment = await prisma.payment.findFirst({
    where: { checkoutRequestId },
    select: { id: true, orderId: true, order: { select: { restaurantId: true, status: true } } },
  });
  if (!payment) {
    return { ignored: true };
  }

  const metadataItems = Array.isArray(stkCallback.CallbackMetadata?.Item) ? stkCallback.CallbackMetadata.Item : [];
  const metadataMap = new Map<string, unknown>();
  for (const item of metadataItems) {
    if (item?.Name) metadataMap.set(String(item.Name), item.Value);
  }
  const receipt = String(metadataMap.get("MpesaReceiptNumber") || "");

  const isSuccess = resultCode === 0;
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: isSuccess ? "paid" : "failed",
      resultCode,
      resultDesc,
      receiptNumber: receipt || null,
      callbackPayload: callback,
    },
  });

  await prisma.order.update({
    where: { id: payment.orderId },
    data: {
      paymentStatus: isSuccess ? "paid" : "failed",
      paymentReference: receipt || checkoutRequestId,
      status: isSuccess && payment.order.status === "pending" ? "confirmed" : payment.order.status,
    },
  });

  if (isSuccess) {
    await prisma.analyticsEvent.create({
      data: {
        restaurantId: payment.order.restaurantId,
        orderId: payment.orderId,
        eventType: "payment_success",
        source: "callback",
        metadata: {
          checkoutRequestId,
          receiptNumber: receipt || null,
        },
      },
    });
  } else {
    await prisma.analyticsEvent.create({
      data: {
        restaurantId: payment.order.restaurantId,
        orderId: payment.orderId,
        eventType: "payment_failed",
        source: "callback",
        metadata: {
          checkoutRequestId,
          resultCode,
          resultDesc,
        },
      },
    });
  }
  return { ignored: false };
}

export async function getOrderPaymentStatus(input: { orderId: string; restaurantId?: string }) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      restaurantId: true,
      paymentStatus: true,
      status: true,
      paymentMethod: true,
      paymentReference: true,
    },
  });
  if (!order) {
    throw new Error("Order not found.");
  }
  if (input.restaurantId && input.restaurantId !== order.restaurantId) {
    throw new Error("Order does not belong to this restaurant.");
  }
  const latestPayment = await prisma.payment.findFirst({
    where: { orderId: input.orderId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      phone: true,
      amount: true,
      checkoutRequestId: true,
      receiptNumber: true,
      resultCode: true,
      resultDesc: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return { order, payment: latestPayment };
}
