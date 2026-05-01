import type { UserRole } from "@prisma/client";

export const PAYMENT_CALLBACK_SYSTEM_ACTOR_KEY = "payment_provider_callback";
export const PAYMENT_CALLBACK_SYSTEM_ROLE: UserRole = "platform_admin";

export const BILLING_PROVIDER_CALLBACK_SYSTEM_ACTOR_KEY = "billing_provider_callback";
export const BILLING_PROVIDER_CALLBACK_SYSTEM_ROLE: UserRole = "platform_admin";

export const STOREFRONT_CHECKOUT_SYSTEM_ACTOR_KEY = "storefront_checkout";
export const STOREFRONT_CHECKOUT_SYSTEM_ROLE: UserRole = "restaurant_owner";

const SYSTEM_ACTOR_LABELS = {
  [PAYMENT_CALLBACK_SYSTEM_ACTOR_KEY]: "Payment Callback System",
  [BILLING_PROVIDER_CALLBACK_SYSTEM_ACTOR_KEY]: "Billing Provider Callback",
  [STOREFRONT_CHECKOUT_SYSTEM_ACTOR_KEY]: "Storefront Checkout",
} as const;

export type SystemActorKey = keyof typeof SYSTEM_ACTOR_LABELS;

export function getSystemActorLabel(systemActorKey: string | null | undefined) {
  if (!systemActorKey) return null;
  return SYSTEM_ACTOR_LABELS[systemActorKey as SystemActorKey] || `System (${systemActorKey})`;
}
