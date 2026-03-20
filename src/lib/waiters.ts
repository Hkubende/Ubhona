export type Waiter = {
  id: string;
  restaurantId: string;
  name: string;
  code: string;
  pin?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WaiterSession = {
  waiterId: string;
  restaurantId: string;
  name: string;
  code: string;
  loggedIn: boolean;
  loggedInAt: string;
};

const WAITER_KEY_PREFIX = "ubhona_waiters_v1_";
const WAITER_SESSION_KEY = "ubhona_waiter_session_v1";

function keyForRestaurant(restaurantId: string) {
  return `${WAITER_KEY_PREFIX}${String(restaurantId || "").trim().toLowerCase()}`;
}

function normalizeWaiter(row: Partial<Waiter>, restaurantId: string): Waiter | null {
  const id = String(row.id || "").trim();
  const name = String(row.name || "").trim();
  const code = String(row.code || "").trim().toLowerCase();
  if (!id || !name || !code) return null;
  return {
    id,
    restaurantId,
    name,
    code,
    pin: String(row.pin || "").trim() || undefined,
    active: row.active !== false,
    createdAt: String(row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
}

export function getWaiters(restaurantId: string): Waiter[] {
  const safeRestaurantId = String(restaurantId || "").trim();
  if (!safeRestaurantId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(keyForRestaurant(safeRestaurantId)) || "[]") as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeWaiter((row || {}) as Partial<Waiter>, safeRestaurantId))
      .filter((row): row is Waiter => Boolean(row));
  } catch {
    return [];
  }
}

function saveWaiters(restaurantId: string, waiters: Waiter[]) {
  localStorage.setItem(keyForRestaurant(restaurantId), JSON.stringify(waiters));
  return waiters;
}

export function addWaiter(input: {
  restaurantId: string;
  name: string;
  code: string;
  pin?: string;
}) {
  const restaurantId = String(input.restaurantId || "").trim();
  const name = String(input.name || "").trim();
  const code = String(input.code || "").trim().toLowerCase();
  if (!restaurantId) throw new Error("Restaurant is required.");
  if (!name) throw new Error("Waiter name is required.");
  if (!code) throw new Error("Waiter code is required.");

  const existing = getWaiters(restaurantId);
  if (existing.some((waiter) => waiter.code === code)) {
    throw new Error("Waiter code already exists.");
  }

  const now = new Date().toISOString();
  const waiter: Waiter = {
    id: `waiter_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`,
    restaurantId,
    name,
    code,
    pin: String(input.pin || "").trim() || undefined,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  return saveWaiters(restaurantId, [waiter, ...existing]);
}

export function updateWaiter(
  restaurantId: string,
  waiterId: string,
  patch: Partial<Pick<Waiter, "name" | "code" | "pin" | "active">>
) {
  const safeRestaurantId = String(restaurantId || "").trim();
  const safeWaiterId = String(waiterId || "").trim();
  if (!safeRestaurantId || !safeWaiterId) throw new Error("Waiter reference is required.");

  const existing = getWaiters(safeRestaurantId);
  const next = existing.map((waiter) => {
    if (waiter.id !== safeWaiterId) return waiter;
    const nextCode = patch.code ? patch.code.trim().toLowerCase() : waiter.code;
    return {
      ...waiter,
      name: patch.name ? patch.name.trim() : waiter.name,
      code: nextCode,
      pin: patch.pin !== undefined ? String(patch.pin || "").trim() || undefined : waiter.pin,
      active: typeof patch.active === "boolean" ? patch.active : waiter.active,
      updatedAt: new Date().toISOString(),
    };
  });

  const duplicateCode = next
    .filter((waiter) => waiter.id !== safeWaiterId)
    .some((waiter) => waiter.code === next.find((item) => item.id === safeWaiterId)?.code);
  if (duplicateCode) throw new Error("Waiter code already exists.");

  return saveWaiters(safeRestaurantId, next);
}

export function setWaiterActive(restaurantId: string, waiterId: string, active: boolean) {
  return updateWaiter(restaurantId, waiterId, { active });
}

export function getWaiterSession(restaurantId?: string): WaiterSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(WAITER_SESSION_KEY) || "null") as WaiterSession | null;
    if (!parsed || typeof parsed !== "object") return null;
    const session: WaiterSession = {
      waiterId: String(parsed.waiterId || "").trim(),
      restaurantId: String(parsed.restaurantId || "").trim(),
      name: String(parsed.name || "").trim(),
      code: String(parsed.code || "").trim(),
      loggedIn: parsed.loggedIn !== false,
      loggedInAt: String(parsed.loggedInAt || "").trim() || new Date().toISOString(),
    };
    if (!session.waiterId || !session.restaurantId) return null;
    if (restaurantId && session.restaurantId !== String(restaurantId || "").trim()) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearWaiterSession() {
  localStorage.removeItem(WAITER_SESSION_KEY);
}

export function createWaiterSession(input: {
  restaurantId: string;
  waiterCode: string;
  pin?: string;
}) {
  const restaurantId = String(input.restaurantId || "").trim();
  const waiterCode = String(input.waiterCode || "").trim().toLowerCase();
  const pin = String(input.pin || "").trim();
  if (!restaurantId || !waiterCode) throw new Error("Waiter code is required.");

  const waiters = getWaiters(restaurantId).filter((waiter) => waiter.active);
  const waiter = waiters.find((row) => row.code === waiterCode);
  if (!waiter) throw new Error("Waiter not found or inactive.");
  if (waiter.pin && waiter.pin !== pin) throw new Error("Invalid waiter PIN.");

  const session: WaiterSession = {
    waiterId: waiter.id,
    restaurantId,
    name: waiter.name,
    code: waiter.code,
    loggedIn: true,
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(WAITER_SESSION_KEY, JSON.stringify(session));
  return session;
}
