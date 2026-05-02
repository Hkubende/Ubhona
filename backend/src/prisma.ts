import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  createRlsAwarePrisma,
  PAYMENT_CALLBACK_SYSTEM_USER_ID,
  runWithDbRlsContext,
  runWithPaymentCallbackDbContext,
  runWithPaymentCallbackResolutionDbContext,
} from "./db-rls.js";
import { applyRuntimeDatabaseUrlContract } from "./env/runtime-db-url.js";

dotenv.config();
applyRuntimeDatabaseUrlContract();

const basePrisma = new PrismaClient();

export const prisma = createRlsAwarePrisma(basePrisma);
export { PAYMENT_CALLBACK_SYSTEM_USER_ID };

export type TenantContextInput = {
  restaurantId?: string;
  userId: string;
  isAdmin: boolean;
};

export type PaymentCallbackActorContext = {
  actorType: "payment_provider_callback";
  actorIdentifier: string;
  restaurantId: string;
  isAdmin: false;
};

export type PaymentCallbackLinkage = {
  paymentId: string;
  orderId: string;
  paymentRestaurantId: string;
  orderRestaurantId: string;
  paymentStatus: string;
  orderStatus: string;
  orderPaymentStatus: string;
  resultCode: number | null;
  receiptNumber: string | null;
  checkoutRequestId: string;
  merchantRequestId: string | null;
};

export async function runWithTenantContext<T>(input: TenantContextInput & {
  fn: (tx: Prisma.TransactionClient) => Promise<T>;
}): Promise<T> {
  const { fn, ...context } = input;

  return runWithDbRlsContext(context, () =>
    prisma.$transaction(async (tx) => {
      return fn(tx as Prisma.TransactionClient);
    })
  );
}

export async function findPaymentCallbackLinkage(input: {
  actorIdentifier: string;
}): Promise<PaymentCallbackLinkage | null> {
  return runWithPaymentCallbackResolutionDbContext(input, async () => {
    const payment = await prisma.payment.findUnique({
      where: { checkoutRequestId: input.actorIdentifier },
      select: {
        id: true,
        orderId: true,
        restaurantId: true,
        status: true,
        resultCode: true,
        receiptNumber: true,
        checkoutRequestId: true,
        merchantRequestId: true,
        order: {
          select: {
            restaurantId: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!payment) {
      return null;
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      paymentRestaurantId: payment.restaurantId,
      orderRestaurantId: payment.order.restaurantId,
      paymentStatus: payment.status,
      orderStatus: payment.order.status,
      orderPaymentStatus: payment.order.paymentStatus,
      resultCode: payment.resultCode,
      receiptNumber: payment.receiptNumber,
      checkoutRequestId: payment.checkoutRequestId || input.actorIdentifier,
      merchantRequestId: payment.merchantRequestId,
    } satisfies PaymentCallbackLinkage;
  });
}

export async function runWithPaymentCallbackContext<T>(input: PaymentCallbackActorContext & {
  fn: (tx: Prisma.TransactionClient) => Promise<T>;
}): Promise<T> {
  const { fn, actorIdentifier, restaurantId } = input;

  return runWithPaymentCallbackDbContext({ actorIdentifier, restaurantId }, () =>
    prisma.$transaction(async (tx) => {
      return fn(tx as Prisma.TransactionClient);
    })
  );
}

export async function runWithPaymentCallbackRlsContext<T>(input: PaymentCallbackActorContext & {
  fn: () => Promise<T>;
}): Promise<T> {
  const { fn, actorIdentifier, restaurantId } = input;
  return runWithPaymentCallbackDbContext({ actorIdentifier, restaurantId }, fn);
}