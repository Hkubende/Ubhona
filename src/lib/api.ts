import { appConfig, isApiConfigured } from "./config";

const API_BASE = appConfig.apiUrl.replace(/\/+$/, "");
const API_NOT_CONFIGURED_MESSAGE = "API is not configured. Running in static/demo mode.";
let hasWarnedApiNotConfigured = false;
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiConfigured || !API_BASE) {
    if (!hasWarnedApiNotConfigured) {
      hasWarnedApiNotConfigured = true;
      console.info(API_NOT_CONFIGURED_MESSAGE);
    }
    throw new ApiError(API_NOT_CONFIGURED_MESSAGE, 503, { code: "API_NOT_CONFIGURED" });
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(init.headers, init.body != null),
  });

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
