import type { BillingInvoice, BillingPaymentStatus, PaymentProvider } from "./billing.types.js";
import {
  handleMpesaBillingCallback,
  initiateMpesaInvoiceCollection,
  reconcileMpesaPayment,
  verifyMpesaPayment,
} from "./mpesa-billing.service.js";

export type InitiateBillingPaymentInput = {
  restaurantId: string;
  invoice: BillingInvoice;
  amount: number;
  currency: string;
  customerPhone?: string;
};

export type ProviderPaymentResult = {
  accepted: boolean;
  internalStatus: BillingPaymentStatus;
  transactionReference: string;
  providerReference: string | null;
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  raw: Record<string, unknown>;
  resultCode?: string | null;
  resultDescription?: string | null;
};

export type ProviderVerificationResult = {
  found: boolean;
  internalStatus: BillingPaymentStatus;
  providerReference: string | null;
  resultCode?: string | null;
  resultDescription?: string | null;
  raw: Record<string, unknown>;
};

export type ProviderReconciliationResult = {
  internalStatus: BillingPaymentStatus;
  providerReference: string | null;
  resultCode?: string | null;
  resultDescription?: string | null;
  raw: Record<string, unknown>;
};

export type ProviderCallbackResult = {
  eventKey: string;
  internalStatus: BillingPaymentStatus;
  transactionReference: string;
  providerReference: string | null;
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  resultCode?: string | null;
  resultDescription?: string | null;
  payload: Record<string, unknown>;
};

export type BillingProviderAdapter = {
  id: PaymentProvider;
  initiatePayment: (input: InitiateBillingPaymentInput) => Promise<ProviderPaymentResult>;
  verifyPayment: (input: { paymentReference: string; transactionReference: string }) => Promise<ProviderVerificationResult>;
  reconcilePayment: (input: { paymentReference: string; transactionReference: string }) => Promise<ProviderReconciliationResult>;
  handleCallback: (payload: Record<string, unknown>) => Promise<ProviderCallbackResult>;
  mapProviderStatusToInternalStatus: (status: string) => BillingPaymentStatus;
};

function nowToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProviderStatus(status: string): BillingPaymentStatus {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "succeeded" || normalized === "success" || normalized === "paid") return "succeeded";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "timeout" || normalized === "expired") return "timeout";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "requires_verification" || normalized === "manual_review") return "requires_verification";
  if (normalized === "initiated") return "initiated";
  return "pending";
}

const mpesaAdapter: BillingProviderAdapter = {
  id: "mpesa",
  mapProviderStatusToInternalStatus: normalizeProviderStatus,
  async initiatePayment(input) {
    return initiateMpesaInvoiceCollection(input);
  },
  async verifyPayment(input) {
    return verifyMpesaPayment(input);
  },
  async reconcilePayment(input) {
    return reconcileMpesaPayment(input);
  },
  async handleCallback(payload) {
    return handleMpesaBillingCallback(payload);
  },
};

const manualAdapter: BillingProviderAdapter = {
  id: "manual",
  mapProviderStatusToInternalStatus: normalizeProviderStatus,
  async initiatePayment(input) {
    return {
      accepted: true,
      internalStatus: "requires_verification",
      transactionReference: `MANUAL-${input.invoice.id}-${nowToken()}`,
      providerReference: null,
      merchantRequestId: null,
      checkoutRequestId: null,
      raw: { provider: "manual", mode: "invoice_collection" },
      resultCode: null,
      resultDescription: "Awaiting manual verification.",
    };
  },
  async verifyPayment() {
    return {
      found: false,
      internalStatus: "requires_verification",
      providerReference: null,
      raw: { provider: "manual", verification: "not_applicable" },
      resultCode: null,
      resultDescription: "Manual verification required.",
    };
  },
  async reconcilePayment() {
    return {
      internalStatus: "requires_verification",
      providerReference: null,
      raw: { provider: "manual", reconciliation: "not_applicable" },
      resultCode: null,
      resultDescription: "Manual reconciliation required.",
    };
  },
  async handleCallback(payload) {
    const ref = String(payload.transactionReference || `MANUAL-CB-${nowToken()}`);
    return {
      eventKey: `manual:${ref}:${String(payload.status || "pending")}`,
      internalStatus: normalizeProviderStatus(String(payload.status || "requires_verification")),
      transactionReference: ref,
      providerReference: String(payload.providerReference || "") || null,
      merchantRequestId: null,
      checkoutRequestId: null,
      resultCode: String(payload.resultCode || "") || null,
      resultDescription: String(payload.resultDescription || "") || null,
      payload,
    };
  },
};

const stripeAdapter: BillingProviderAdapter = {
  id: "stripe",
  mapProviderStatusToInternalStatus: normalizeProviderStatus,
  async initiatePayment(input) {
    const tx = `STRIPE-${input.invoice.id}-${nowToken()}`;
    return {
      accepted: true,
      internalStatus: "pending",
      transactionReference: tx,
      providerReference: tx,
      merchantRequestId: null,
      checkoutRequestId: null,
      raw: { provider: "stripe", mode: "future_adapter_placeholder" },
      resultCode: null,
      resultDescription: "Stripe adapter placeholder.",
    };
  },
  async verifyPayment(input) {
    return {
      found: true,
      internalStatus: "pending",
      providerReference: input.transactionReference,
      raw: { provider: "stripe", verify: "placeholder" },
      resultCode: null,
      resultDescription: "Verification placeholder.",
    };
  },
  async reconcilePayment(input) {
    return {
      internalStatus: "pending",
      providerReference: input.transactionReference,
      raw: { provider: "stripe", reconcile: "placeholder" },
      resultCode: null,
      resultDescription: "Reconciliation placeholder.",
    };
  },
  async handleCallback(payload) {
    const ref = String(payload.transactionReference || `STRIPE-CB-${nowToken()}`);
    return {
      eventKey: `stripe:${ref}:${String(payload.status || "pending")}`,
      internalStatus: normalizeProviderStatus(String(payload.status || "pending")),
      transactionReference: ref,
      providerReference: String(payload.providerReference || ref),
      merchantRequestId: null,
      checkoutRequestId: null,
      resultCode: String(payload.resultCode || "") || null,
      resultDescription: String(payload.resultDescription || "") || null,
      payload,
    };
  },
};

const adapters: Record<PaymentProvider, BillingProviderAdapter> = {
  mpesa: mpesaAdapter,
  manual: manualAdapter,
  stripe: stripeAdapter,
};

export function getBillingProvider(provider: PaymentProvider) {
  return adapters[provider];
}

export function toProviderFromLegacyMethod(method: string | null | undefined): PaymentProvider {
  const normalized = String(method || "").trim().toLowerCase();
  if (normalized === "manual" || normalized === "manual_mpesa") return "manual";
  if (normalized === "stripe" || normalized === "card") return "stripe";
  return "mpesa";
}

