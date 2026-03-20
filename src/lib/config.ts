function parseBoolean(value: string | undefined, fallback = false) {
  if (value == null || value === "") return fallback;
  return value.toLowerCase() === "true";
}

function normalizeUrl(value: string | undefined) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export const appConfig = {
  basePath: import.meta.env.VITE_BASE_PATH || "/",
  appName: import.meta.env.VITE_APP_NAME || "Ubhona",
  slogan: import.meta.env.VITE_APP_SLOGAN || "Visualize",
  apiUrl: normalizeUrl(import.meta.env.VITE_API_BASE),
  stkApiUrl: normalizeUrl(import.meta.env.VITE_STK_API_BASE),
  enableAnalytics: parseBoolean(import.meta.env.VITE_ENABLE_ANALYTICS, false),
  enableOrders: parseBoolean(import.meta.env.VITE_ENABLE_ORDERS, false),
} as const;

export const isApiConfigured = Boolean(appConfig.apiUrl.trim());
export const isStkApiConfigured = Boolean(appConfig.stkApiUrl.trim());
export const isDemoMode = !isApiConfigured;
