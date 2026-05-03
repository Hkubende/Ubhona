import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client as PgClient } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_PACKAGE_JSON_PATH = resolve(__dirname, "../../package.json");
const DEFAULT_DB_HEALTH_TIMEOUT_MS = 6_000;
const HEALTH_SHAPE_VERSION = 2;

type EnvSource = Record<string, string | undefined>;

type PackageMeta = {
  name: string;
  version: string;
};

let packageMetaCache: PackageMeta | null = null;

export type BackendBuildIdentity = {
  packageName: string;
  packageVersion: string;
  commitSha: string | null;
  branch: string | null;
  deployServiceName: string | null;
  deployServiceId: string | null;
  externalUrl: string | null;
  externalHostname: string | null;
  startedAt: string;
  healthShapeVersion: number;
};

export type DbConfigSummary = {
  host: string;
  port: number | null;
  database: string;
  pooler: boolean;
  mode: "direct" | "session_pooler" | "transaction_pooler" | "unknown";
  username: string;
  hasProjectRefInUsername: boolean;
  valid: boolean;
};

export type DbHealthResult = {
  reachable: boolean;
  reason: "ok" | "dns" | "timeout" | "auth" | "malformed" | "network" | "unknown";
  message?: string;
  hint?: string;
};

type PgClientLike = {
  connect: () => Promise<unknown>;
  query: (sql: string) => Promise<unknown>;
  end: () => Promise<unknown>;
};

function readEnv(env: EnvSource, name: string) {
  return String(env[name] || "").trim();
}

function readPackageMeta(): PackageMeta {
  if (packageMetaCache) return packageMetaCache;
  try {
    const raw = readFileSync(BACKEND_PACKAGE_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    packageMetaCache = {
      name: String(parsed.name || "backend"),
      version: String(parsed.version || "0.0.0"),
    };
  } catch {
    packageMetaCache = {
      name: "backend",
      version: "0.0.0",
    };
  }
  return packageMetaCache;
}

export function getBackendBuildIdentity(input?: {
  env?: EnvSource;
  startedAt?: string;
}): BackendBuildIdentity {
  const env = input?.env || process.env;
  const packageMeta = readPackageMeta();
  return {
    packageName: packageMeta.name,
    packageVersion: packageMeta.version,
    commitSha:
      readEnv(env, "RENDER_GIT_COMMIT") ||
      readEnv(env, "VERCEL_GIT_COMMIT_SHA") ||
      readEnv(env, "GIT_COMMIT_SHA") ||
      null,
    branch:
      readEnv(env, "RENDER_GIT_BRANCH") ||
      readEnv(env, "VERCEL_GIT_COMMIT_REF") ||
      readEnv(env, "GIT_BRANCH") ||
      null,
    deployServiceName: readEnv(env, "RENDER_SERVICE_NAME") || null,
    deployServiceId: readEnv(env, "RENDER_SERVICE_ID") || null,
    externalUrl:
      readEnv(env, "RENDER_EXTERNAL_URL") ||
      readEnv(env, "APP_BASE_URL") ||
      null,
    externalHostname: readEnv(env, "RENDER_EXTERNAL_HOSTNAME") || null,
    startedAt: input?.startedAt || new Date().toISOString(),
    healthShapeVersion: HEALTH_SHAPE_VERSION,
  };
}

export function summarizeDbConfig(env: EnvSource = process.env): DbConfigSummary {
  const raw = readEnv(env, "DATABASE_URL");
  if (!raw) {
    return {
      host: "missing",
      port: null,
      database: "unknown",
      pooler: false,
      mode: "unknown",
      username: "missing",
      hasProjectRefInUsername: false,
      valid: false,
    };
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname || "unknown";
    const port = parsed.port ? Number(parsed.port) : null;
    const username = decodeURIComponent(parsed.username || "");
    const pooler = /pooler\.supabase\.com$/i.test(host);
    const mode =
      pooler && port === 6543
        ? "transaction_pooler"
        : pooler && port === 5432
          ? "session_pooler"
          : /^db\..+\.supabase\.co$/i.test(host)
            ? "direct"
            : "unknown";

    return {
      host,
      port,
      database: parsed.pathname?.replace(/^\//, "") || "unknown",
      pooler,
      mode,
      username: username ? username.replace(/(^.).+(\..+$|$)/, "$1***$2") : "missing",
      hasProjectRefInUsername: /\./.test(username),
      valid: /^postgres(ql)?:$/i.test(parsed.protocol),
    };
  } catch {
    return {
      host: "invalid",
      port: null,
      database: "unknown",
      pooler: false,
      mode: "unknown",
      username: "invalid",
      hasProjectRefInUsername: false,
      valid: false,
    };
  }
}

export function classifyDbError(error: unknown): DbHealthResult["reason"] {
  const message =
    error instanceof Error ? error.message.toLowerCase() : typeof error === "string" ? error.toLowerCase() : "";
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code || "") : "";

  if (
    message.includes("invalid connection string") ||
    message.includes("error parsing") ||
    message.includes("invalid port number") ||
    code === "ERR_INVALID_URL"
  ) {
    return "malformed";
  }
  if (
    message.includes("can't reach database server") ||
    message.includes("could not translate host name") ||
    message.includes("getaddrinfo") ||
    message.includes("enotfound") ||
    code === "ENOTFOUND"
  ) {
    return "dns";
  }
  if (message.includes("timed out") || message.includes("timeout") || code === "ETIMEDOUT") {
    return "timeout";
  }
  if (
    message.includes("authentication failed") ||
    message.includes("password authentication failed") ||
    message.includes("tenant or user not found") ||
    (message.includes("role") && message.includes("does not exist")) ||
    message.includes("p1000") ||
    code === "28P01"
  ) {
    return "auth";
  }
  if (
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("server closed the connection unexpectedly") ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET"
  ) {
    return "network";
  }
  return "unknown";
}

export function safeDbErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 220);
  if (typeof error === "string") return error.slice(0, 220);
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error).slice(0, 220);
    } catch {
      return String(error).slice(0, 220);
    }
  }
  return String(error).slice(0, 220);
}

export function buildDbHint(
  summary: DbConfigSummary,
  reason: DbHealthResult["reason"],
  message?: string
) {
  if (reason === "malformed") {
    return "DATABASE_URL is malformed. Use a full postgres:// or postgresql:// connection string.";
  }
  if (reason === "dns") {
    return "Database host did not resolve. Verify the hostname and whether your environment supports the chosen direct or pooler endpoint.";
  }
  if (reason === "timeout") {
    return "Database connection timed out. Check network egress, firewall rules, and whether the chosen endpoint is reachable from this machine.";
  }
  if (reason === "network") {
    return "Database connection was refused or reset. Verify host, port, and whether Postgres is accepting external connections.";
  }
  if (reason === "auth") {
    if (summary.mode === "transaction_pooler") {
      return "Supabase transaction pooler rejected the tenant/user. Verify the project-ref-qualified username and password, or switch to the dashboard-provided session pooler/direct URL.";
    }
    if (summary.mode === "session_pooler") {
      return "Supabase session pooler rejected the tenant/user. Re-copy the exact session pooler string from Supabase Connect.";
    }
    if (summary.mode === "direct") {
      return "Direct database auth failed. Verify the direct Postgres password from the Supabase dashboard.";
    }
    if (message?.toLowerCase().includes("tenant or user not found")) {
      return "The supplied DATABASE_URL points at Supavisor, but the encoded tenant/user does not match a valid project user.";
    }
    return "Database credentials were rejected. Verify username, password, and endpoint mode.";
  }
  return "Database reachability failed for an unclassified reason. Recheck the exact connection string from the provider dashboard.";
}

export async function checkDbReachable(input?: {
  env?: EnvSource;
  timeoutMs?: number;
  clientFactory?: (config: ConstructorParameters<typeof PgClient>[0]) => PgClientLike;
}): Promise<DbHealthResult> {
  const env = input?.env || process.env;
  const timeoutMs = input?.timeoutMs ?? DEFAULT_DB_HEALTH_TIMEOUT_MS;
  const dbConfig = summarizeDbConfig(env);
  const connectionString = readEnv(env, "DATABASE_URL");
  let client: PgClientLike | null = null;

  try {
    client = input?.clientFactory
      ? input.clientFactory({
          connectionString,
          connectionTimeoutMillis: timeoutMs,
          query_timeout: timeoutMs,
          statement_timeout: timeoutMs,
          ssl: {
            rejectUnauthorized: false,
          },
        })
      : new PgClient({
          connectionString,
          connectionTimeoutMillis: timeoutMs,
          query_timeout: timeoutMs,
          statement_timeout: timeoutMs,
          ssl: {
            rejectUnauthorized: false,
          },
        });

    await client.connect();
    await client.query("SELECT 1");
    return { reachable: true, reason: "ok", hint: "Database query succeeded." };
  } catch (error) {
    const reason = classifyDbError(error);
    const message = safeDbErrorMessage(error);
    return {
      reachable: false,
      reason,
      message,
      hint: buildDbHint(dbConfig, reason, message),
    };
  } finally {
    await client?.end().catch(() => {});
  }
}
