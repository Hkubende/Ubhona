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

export function requestStkPush(payload: StkPushRequest) {
  return api.post<StkPushResponse>("/payments/stk", payload);
}

export function getPaymentStatus(orderId: string, restaurantId?: string) {
  const query = new URLSearchParams();
  if (restaurantId) query.set("restaurantId", restaurantId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return api.get<PaymentStatusResponse>(`/payments/${encodeURIComponent(orderId)}/status${suffix}`);
}
