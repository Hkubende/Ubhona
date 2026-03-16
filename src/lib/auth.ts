import { api, AUTH_TOKEN_KEY } from "./api";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "platform_admin" | "restaurant_owner" | "restaurant_manager" | "staff";
  createdAt: string;
};

const SESSION_KEY = "mv_auth_user_v1";

function normalizeRole(value: unknown): AuthUser["role"] {
  const role = String(value || "").trim();
  if (
    role === "platform_admin" ||
    role === "restaurant_owner" ||
    role === "restaurant_manager" ||
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
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }
    return {
      ...parsed,
      role: normalizeRole((parsed as any).role),
    } as AuthUser;
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
  try {
    const response = await api.post<{ token: string; user: AuthUser }>("/auth/signup", input);
    localStorage.setItem(AUTH_TOKEN_KEY, response.token);
    writeSession(response.user);
    return { ok: true, user: response.user };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Signup failed." };
  }
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
  try {
    const response = await api.post<{ token: string; user: AuthUser }>("/auth/login", input);
    localStorage.setItem(AUTH_TOKEN_KEY, response.token);
    writeSession(response.user);
    return { ok: true, user: response.user };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Login failed." };
  }
}

export async function refreshCurrentUser() {
  try {
    const user = await api.get<AuthUser>("/auth/me");
    writeSession(user);
    return user;
  } catch {
    return readSession();
  }
}

export function logoutUser() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  writeSession(null);
}

export function getCurrentUser() {
  return readSession();
}

export function isAuthenticated() {
  return getCurrentUser() != null && !!localStorage.getItem(AUTH_TOKEN_KEY);
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
