import { prisma } from "../prisma.js";
import {
  normalizePlan,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "./subscription.service.js";

export async function getOwnedRestaurant(userId: string) {
  return prisma.restaurant.findFirst({
    where: { ownerUserId: userId },
  });
}

export async function getRestaurantBySlug(slug: string) {
  return prisma.restaurant.findUnique({
    where: { slug: slug.trim().toLowerCase() },
  });
}

export async function createRestaurant(
  userId: string,
  input: {
    name: string;
    slug: string;
    phone: string;
    email: string;
    location: string;
    logoUrl?: string;
    coverImage?: string;
    themePrimary?: string;
    themeSecondary?: string;
    shortDescription?: string;
    subscriptionPlan?: SubscriptionPlan;
    subscriptionStatus?: SubscriptionStatus;
    trialEndsAt?: string;
    renewalDate?: string;
  }
) {
  const existing = await getOwnedRestaurant(userId);
  if (existing) return existing;
  return prisma.restaurant.create({
    data: {
      ownerUserId: userId,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      location: input.location.trim(),
      logoUrl: input.logoUrl?.trim() || null,
      coverImage: input.coverImage?.trim() || null,
      themePrimary: input.themePrimary?.trim() || null,
      themeSecondary: input.themeSecondary?.trim() || null,
      shortDescription: input.shortDescription?.trim() || null,
      subscriptionPlan: normalizePlan(input.subscriptionPlan),
      subscriptionStatus: input.subscriptionStatus?.trim().toLowerCase() || "trialing",
      trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      renewalDate: input.renewalDate ? new Date(input.renewalDate) : null,
    },
  });
}

export async function updateRestaurant(
  userId: string,
  input: Partial<{
    name: string;
    slug: string;
    phone: string;
    email: string;
    location: string;
    logoUrl?: string;
    coverImage?: string;
    themePrimary?: string;
    themeSecondary?: string;
    shortDescription?: string;
    subscriptionPlan?: SubscriptionPlan;
    subscriptionStatus?: SubscriptionStatus;
    trialEndsAt?: string | null;
    renewalDate?: string | null;
  }>
) {
  const existing = await getOwnedRestaurant(userId);
  if (!existing) return null;
  return prisma.restaurant.update({
    where: { id: existing.id },
    data: {
      name: input.name?.trim() ?? existing.name,
      slug: input.slug?.trim().toLowerCase() ?? existing.slug,
      phone: input.phone?.trim() ?? existing.phone,
      email: input.email?.trim().toLowerCase() ?? existing.email,
      location: input.location?.trim() ?? existing.location,
      logoUrl: input.logoUrl?.trim() ?? existing.logoUrl,
      coverImage: input.coverImage?.trim() ?? existing.coverImage,
      themePrimary: input.themePrimary?.trim() ?? existing.themePrimary,
      themeSecondary: input.themeSecondary?.trim() ?? existing.themeSecondary,
      shortDescription: input.shortDescription?.trim() ?? existing.shortDescription,
      subscriptionPlan: input.subscriptionPlan ? normalizePlan(input.subscriptionPlan) : existing.subscriptionPlan,
      subscriptionStatus: input.subscriptionStatus?.trim().toLowerCase() ?? existing.subscriptionStatus,
      trialEndsAt:
        input.trialEndsAt === null
          ? null
          : input.trialEndsAt
            ? new Date(input.trialEndsAt)
            : existing.trialEndsAt,
      renewalDate:
        input.renewalDate === null
          ? null
          : input.renewalDate
            ? new Date(input.renewalDate)
            : existing.renewalDate,
    },
  });
}
