import type { Restaurant } from "../types/dashboard";
import type { RestaurantProfile } from "./restaurant";

const DEMO_IDS = new Set(["local_default_restaurant", "local_demo_restaurant", "demo_restaurant"]);
const DEMO_SLUGS = new Set(["demo", "ubhona-demo", "ubhona"]);

type RestaurantLike = Pick<Restaurant, "id" | "slug" | "email" | "name"> | Pick<RestaurantProfile, "id" | "slug" | "email" | "restaurantName">;

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function isDemoDataError(error?: string | null) {
  const value = normalize(error);
  return value.includes("static/demo mode") || value.includes("demo mode");
}

export function isOfflineFallbackError(error?: string | null) {
  const value = normalize(error);
  return value.includes("api is unreachable") || value.includes("api is not configured");
}

export function isDemoRestaurantLike(restaurant?: RestaurantLike | null) {
  if (!restaurant) return false;
  const id = normalize(restaurant.id);
  const slug = normalize(restaurant.slug);
  const email = normalize(restaurant.email);
  const name = "restaurantName" in restaurant ? normalize(restaurant.restaurantName) : normalize(restaurant.name);
  return (
    DEMO_IDS.has(id) ||
    DEMO_SLUGS.has(slug) ||
    email.includes("demo@") ||
    name.includes("demo")
  );
}

export function getDataHonestyState({
  error,
  restaurant,
}: {
  error?: string | null;
  restaurant?: RestaurantLike | null;
}) {
  const isDemo = isDemoDataError(error) || isDemoRestaurantLike(restaurant);
  const isOfflineFallback = isOfflineFallbackError(error);
  return {
    isDemo,
    isOfflineFallback,
    badgeLabel: isDemo ? "Demo data" : null,
  };
}
