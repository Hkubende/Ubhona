function parseBoolean(value: string | undefined, fallback = false) {
  if (value == null || value === "") return fallback;
  return value.toLowerCase() === "true";
}

export const appConfig = {
  basePath: import.meta.env.VITE_BASE_PATH || "/",
  appName: import.meta.env.VITE_APP_NAME || "Ubhona",
  slogan: import.meta.env.VITE_APP_SLOGAN || "Visualize",
  apiUrl: import.meta.env.VITE_API_URL || "https://ubhona-api.onrender.com",
  enableAnalytics: parseBoolean(import.meta.env.VITE_ENABLE_ANALYTICS, false),
  enableOrders: parseBoolean(import.meta.env.VITE_ENABLE_ORDERS, false),
} as const;

