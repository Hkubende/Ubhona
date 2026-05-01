import { api } from "./api";

export type StkPushRequest = {
  orderId: string;
  phone: string;
  restaurantId?: string;
};

export type StkPushResponse = {
  ok: boolean;
  paymentId: string;
  checkoutRequestId: string;
  message: string;
};

export type PaymentStatusResponse = {
  ok: boolean;
  orderId: string;
  restaurantId: string;
  paymentStatus: string;
  orderStatus: string;
  paymentMethod: string;
  paymentReference: string;
  payment: {
    id: string;
    status: string;
    phone: string;
    amount: number;
    checkoutRequestId: string | null;
    receiptNumber: string | null;
    resultCode: number | null;
    resultDesc: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type PaymentProfileEnvironment = "sandbox" | "live";
export type PaymentProfileStatus = "draft" | "pending_validation" | "active" | "invalid" | "disabled";
export type PaymentProfileValidationState = "unknown" | "valid" | "invalid";

export type RestaurantPaymentProfile = {
  id: string;
  version: number;
  restaurantId: string;
  provider: "mpesa";
  status: PaymentProfileStatus;
  isDefault: true;
  environment: PaymentProfileEnvironment;
  accountDisplayName: string;
  providerAccount: {
    businessShortcode: string;
    paybillNumber: string | null;
    tillNumber: string | null;
  };
  callbackConfig: {
    url: string | null;
    secretConfigured: boolean;
  };
  validation: {
    state: PaymentProfileValidationState;
    lastError: string | null;
    lastValidatedAt: string | null;
  };
  secrets: {
    hasConsumerKey: boolean;
    hasConsumerSecret: boolean;
    hasPasskey: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type RestaurantPaymentProfileStatus = {
  hasProfile: boolean;
  profileStatus: PaymentProfileStatus | null;
  lastValidationResult: PaymentProfileValidationState | null;
  lastValidationError: string | null;
  lastValidationAt: string | null;
  readyForPaymentInitiation: boolean;
};

export type UpsertRestaurantPaymentProfileInput = {
  provider?: "mpesa";
  environment: PaymentProfileEnvironment;
  accountDisplayName: string;
  businessShortcode: string;
  paybillNumber?: string | null;
  tillNumber?: string | null;
  consumerKey?: string;
  consumerSecret?: string;
  passkey?: string;
};

export function requestStkPush(payload: StkPushRequest) {
  return api.post<StkPushResponse>("/payments/stk", payload);
}

export function getPaymentStatus(orderId: string, restaurantId?: string) {
  const query = new URLSearchParams();
  if (restaurantId) query.set("restaurantId", restaurantId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api.get<PaymentStatusResponse>(`/payments/${encodeURIComponent(orderId)}/status${suffix}`);
}

export async function getRestaurantPaymentProfile() {
  const response = await api.get<{ ok: boolean; profile: RestaurantPaymentProfile | null }>("/payments/profile");
  return response.profile;
}

export async function getRestaurantPaymentProfileStatus() {
  const response = await api.get<{ ok: boolean; status: RestaurantPaymentProfileStatus }>("/payments/profile/status");
  return response.status;
}

export async function saveRestaurantPaymentProfile(input: UpsertRestaurantPaymentProfileInput) {
  const response = await api.put<{ ok: boolean; profile: RestaurantPaymentProfile }>("/payments/profile", input);
  return response.profile;
}

export async function validateRestaurantPaymentProfile() {
  const response = await api.post<{ ok: boolean; profile: RestaurantPaymentProfile }>("/payments/profile/validate", {});
  return response.profile;
}

export async function activateRestaurantPaymentProfile() {
  const response = await api.post<{ ok: boolean; profile: RestaurantPaymentProfile }>("/payments/profile/activate", {});
  return response.profile;
}

export async function disableRestaurantPaymentProfile() {
  const response = await api.post<{ ok: boolean; profile: RestaurantPaymentProfile }>("/payments/profile/disable", {});
  return response.profile;
}