import { appConfig, isApiConfigured } from "./config";

const API_BASE = appConfig.apiUrl.replace(/\/+$/, "");
const API_NOT_CONFIGURED_MESSAGE = "API is not configured. Running in static/demo mode.";
const API_UNREACHABLE_MESSAGE = "API is unreachable. Running in static/demo mode.";
const API_RECHECK_MS = 30_000;
const SHOULD_LOG_INFO = import.meta.env.DEV;
let hasWarnedApiNotConfigured = false;
let hasWarnedApiUnreachable = false;
let reachabilityState: "unknown" | "reachable" | "unreachable" = "unknown";
let reachabilityCheckedAt = 0;
let reachabilityCheck: Promise<boolean> | null = null;
export const AUTH_TOKEN_KEY = "mv_auth_token_v1";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  if (!("error" in body)) return null;
  const value = (body as { error?: unknown }).error;
  return value == null ? null : String(value);
}

function buildHeaders(init?: HeadersInit, includeJson = true) {
  const headers = new Headers(init || {});
  if (includeJson && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function markApiUnreachable() {
  reachabilityState = "unreachable";
  reachabilityCheckedAt = Date.now();
  if (!hasWarnedApiUnreachable && SHOULD_LOG_INFO) {
    hasWarnedApiUnreachable = true;
    console.info(API_UNREACHABLE_MESSAGE);
  }
}

async function canReachApi(): Promise<boolean> {
  if (!isApiConfigured || !API_BASE) return false;
  if (reachabilityState === "reachable") return true;
  if (reachabilityState === "unreachable" && Date.now() - reachabilityCheckedAt < API_RECHECK_MS) {
    return false;
  }
  if (reachabilityCheck) return reachabilityCheck;

  reachabilityCheck = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok || response.status === 401 || response.status === 403) {
        reachabilityState = "reachable";
        reachabilityCheckedAt = Date.now();
        return true;
      }
      markApiUnreachable();
      return false;
    } catch {
      markApiUnreachable();
      return false;
    } finally {
      clearTimeout(timeout);
      reachabilityCheck = null;
    }
  })();

  return reachabilityCheck;
}

export async function isApiReachable(): Promise<boolean> {
  return canReachApi();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiConfigured || !API_BASE) {
    if (!hasWarnedApiNotConfigured && SHOULD_LOG_INFO) {
      hasWarnedApiNotConfigured = true;
      console.info(API_NOT_CONFIGURED_MESSAGE);
    }
    throw new ApiError(API_NOT_CONFIGURED_MESSAGE, 503, { code: "API_NOT_CONFIGURED" });
  }

  if (!(await canReachApi())) {
    throw new ApiError(API_UNREACHABLE_MESSAGE, 503, { code: "API_UNREACHABLE" });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: buildHeaders(init.headers, init.body != null),
    });
    reachabilityState = "reachable";
    reachabilityCheckedAt = Date.now();
  } catch {
    markApiUnreachable();
    throw new ApiError(API_UNREACHABLE_MESSAGE, 503, { code: "API_UNREACHABLE" });
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = extractErrorMessage(body) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data == null ? undefined : JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data == null ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data == null ? undefined : JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
