export type ImageVariant = "small" | "medium" | "large";

const FALLBACK_IMAGE = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

function isLikelySafeImageUrl(value: string) {
  if (!value) return false;
  if (/^(blob:|data:)/i.test(value)) return true;
  if (/^\//.test(value)) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return false;
}

export function resolveDishImageSrc(url: string) {
  const value = String(url || "").trim();
  if (!value) return FALLBACK_IMAGE;
  if (!isLikelySafeImageUrl(value)) return FALLBACK_IMAGE;
  return value;
}

export function applyDishImageFallback(
  event: { currentTarget: HTMLImageElement },
  originalUrl: string
) {
  const image = event.currentTarget;
  if (!image) return;
  if (image.dataset.fallbackApplied === "1") {
    image.src = FALLBACK_IMAGE;
    return;
  }
  image.dataset.fallbackApplied = "1";
  const original = resolveDishImageSrc(originalUrl);
  image.src = original || FALLBACK_IMAGE;
}

export function getDishImageVariantUrl(url: string, variant: ImageVariant) {
  const resolved = resolveDishImageSrc(url);
  if (resolved === FALLBACK_IMAGE) return resolved;
  if (/^(blob:|data:)/i.test(resolved)) return resolved;

  const parsed = (() => {
    try {
      return new URL(resolved);
    } catch {
      return null;
    }
  })();
  if (!parsed) return resolved;

  const pathname = parsed.pathname;
  if (!pathname.includes("/thumbnails/")) return resolved;

  const variantPath = pathname.replace(/\/(thumbnail|small|medium|large)\.[a-z0-9]+$/i, `/${variant}.webp`);
  if (variantPath === pathname) return resolved;
  parsed.pathname = variantPath;
  return parsed.toString();
}
