export function getStorefrontMenuUrl(slug: string) {
  const cleanSlug = String(slug || "").trim();
  if (!cleanSlug) return "";
  if (typeof window === "undefined") return `/r/${cleanSlug}/menu`;
  const explicitBase = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const base = explicitBase || `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}`;
  return `${base}/r/${cleanSlug}/menu`;
}

export function getDishUrl(restaurantSlug: string, dishId: string) {
  const cleanSlug = String(restaurantSlug || "").trim();
  const cleanDishId = String(dishId || "").trim();
  if (!cleanSlug || !cleanDishId) return "";
  if (typeof window === "undefined") return `/r/${cleanSlug}/dish/${cleanDishId}`;
  const explicitBase = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const base = explicitBase || `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}`;
  return `${base}/r/${cleanSlug}/dish/${cleanDishId}`;
}

// Backward-compatible alias.
export function getStorefrontDishUrl(slug: string, dishId: string) {
  return getDishUrl(slug, dishId);
}

export function getQrCodeImageUrl(value: string, size = 220) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  const clamped = Math.max(120, Math.min(512, Math.floor(size)));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${clamped}x${clamped}&data=${encodeURIComponent(clean)}`;
}
