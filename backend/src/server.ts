import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { applyRuntimeDatabaseUrlContract } from "./env/runtime-db-url.js";
import {
  checkDbReachable,
  getBackendBuildIdentity,
  summarizeDbConfig,
} from "./runtime/health.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env"), override: true });
const runtimeDbContract = applyRuntimeDatabaseUrlContract();
const SERVER_STARTED_AT = new Date().toISOString();

const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = String(process.env.NODE_ENV || "development").trim().toLowerCase() || "development";

function readAllowedCorsOrigins() {
  return String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function maskedSupabaseHost() {
  const raw = String(process.env.SUPABASE_URL || "").trim();
  if (!raw) return "missing";
  try {
    return new URL(raw).host;
  } catch {
    return "invalid";
  }
}

function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function isPlaceholder(name: string, value: string) {
  const lowered = value.toLowerCase();
  const generic = ["changeme", "change-this", "replace", "example", "your-", "<", ">"];
  if (generic.some((marker) => lowered.includes(marker))) return true;

  if (name === "DATABASE_URL" && lowered.includes("postgresql://user:pass@")) return true;
  if (name === "SUPABASE_URL" && lowered.includes("your-project.supabase.co")) return true;
  if (name === "SUPABASE_SERVICE_ROLE_KEY" && lowered.includes("service-role-key")) return true;
  if (name === "JWT_SECRET" && (lowered === "dev-secret" || lowered === "change-this-secret")) return true;

  return false;
}

function isSupabaseConfigValid() {
  const url = readEnv("SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return false;
  if (isPlaceholder("SUPABASE_URL", url) || isPlaceholder("SUPABASE_SERVICE_ROLE_KEY", key)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateStartupEnv() {
  const required = [
    "JWT_SECRET",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET_THUMBNAILS",
    "SUPABASE_STORAGE_BUCKET_MODELS",
  ] as const;

  const missing = required.filter((key) => readEnv(key).length === 0);
  if (missing.length) {
    throw new Error(`Missing required backend env vars: ${missing.join(", ")}`);
  }

  const placeholders = required.filter((key) => isPlaceholder(key, readEnv(key)));
  if (placeholders.length) {
    throw new Error(`Placeholder backend env vars must be replaced: ${placeholders.join(", ")}`);
  }

  const jwtSecret = readEnv("JWT_SECRET");
  if (jwtSecret.length < 32 || jwtSecret === "dev-secret") {
    throw new Error("Missing or weak JWT_SECRET. Set a strong secret (>=32 chars) before starting backend.");
  }

  const dbUrl = readEnv("DATABASE_URL");
  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
    throw new Error("DATABASE_URL must be a valid postgres connection string.");
  }

  if (NODE_ENV === "production" && !readEnv("APP_RUNTIME_DATABASE_URL")) {
    throw new Error(
      "APP_RUNTIME_DATABASE_URL must be set in production so the backend uses the non-privileged runtime-equivalent DB role."
    );
  }

  if (NODE_ENV === "production") {
    const paymentRequired = [
      "MPESA_CONSUMER_KEY",
      "MPESA_CONSUMER_SECRET",
      "MPESA_SHORTCODE",
      "MPESA_PASSKEY",
      "MPESA_CALLBACK_URL",
      "MPESA_CALLBACK_SECRET",
    ] as const;

    const paymentMissing = paymentRequired.filter((key) => readEnv(key).length === 0);
    if (paymentMissing.length) {
      throw new Error(`Missing required payment env vars for production: ${paymentMissing.join(", ")}`);
    }

    const paymentPlaceholders = paymentRequired.filter((key) => isPlaceholder(key, readEnv(key)));
    if (paymentPlaceholders.length) {
      throw new Error(`Placeholder payment env vars must be replaced for production: ${paymentPlaceholders.join(", ")}`);
    }
  }
}

async function bootstrap() {
  validateStartupEnv();

  const [
    { authRouter },
    { restaurantRouter },
    { categoriesRouter },
    { dishesRouter },
    { ordersRouter },
    { paymentsRouter },
    { uploadsRouter },
    { analyticsRouter },
    { adminRouter },
    { billingRouter },
    { inventoryRouter },
    { floorRouter },
    { notificationsRouter },
    { getMpesaRuntimeStatus },
  ] = await Promise.all([
    import("./routes/auth.js"),
    import("./routes/restaurants.js"),
    import("./routes/categories.js"),
    import("./routes/dishes.js"),
    import("./routes/orders.js"),
    import("./routes/payments.js"),
    import("./routes/uploads.js"),
    import("./routes/analytics.js"),
    import("./routes/admin.js"),
    import("./routes/billing.js"),
    import("./routes/inventory.js"),
    import("./routes/floor.js"),
    import("./routes/notifications.js"),
    import("./services/payment.service.js"),
  ]);

  const app = express();
  const allowedCorsOrigins = readAllowedCorsOrigins();

  // Some temporary tunnel providers do not forward the Origin header to the backend.
  // Emit the configured public origin explicitly so browser requests can still pass CORS.
  app.use((req, res, next) => {
    if (!allowedCorsOrigins.length) {
      next();
      return;
    }

    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
    const allowedOrigin =
      requestOrigin && allowedCorsOrigins.includes(requestOrigin)
        ? requestOrigin
        : allowedCorsOrigins.length === 1
          ? allowedCorsOrigins[0]
          : "";

    if (allowedOrigin) {
      res.header("Access-Control-Allow-Origin", allowedOrigin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      const requestHeaders = typeof req.headers["access-control-request-headers"] === "string"
        ? req.headers["access-control-request-headers"]
        : "Content-Type, Authorization";
      res.header("Access-Control-Allow-Headers", requestHeaders);
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(
    cors({
      origin: allowedCorsOrigins.length ? allowedCorsOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(
    createRateLimiter({
      keyPrefix: "global",
      windowMs: 60 * 1000,
      max: 240,
      message: "Rate limit exceeded. Please slow down.",
    })
  );

  app.get("/health", (_req, res) => {
    const thumbnailsBucket = readEnv("SUPABASE_STORAGE_BUCKET_THUMBNAILS");
    const modelsBucket = readEnv("SUPABASE_STORAGE_BUCKET_MODELS");
    const supabaseConfigured = isSupabaseConfigValid();
    const payments = getMpesaRuntimeStatus();
    const dbConfig = summarizeDbConfig();
    const build = getBackendBuildIdentity({ startedAt: SERVER_STARTED_AT });
    res.json({
      ok: true,
      service: "menuvista-backend",
      build,
      runtime: {
        backendUp: true,
        env: NODE_ENV,
        port: PORT,
      },
      checks: {
        dbReachable: null,
        supabaseConfigured,
        db: {
          envSource: runtimeDbContract.source,
          reason: "unchecked",
          message: "DB probe moved to /health/db so base health stays fast.",
          hint: "Call /health/db for database reachability diagnostics.",
          host: dbConfig.host,
          port: dbConfig.port,
          pooler: dbConfig.pooler,
          mode: dbConfig.mode,
          username: dbConfig.username,
          hasProjectRefInUsername: dbConfig.hasProjectRefInUsername,
        },
      },
      uploads: {
        buckets: {
          thumbnails: thumbnailsBucket,
          models: modelsBucket,
        },
      },
      payments,
    });
  });

  app.get("/health/db", async (_req, res) => {
    try {
      const dbHealth = await checkDbReachable();
      const dbConfig = summarizeDbConfig();
      const build = getBackendBuildIdentity({ startedAt: SERVER_STARTED_AT });
      res.status(dbHealth.reachable ? 200 : 500).json({
        ok: dbHealth.reachable,
        service: "menuvista-backend",
        build,
        runtime: {
          backendUp: true,
          env: NODE_ENV,
          port: PORT,
        },
        checks: {
          dbReachable: dbHealth.reachable,
          db: {
            envSource: runtimeDbContract.source,
            reason: dbHealth.reason,
            message: dbHealth.message,
            hint: dbHealth.hint,
            host: dbConfig.host,
            port: dbConfig.port,
            pooler: dbConfig.pooler,
            mode: dbConfig.mode,
            username: dbConfig.username,
            hasProjectRefInUsername: dbConfig.hasProjectRefInUsername,
          },
        },
      });
    } catch (error) {
      const build = getBackendBuildIdentity({ startedAt: SERVER_STARTED_AT });
      res.status(500).json({
        ok: false,
        service: "menuvista-backend",
        build,
        runtime: {
          backendUp: true,
          env: NODE_ENV,
          port: PORT,
        },
        checks: {
          dbReachable: false,
          db: {
            envSource: runtimeDbContract.source,
            reason: "unknown",
            message: error instanceof Error ? error.message : "Unexpected DB health failure.",
            hint: "The DB health probe threw before returning a structured result. Inspect runtime logs and active deploy source.",
          },
        },
      });
    }
  });

  app.use("/auth", authRouter);
  app.use("/restaurants", restaurantRouter);
  app.use("/categories", categoriesRouter);
  app.use("/dishes", dishesRouter);
  app.use("/orders", ordersRouter);
  app.use("/payments", paymentsRouter);
  app.use("/uploads", uploadsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/analytics", analyticsRouter);
  app.use("/admin", adminRouter);
  app.use("/billing", billingRouter);
  app.use("/inventory", inventoryRouter);
  app.use("/floor", floorRouter);
  app.use("/notifications", notificationsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "LIMIT_FILE_SIZE"
    ) {
      res.status(400).json({ error: "File too large for this upload endpoint." });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(PORT, () => {
    const dbConfig = summarizeDbConfig();
    console.log(`[startup] API running on ${PORT}`);
    console.log(`[startup] env=${NODE_ENV} supabaseHost=${maskedSupabaseHost()}`);
    console.log(
      `[startup] db envSource=${runtimeDbContract.source} host=${dbConfig.host} port=${dbConfig.port ?? "default"} db=${dbConfig.database} pooler=${dbConfig.pooler} mode=${dbConfig.mode} user=${dbConfig.username} valid=${dbConfig.valid}`
    );
    console.log("[startup] routes loaded: /health, /api/uploads/thumbnail, /api/uploads/model");
  });
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[startup] failed: ${message}`);
  process.exit(1);
});
