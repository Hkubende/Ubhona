function parseBoolean(value: string | undefined, fallback = false) {
  if (value == null || value === "") return fallback;
  return value.toLowerCase() === "true";
}

const isDev = import.meta.env.DEV;

export const appConfig = {
  basePath: import.meta.env.VITE_BASE_PATH || "/",
  appName: import.meta.env.VITE_APP_NAME || "Ubhona",
  slogan: import.meta.env.VITE_APP_SLOGAN || "Visualize",
  apiUrl: import.meta.env.VITE_API_BASE || (isDev ? "http://localhost:4000" : ""),
  enableAnalytics: parseBoolean(import.meta.env.VITE_ENABLE_ANALYTICS, false),
  enableOrders: parseBoolean(import.meta.env.VITE_ENABLE_ORDERS, false),
} as const;

export const isApiConfigured = Boolean(appConfig.apiUrl.trim());
export const isDemoMode = !isApiConfigured;
