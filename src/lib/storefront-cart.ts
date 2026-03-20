export type StorefrontCart = Record<string, number>;
type StorefrontCartScope = {
  slug: string;
  restaurantId?: string;
};

type PersistedStorefrontCart = {
  slug: string;
  restaurantId?: string;
  items: StorefrontCart;
  updatedAt: string;
};

const LEGACY_KEY_PREFIX = "mv_storefront_cart_";
const CART_KEY_PREFIX = "mv_storefront_cart_scope_";
const ACTIVE_CART_KEY = "mv_storefront_cart_active_v1";
const CART_REGISTRY_KEY = "mv_storefront_cart_registry_v1";

function sanitizeCart(input: unknown): StorefrontCart {
  if (!input || typeof input !== "object") return {};
  const next: StorefrontCart = {};
  for (const [dishId, qty] of Object.entries(input as Record<string, unknown>)) {
    if (!dishId || typeof dishId !== "string") continue;
    const parsed = Math.floor(Number(qty));
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    next[dishId] = parsed;
  }
  return next;
}

export function storefrontCartKey(slug: string) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  return `${LEGACY_KEY_PREFIX}${normalizedSlug}_v1`;
}

function normalizeScope(scope: StorefrontCartScope) {
  return {
    slug: String(scope.slug || "").trim().toLowerCase(),
    restaurantId: String(scope.restaurantId || "").trim().toLowerCase() || undefined,
  };
}

function scopedCartKey(scope: StorefrontCartScope) {
  const normalized = normalizeScope(scope);
  const identity = normalized.restaurantId || normalized.slug || "unknown";
  return `${CART_KEY_PREFIX}${identity}_v2`;
}

function readRegistry() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_REGISTRY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => String(value || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function writeRegistry(keys: string[]) {
  const normalized = Array.from(new Set(keys.map((key) => String(key || "").trim()).filter(Boolean)));
  localStorage.setItem(CART_REGISTRY_KEY, JSON.stringify(normalized));
}

function readPersisted(scope: StorefrontCartScope): PersistedStorefrontCart | null {
  const key = scopedCartKey(scope);
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null") as PersistedStorefrontCart | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      slug: String(parsed.slug || "").trim().toLowerCase(),
      restaurantId: String(parsed.restaurantId || "").trim().toLowerCase() || undefined,
      items: sanitizeCart(parsed.items),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

function writePersisted(scope: StorefrontCartScope, cart: StorefrontCart) {
  const normalized = normalizeScope(scope);
  const key = scopedCartKey(scope);
  const payload: PersistedStorefrontCart = {
    slug: normalized.slug,
    restaurantId: normalized.restaurantId,
    items: sanitizeCart(cart),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(payload));
  const existing = readRegistry();
  writeRegistry([...existing, key]);
}

function clearAllOtherCarts(activeKey: string) {
  const keys = readRegistry();
  for (const key of keys) {
    if (key === activeKey) continue;
    localStorage.removeItem(key);
  }
  writeRegistry([activeKey]);
}

function loadLegacyCart(slug: string) {
  try {
    return sanitizeCart(JSON.parse(localStorage.getItem(storefrontCartKey(slug)) || "{}"));
  } catch {
    return {};
  }
}

export function loadStorefrontCart(scope: StorefrontCartScope): StorefrontCart {
  const normalized = normalizeScope(scope);
  if (!normalized.slug) return {};

  const persisted = readPersisted(normalized);
  if (persisted) {
    const activeRestaurantId = String(localStorage.getItem(ACTIVE_CART_KEY) || "").trim().toLowerCase();
    if (normalized.restaurantId && activeRestaurantId && activeRestaurantId !== normalized.restaurantId) {
      return {};
    }
    return sanitizeCart(persisted.items);
  }

  const legacy = loadLegacyCart(normalized.slug);
  if (!Object.keys(legacy).length) return {};

  if (normalized.restaurantId) {
    writePersisted(normalized, legacy);
    localStorage.setItem(ACTIVE_CART_KEY, normalized.restaurantId);
    clearAllOtherCarts(scopedCartKey(normalized));
    localStorage.removeItem(storefrontCartKey(normalized.slug));
  }
  return legacy;
}

export function saveStorefrontCart(scope: StorefrontCartScope, cart: StorefrontCart) {
  const normalized = normalizeScope(scope);
  if (!normalized.slug) return;
  const safeCart = sanitizeCart(cart);
  writePersisted(normalized, safeCart);
  if (normalized.restaurantId) {
    localStorage.setItem(ACTIVE_CART_KEY, normalized.restaurantId);
    clearAllOtherCarts(scopedCartKey(normalized));
  }
}

export function addStorefrontCartItem(cart: StorefrontCart, dishId: string, quantity = 1) {
  const safeCart = sanitizeCart(cart);
  const parsedQty = Math.max(1, Math.floor(Number(quantity) || 1));
  return {
    ...safeCart,
    [dishId]: (safeCart[dishId] || 0) + parsedQty,
  };
}

export function setStorefrontCartItemQuantity(
  cart: StorefrontCart,
  dishId: string,
  quantity: number
) {
  const safeCart = sanitizeCart(cart);
  const nextQty = Math.floor(Number(quantity) || 0);
  const next = { ...safeCart };
  if (nextQty <= 0) {
    delete next[dishId];
  } else {
    next[dishId] = nextQty;
  }
  return next;
}

export function removeStorefrontCartItem(cart: StorefrontCart, dishId: string) {
  const safeCart = sanitizeCart(cart);
  const next = { ...safeCart };
  delete next[dishId];
  return next;
}

export function clearStorefrontCart(scope: StorefrontCartScope) {
  saveStorefrontCart(scope, {});
}

export function storefrontCartCount(cart: StorefrontCart) {
  return Object.values(sanitizeCart(cart)).reduce((sum, qty) => sum + qty, 0);
}

export function storefrontCartTotal(
  cart: StorefrontCart,
  priceByDishId: Record<string, number>
) {
  return Object.entries(sanitizeCart(cart)).reduce((sum, [dishId, qty]) => {
    const price = Number(priceByDishId[dishId] || 0);
    if (!Number.isFinite(price) || price <= 0) return sum;
    return sum + price * qty;
  }, 0);
}
