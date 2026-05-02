import { ApiError, api, AUTH_TOKEN_KEY } from "./api";
import { allowOfflineDemoFallback, isApiConfigured } from "./config";
import { clearRestaurantProfile, getRestaurantProfile, type RestaurantProfile } from "./restaurant";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role:
    | "platform_admin"
    | "restaurant_owner"
    | "restaurant_admin"
    | "restaurant_manager"
    | "restaurant_waiter"
    | "restaurant_kitchen"
    | "staff";
  createdAt: string;
};

export type SessionState = {
  user: AuthUser | null;
  restaurant: RestaurantProfile | null;
  token: string | null;
  authenticated: boolean;
  onboardingCompleted: boolean;
};

const SESSION_KEY = "mv_auth_user_v1";
const LOCAL_USERS_KEY = "mv_auth_local_users_v1";
const LOCAL_RESET_TOKENS_KEY = "mv_auth_local_reset_tokens_v1";
const LOCAL_TOKEN_PREFIX = "local:";
const PROFILE_KEY = "mv_restaurant_profile_v1";
const PROFILE_REGISTRY_KEY = "mv_restaurant_profiles_registry_v1";
const CATEGORIES_KEY = "mv_restaurant_categories_v1";
const DISHES_KEY = "mv_restaurant_dishes_v1";
export const DEMO_USER_ID = "local_demo_owner";
export const DEMO_EMAIL = "demo@ubhona.app";
export const DEMO_PASSWORD = "demo12345";
const DEMO_BASE = import.meta.env.BASE_URL || "/";

type DemoCategory = {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

type DemoDish = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  desc: string;
  price: number;
  thumb: string;
  model: string;
  isAvailable: boolean;
  createdAt: string;
};

type LocalAuthUser = AuthUser & { password: string };

function normalizeRole(value: unknown): AuthUser["role"] {
  const role = String(value || "").trim();
  if (
    role === "platform_admin" ||
    role === "restaurant_owner" ||
    role === "restaurant_admin" ||
    role === "restaurant_manager" ||
    role === "restaurant_waiter" ||
    role === "restaurant_kitchen" ||
    role === "staff"
  ) {
    return role;
  }
  return "restaurant_owner";
}

function writeSession(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function readSession(): AuthUser | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.email !== "string" ||
      typeof row.createdAt !== "string"
    ) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.createdAt,
      role: normalizeRole(row.role),
    };
  } catch {
    return null;
  }
}

function normalizeSignupInput(
  nameOrInput: string | { name: string; email: string; password: string },
  emailArg?: string,
  passwordArg?: string
) {
  if (typeof nameOrInput === "object") return nameOrInput;
  return {
    name: nameOrInput,
    email: emailArg || "",
    password: passwordArg || "",
  };
}

function readLocalUsers(): LocalAuthUser[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const input = row as Record<string, unknown>;
        const id = typeof input.id === "string" ? input.id : "";
        const name = typeof input.name === "string" ? input.name : "";
        const email = typeof input.email === "string" ? input.email.toLowerCase() : "";
        const password = typeof input.password === "string" ? input.password : "";
        const createdAt = typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString();
        const role = normalizeRole(input.role);
        if (!id || !name || !email || !password) return null;
        return { id, name, email, password, createdAt, role };
      })
      .filter((user): user is LocalAuthUser => !!user);
  } catch {
    return [];
  }
}

function writeLocalUsers(users: LocalAuthUser[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function readLocalResetTokens(): Record<string, { email: string; expiresAt: number }> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_RESET_TOKENS_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, { email: string; expiresAt: number }> = {};
    for (const [token, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const email = String(row.email || "").trim().toLowerCase();
      const expiresAt = Number(row.expiresAt || 0);
      if (!email || !Number.isFinite(expiresAt)) continue;
      out[token] = { email, expiresAt };
    }
    return out;
  } catch {
    return {};
  }
}

function writeLocalResetTokens(tokens: Record<string, { email: string; expiresAt: number }>) {
  localStorage.setItem(LOCAL_RESET_TOKENS_KEY, JSON.stringify(tokens));
}

function buildPublicResetUrl(token: string) {
  if (typeof window === "undefined") return `/reset-password?token=${encodeURIComponent(token)}`;
  const origin = window.location.origin.replace(/\/+$/, "");
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  const path = base ? `${base}/reset-password` : "/reset-password";
  return `${origin}${path}?token=${encodeURIComponent(token)}`;
}

function withBase(path: string) {
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${DEMO_BASE}${path.replace(/^\/+/, "")}`;
}

function readByRestaurant<T>(key: string): Record<string, T[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, T[]> = {};
    for (const [restaurantId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      out[restaurantId] = value as T[];
    }
    return out;
  } catch {
    return {};
  }
}

function writeByRestaurant<T>(key: string, value: Record<string, T[]>) {
  localStorage.setItem(key, JSON.stringify(value));
}

function seedDemoRestaurantData() {
  const now = new Date().toISOString();
  const demoRestaurantId = "local_demo_restaurant";
  const demoSlug = "demo";

  const profile = {
    id: demoRestaurantId,
    restaurantName: "Ubhona Demo Bistro",
    slug: demoSlug,
    phone: "+254700000001",
    email: DEMO_EMAIL,
    location: "Nairobi, Kenya",
    logo: withBase("ubhona-logo.jpeg"),
    shortDescription: "Demo restaurant showcasing available 3D models and menu media.",
    subscriptionPlan: "starter",
    subscriptionStatus: "trialing",
    trialEndsAt: null,
    renewalDate: null,
    createdAt: now,
  };

  const categories: DemoCategory[] = [
    { id: "demo_cat_mains", restaurantId: demoRestaurantId, name: "Mains", sortOrder: 0, createdAt: now },
    { id: "demo_cat_drinks", restaurantId: demoRestaurantId, name: "Drinks", sortOrder: 1, createdAt: now },
    { id: "demo_cat_desserts", restaurantId: demoRestaurantId, name: "Desserts", sortOrder: 2, createdAt: now },
  ];

  const dishes: DemoDish[] = [
    {
      id: "demo_burger_fries",
      restaurantId: demoRestaurantId,
      categoryId: "demo_cat_mains",
      name: "Burger & Fries",
      desc: "Signature burger served with crispy fries.",
      price: 950,
      thumb: withBase("thumbs/burger-fries.png"),
      model: withBase("models/burger-fries.glb"),
      isAvailable: true,
      createdAt: now,
    },
    {
      id: "demo_chicken_burger",
      restaurantId: demoRestaurantId,
      categoryId: "demo_cat_mains",
      name: "Chicken Burger",
      desc: "Grilled chicken burger with sauce and greens.",
      price: 880,
      thumb: withBase("thumbs/chicken-burger.png"),
      model: withBase("models/chicken-burger.glb"),
      isAvailable: true,
      createdAt: now,
    },
    {
      id: "demo_lasagna",
      restaurantId: demoRestaurantId,
      categoryId: "demo_cat_mains",
      name: "Lasagna",
      desc: "Layered pasta with rich tomato and cheese.",
      price: 1100,
      thumb: withBase("thumbs/lasagna.png"),
      model: withBase("models/lasagna.glb"),
      isAvailable: true,
      createdAt: now,
    },
    {
      id: "demo_rootbeer",
      restaurantId: demoRestaurantId,
      categoryId: "demo_cat_drinks",
      name: "Roxie Rootbeer",
      desc: "Refreshing chilled rootbeer.",
      price: 320,
      thumb: withBase("thumbs/roxie-rootbeer.png"),
      model: withBase("models/roxie-rootbeer.glb"),
      isAvailable: true,
      createdAt: now,
    },
    {
      id: "demo_litchi_juice",
      restaurantId: demoRestaurantId,
      categoryId: "demo_cat_drinks",
      name: "Litchi Juice",
      desc: "Sweet tropical litchi drink.",
      price: 280,
      thumb: withBase("thumbs/litchi-juice.png"),
      model: withBase("models/litchi-juice.glb"),
      isAvailable: true,
      createdAt: now,
    },
    {
      id: "demo_cookies",
      restaurantId: demoRestaurantId,
      categoryId: "demo_cat_desserts",
      name: "Cookies",
      desc: "Crunchy baked cookies.",
      price: 260,
      thumb: withBase("thumbs/cookies.png"),
      model: withBase("models/cookies.glb"),
      isAvailable: true,
      createdAt: now,
    },
  ];

  const registry = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_REGISTRY_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed as Array<{ id?: string; slug?: string; restaurantName?: string }>;
    } catch {
      return [];
    }
  })();
  const nextRegistry = registry.filter((row) => row?.id !== demoRestaurantId && row?.slug !== demoSlug);
  nextRegistry.push({ id: demoRestaurantId, slug: demoSlug, restaurantName: "Ubhona Demo Bistro" });
  localStorage.setItem(PROFILE_REGISTRY_KEY, JSON.stringify(nextRegistry));

  const categoriesByRestaurant = readByRestaurant<DemoCategory>(CATEGORIES_KEY);
  if (!categoriesByRestaurant[demoRestaurantId]?.length) {
    categoriesByRestaurant[demoRestaurantId] = categories;
    writeByRestaurant(CATEGORIES_KEY, categoriesByRestaurant);
  }

  const dishesByRestaurant = readByRestaurant<DemoDish>(DISHES_KEY);
  if (!dishesByRestaurant[demoRestaurantId]?.length) {
    dishesByRestaurant[demoRestaurantId] = dishes;
    writeByRestaurant(DISHES_KEY, dishesByRestaurant);
  }

  return profile;
}

function applyDemoRestaurantProfile() {
  const profile = seedDemoRestaurantData();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function ensureDemoReferenceAccount() {
  const users = readLocalUsers();
  const exists = users.some((user) => user.email === DEMO_EMAIL || user.id === DEMO_USER_ID);
  if (!exists) {
    const demoUser: LocalAuthUser = {
      id: DEMO_USER_ID,
      name: "Ubhona Demo Owner",
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      role: "restaurant_owner",
      createdAt: new Date().toISOString(),
    };
    writeLocalUsers([...users, demoUser]);
  }
  seedDemoRestaurantData();
}

function toSessionUser(user: LocalAuthUser): AuthUser {
  const { id, name, email, role, createdAt } = user;
  return { id, name, email, role, createdAt };
}

function isApiUnavailable(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 503) return false;
  const code = (error.body as { code?: unknown } | null)?.code;
  return code === "API_NOT_CONFIGURED" || code === "API_UNREACHABLE";
}

function isAuthSessionInvalidatingError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) return true;
  if (error.status !== 404) return false;

  const bodyError =
    error.body && typeof error.body === "object" && "error" in error.body
      ? String((error.body as { error?: unknown }).error || "")
      : "";
  const message = `${error.message} ${bodyError}`.toLowerCase();
  return message.includes("user not found");
}

function createLocalSession(user: LocalAuthUser) {
  const previous = readSession();
  if (previous?.id && previous.id !== user.id) {
    clearRestaurantProfile();
  }
  localStorage.setItem(AUTH_TOKEN_KEY, `${LOCAL_TOKEN_PREFIX}${user.id}`);
  writeSession(toSessionUser(user));
  if (user.id === DEMO_USER_ID) {
    applyDemoRestaurantProfile();
  }
}

function createRemoteSession(user: AuthUser, token: string) {
  const previous = readSession();
  if (previous?.id && previous.id !== user.id) {
    clearRestaurantProfile();
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  writeSession(user);
}

function normalizeLoginInput(
  emailOrInput: string | { email: string; password: string },
  passwordArg?: string
) {
  if (typeof emailOrInput === "object") return emailOrInput;
  return {
    email: emailOrInput,
    password: passwordArg || "",
  };
}

type AuthSuccess = { ok: true; user: AuthUser };
type AuthFailure = { ok: false; error: string };

export async function signupUser(
  name: string,
  email: string,
  password: string
): Promise<AuthSuccess | AuthFailure>;
export async function signupUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthSuccess | AuthFailure>;
export async function signupUser(
  nameOrInput: string | { name: string; email: string; password: string },
  emailArg?: string,
  passwordArg?: string
) {
  const input = normalizeSignupInput(nameOrInput, emailArg, passwordArg);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  try {
    const response = await api.post<{ token: string; user: AuthUser }>("/auth/signup", {
      name,
      email,
      password,
    });
    createRemoteSession(response.user, response.token);
    return { ok: true, user: response.user };
  } catch (error) {
    if (!isApiUnavailable(error) || !allowOfflineDemoFallback) {
      return { ok: false, error: error instanceof Error ? error.message : "Signup failed." };
    }

    if (!name || !email || !password) {
      return { ok: false, error: "Name, email, and password are required." };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }

    const localUsers = readLocalUsers();
    if (localUsers.some((user) => user.email === email)) {
      return { ok: false, error: "An account with that email already exists." };
    }

    const localUser: LocalAuthUser = {
      id: `local_${Date.now().toString(36)}`,
      name,
      email,
      password,
      role: "restaurant_owner",
      createdAt: new Date().toISOString(),
    };
    writeLocalUsers([...localUsers, localUser]);
    createLocalSession(localUser);
    return { ok: true, user: toSessionUser(localUser) };
  }
}

function getLocalLoginUser(email: string, password: string) {
  const localUsers = readLocalUsers();
  return localUsers.find((user) => user.email === email && user.password === password) || null;
}

function hasLocalToken() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
  return token.startsWith(LOCAL_TOKEN_PREFIX);
}

function getAuthToken() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token && token.trim() ? token : null;
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthSuccess | AuthFailure>;
export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthSuccess | AuthFailure>;
export async function loginUser(
  emailOrInput: string | { email: string; password: string },
  passwordArg?: string
) {
  const input = normalizeLoginInput(emailOrInput, passwordArg);
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  try {
    const response = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    createRemoteSession(response.user, response.token);
    return { ok: true, user: response.user };
  } catch (error) {
    if (!isApiUnavailable(error) || !allowOfflineDemoFallback) {
      return { ok: false, error: error instanceof Error ? error.message : "Login failed." };
    }

    const localUser = getLocalLoginUser(email, password);
    if (!localUser) {
      return { ok: false, error: "Invalid email or password." };
    }
    createLocalSession(localUser);
    return { ok: true, user: toSessionUser(localUser) };
  }
}

export async function requestPasswordReset(email: string): Promise<{ ok: true; message: string; resetUrl?: string } | AuthFailure> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const response = await api.post<{ message: string; resetUrl?: string }>("/auth/forgot-password", {
      email: normalizedEmail,
    });
    return { ok: true, message: response.message, resetUrl: response.resetUrl };
  } catch (error) {
    if (!isApiUnavailable(error) || !allowOfflineDemoFallback) {
      return { ok: false, error: error instanceof Error ? error.message : "Password reset request failed." };
    }

    const localUser = readLocalUsers().find((user) => user.email === normalizedEmail) || null;
    if (!localUser) {
      return { ok: true, message: "If an account exists for that email, password reset instructions have been prepared." };
    }

    const token = `local-reset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const tokens = readLocalResetTokens();
    tokens[token] = {
      email: normalizedEmail,
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
    writeLocalResetTokens(tokens);

    return {
      ok: true,
      message: "If an account exists for that email, password reset instructions have been prepared.",
      resetUrl: buildPublicResetUrl(token),
    };
  }
}

export async function resetPasswordWithToken(
  token: string,
  password: string
): Promise<{ ok: true; message: string } | AuthFailure> {
  try {
    const response = await api.post<{ message: string }>("/auth/reset-password", {
      token,
      password,
    });
    return { ok: true, message: response.message };
  } catch (error) {
    if (!isApiUnavailable(error) || !allowOfflineDemoFallback) {
      return { ok: false, error: error instanceof Error ? error.message : "Password reset failed." };
    }

    const tokens = readLocalResetTokens();
    const record = tokens[token];
    if (!record || record.expiresAt < Date.now()) {
      if (record) {
        delete tokens[token];
        writeLocalResetTokens(tokens);
      }
      return { ok: false, error: "Invalid or expired password reset link." };
    }

    const users = readLocalUsers();
    const index = users.findIndex((user) => user.email === record.email);
    if (index < 0) {
      return { ok: false, error: "Invalid or expired password reset link." };
    }

    users[index] = {
      ...users[index],
      password,
    };
    writeLocalUsers(users);
    delete tokens[token];
    writeLocalResetTokens(tokens);
    return { ok: true, message: "Password updated successfully. You can now sign in." };
  }
}

export async function refreshCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;
  if (hasLocalToken()) {
    return readSession();
  }
  try {
    const user = await api.get<AuthUser>("/auth/me");
    writeSession(user);
    return user;
  } catch (error) {
    if (isAuthSessionInvalidatingError(error)) {
      logoutUser();
      return null;
    }
    return readSession();
  }
}

export function logoutUser() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  writeSession(null);
  clearRestaurantProfile();
}

export function getCurrentUser() {
  return readSession();
}

export function isAuthenticated() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return getCurrentUser() != null && Boolean(token);
}

export function hasRemoteAuthSession() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
  return getCurrentUser() != null && Boolean(token) && !token.startsWith(LOCAL_TOKEN_PREFIX);
}

export function isPlatformAdmin() {
  return getCurrentUser()?.role === "platform_admin";
}

// Backward-compatible aliases
export function signup(input: { name: string; email: string; password: string }) {
  return signupUser(input);
}

export function login(input: { email: string; password: string }) {
  return loginUser(input);
}

export function logout() {
  logoutUser();
}

export function currentUser() {
  return getCurrentUser();
}

export function getSessionState(): SessionState {
  const user = getCurrentUser();
  const restaurant = getRestaurantProfile();
  const token = getAuthToken();
  const authenticated = Boolean(user && token);
  return {
    user,
    restaurant,
    token,
    authenticated,
    onboardingCompleted: Boolean(authenticated && restaurant),
  };
}
