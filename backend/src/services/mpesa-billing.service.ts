import type { InitiateBillingPaymentInput, ProviderCallbackResult, ProviderPaymentResult, ProviderReconciliationResult, ProviderVerificationResult } from "./billing-provider.service.js";

type MpesaBillingConfig = {
  mode: "mock" | "live";
  env: "sandbox" | "production";
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

function nowToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getMpesaBillingConfig(): MpesaBillingConfig {
  const mode = String(process.env.BILLING_MPESA_MODE || "mock").trim().toLowerCase() === "live" ? "live" : "mock";
  const env = String(process.env.MPESA_ENV || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox";
  return {
    mode,
    env,
    shortcode: String(process.env.MPESA_SHORTCODE || "").trim(),
    passkey: String(process.env.MPESA_PASSKEY || "").trim(),
    callbackUrl: String(process.env.MPESA_CALLBACK_URL || "").trim(),
    consumerKey: String(process.env.MPESA_CONSUMER_KEY || "").trim(),
    consumerSecret: String(process.env.MPESA_CONSUMER_SECRET || "").trim(),
  };
}

function normalizePhone(input?: string) {
  const raw = String(input || "").trim().replace(/[^\d+]/g, "");
  if (/^07\d{8}$/.test(raw)) return `254${raw.slice(1)}`;
  if (/^2547\d{8}$/.test(raw)) return raw;
  if (/^\+2547\d{8}$/.test(raw)) return raw.slice(1);
  return null;
}

function timestamp() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

async function getAccessToken(config: MpesaBillingConfig) {
  const base = config.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string } | null;
  if (!response.ok || !body?.access_token) throw new Error("Failed to fetch M-Pesa access token.");
  return body.access_token;
}

export async function initiateMpesaInvoiceCollection(input: InitiateBillingPaymentInput): Promise<ProviderPaymentResult> {
  const config = getMpesaBillingConfig();
  const phone = normalizePhone(input.customerPhone);
  const fallbackTx = `MPESA-${input.invoice.id}-${nowToken()}`;

  if (config.mode !== "live") {
    return {
      accepted: true,
      internalStatus: "pending",
      transactionReference: fallbackTx,
      providerReference: null,
      merchantRequestId: null,
      checkoutRequestId: `MOCK-${nowToken()}`,
      raw: {
        provider: "mpesa",
        mode: "mock",
        callbackExpected: true,
        reason: phone ? "mock_with_phone" : "mock_missing_phone",
      },
      resultCode: "0",
      resultDescription: "Mock STK initiated.",
    };
  }

  if (!config.shortcode || !config.passkey || !config.callbackUrl || !config.consumerKey || !config.consumerSecret) {
    return {
      accepted: false,
      internalStatus: "failed",
      transactionReference: fallbackTx,
      providerReference: null,
      merchantRequestId: null,
      checkoutRequestId: null,
      raw: { provider: "mpesa", mode: "live", error: "missing_credentials" },
      resultCode: "CONFIG_ERROR",
      resultDescription: "Missing required M-Pesa live credentials.",
    };
  }
  if (!phone) {
    return {
      accepted: false,
      internalStatus: "failed",
      transactionReference: fallbackTx,
      providerReference: null,
      merchantRequestId: null,
      checkoutRequestId: null,
      raw: { provider: "mpesa", mode: "live", error: "invalid_phone" },
      resultCode: "PHONE_INVALID",
      resultDescription: "Invalid phone number for STK push.",
    };
  }

  const ts = timestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${ts}`).toString("base64");
  const base = config.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const token = await getAccessToken(config);
  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(input.amount)),
    PartyA: phone,
    PartyB: config.shortcode,
    PhoneNumber: phone,
    CallBackURL: config.callbackUrl,
    AccountReference: input.invoice.paymentReference,
    TransactionDesc: `Ubhona ${input.invoice.planId} subscription`,
  };

  const response = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as
    | {
        ResponseCode?: string;
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResponseDescription?: string;
        CustomerMessage?: string;
        errorMessage?: string;
      }
    | null;

  const accepted = response.ok && body?.ResponseCode === "0";
  return {
    accepted,
    internalStatus: accepted ? "pending" : "failed",
    transactionReference: fallbackTx,
    providerReference: body?.CheckoutRequestID || null,
    merchantRequestId: body?.MerchantRequestID || null,
    checkoutRequestId: body?.CheckoutRequestID || null,
    raw: { provider: "mpesa", mode: "live", request: payload, response: body || {} },
    resultCode: body?.ResponseCode || null,
    resultDescription: body?.CustomerMessage || body?.ResponseDescription || body?.errorMessage || null,
  };
}

export async function verifyMpesaPayment(input: {
  paymentReference: string;
  transactionReference: string;
}): Promise<ProviderVerificationResult> {
  const config = getMpesaBillingConfig();
  if (config.mode !== "live") {
    return {
      found: true,
      internalStatus: "pending",
      providerReference: input.transactionReference,
      resultCode: "MOCK_VERIFY",
      resultDescription: "Mock verification pending.",
      raw: { provider: "mpesa", mode: "mock", verification: "pending" },
    };
  }
  return {
    found: true,
    internalStatus: "pending",
    providerReference: input.transactionReference,
    resultCode: "VERIFY_PENDING",
    resultDescription: "Live verification not yet wired to query endpoint.",
    raw: { provider: "mpesa", mode: "live", verification: "not_implemented" },
  };
}

export async function reconcileMpesaPayment(input: {
  paymentReference: string;
  transactionReference: string;
}): Promise<ProviderReconciliationResult> {
  const verification = await verifyMpesaPayment(input);
  return {
    internalStatus: verification.internalStatus,
    providerReference: verification.providerReference,
    resultCode: verification.resultCode || null,
    resultDescription: verification.resultDescription || null,
    raw: { provider: "mpesa", reconcileFromVerify: true, verification: verification.raw },
  };
}

export async function handleMpesaBillingCallback(payload: Record<string, unknown>): Promise<ProviderCallbackResult> {
  const body = payload.Body as Record<string, unknown> | undefined;
  const stkCallback = body?.stkCallback as Record<string, unknown> | undefined;
  const checkoutRequestId = String(stkCallback?.CheckoutRequestID || payload.checkoutRequestId || "");
  const merchantRequestId = String(stkCallback?.MerchantRequestID || payload.merchantRequestId || "");
  const resultCodeValue = stkCallback?.ResultCode ?? payload.resultCode;
  const resultCode = resultCodeValue == null ? null : String(resultCodeValue);
  const resultDescription = String(stkCallback?.ResultDesc || payload.resultDescription || "");
  const success = resultCode === "0";
  const txRef = String(payload.transactionReference || checkoutRequestId || merchantRequestId || `MPESA-CB-${nowToken()}`);
  const providerReference = String(payload.providerReference || checkoutRequestId || "").trim() || null;
  const eventKey = `mpesa:${checkoutRequestId || merchantRequestId || txRef}:${resultCode || "unknown"}`;
  return {
    eventKey,
    internalStatus: success ? "succeeded" : "failed",
    transactionReference: txRef,
    providerReference,
    merchantRequestId: merchantRequestId || null,
    checkoutRequestId: checkoutRequestId || null,
    resultCode,
    resultDescription: resultDescription || null,
    payload,
  };
}

