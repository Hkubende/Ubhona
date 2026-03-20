import {
  createPaymentReference,
  getPaymentMethodLabel,
  setLocalStorefrontOrderPayment,
  type OrderPaymentMethod,
} from "./orders";

export type StorefrontPaymentMethod = OrderPaymentMethod;

export type StorefrontPaymentShellResult = {
  orderId: string;
  restaurantId: string;
  method: StorefrontPaymentMethod;
  paymentStatus: string;
  paymentReference: string;
  title: string;
  message: string;
};

export function getStorefrontPaymentMethods(): Array<{
  id: StorefrontPaymentMethod;
  label: string;
  description: string;
}> {
  return [
    {
      id: "stk_push",
      label: "M-Pesa STK (Placeholder)",
      description: "Order is created now. STK push integration will be connected to backend next.",
    },
    {
      id: "manual_mpesa",
      label: "Manual Payment",
      description: "Order is created now. Customer can pay manually and confirm with restaurant.",
    },
  ];
}

export function initializeStorefrontPaymentShell(input: {
  orderId: string;
  restaurantId: string;
  method: StorefrontPaymentMethod;
  customerPhone?: string;
}) {
  const paymentReference =
    input.method === "stk_push" ? `STK-${createPaymentReference()}` : `MANUAL-${createPaymentReference()}`;
  const paymentStatus =
    input.method === "stk_push" ? "payment_pending_provider" : "payment_pending_manual_confirmation";

  setLocalStorefrontOrderPayment(input.orderId, input.restaurantId, {
    paymentMethod: input.method,
    paymentStatus,
    paymentReference,
  });

  const methodLabel = getPaymentMethodLabel(input.method);
  const title =
    input.method === "stk_push" ? "STK placeholder initialized" : "Manual payment placeholder initialized";
  const message =
    input.method === "stk_push"
      ? `Order created. ${methodLabel} is set to pending. Connect backend STK endpoint to complete payment flow.`
      : `Order created. ${methodLabel} is set to pending manual confirmation.`;

  return {
    orderId: input.orderId,
    restaurantId: input.restaurantId,
    method: input.method,
    paymentStatus,
    paymentReference,
    title,
    message,
  } satisfies StorefrontPaymentShellResult;
}

