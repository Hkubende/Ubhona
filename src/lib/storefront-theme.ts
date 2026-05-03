const DEFAULT_PRIMARY = "#FF6A1A";
const DEFAULT_SECONDARY = "#E8D8C3";
const HERO_TEXT_FALLBACK = "#FFB06E";
const HERO_BG_REFERENCE = "#12100F";

export function normalizeStorefrontColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (shortHex) {
    const [, short] = shortHex;
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`.toUpperCase();
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(trimmed);
  return hex ? `#${hex[1].toUpperCase()}` : fallback;
}

function hexToRgb(value: string) {
  const normalized = normalizeStorefrontColor(value, DEFAULT_PRIMARY);
  const hex = normalized.slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function relativeLuminance(value: string) {
  const { r, g, b } = hexToRgb(value);
  const transform = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const [red, green, blue] = [transform(r), transform(g), transform(b)];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableStorefrontHeroAccent(candidate: string | undefined) {
  const normalized = normalizeStorefrontColor(candidate, DEFAULT_PRIMARY);
  return contrastRatio(normalized, HERO_BG_REFERENCE) >= 4.5 ? normalized : HERO_TEXT_FALLBACK;
}

export function getStorefrontBrandColors(brand: {
  themePrimary?: string;
  themeSecondary?: string;
}) {
  const primary = normalizeStorefrontColor(brand.themePrimary, DEFAULT_PRIMARY);
  const secondary = normalizeStorefrontColor(brand.themeSecondary, DEFAULT_SECONDARY);
  return {
    primary,
    secondary,
    heroAccent: getReadableStorefrontHeroAccent(primary),
  };
}
