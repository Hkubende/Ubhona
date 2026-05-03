import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

dotenv.config({ path: path.resolve(scriptDir, "..", ".env") });
dotenv.config({ path: path.resolve(repoRoot, ".env") });

export const targetTables = [
  "categories",
  "dishes",
  "orders",
  "payments",
  "upload_assets",
  "analytics_events",
  "platform_tracker_documents",
];

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

export function resolveRlsDatabaseUrl(mode, envName = "") {
  if (mode !== "apply") {
    if (envName && envName !== "APP_RUNTIME_DATABASE_URL") {
      throw new Error(
        `Runtime-equivalent ${mode} checks must use APP_RUNTIME_DATABASE_URL. Refusing --database-url-env=${envName}.`
      );
    }

    const appRuntimeDatabaseUrl = readEnv("APP_RUNTIME_DATABASE_URL");
    if (!appRuntimeDatabaseUrl) {
      if (readEnv("DATABASE_URL")) {
        throw new Error(
          "APP_RUNTIME_DATABASE_URL is required for runtime-equivalent RLS validation. Refusing to fall back to DATABASE_URL."
        );
      }
      throw new Error(
        "APP_RUNTIME_DATABASE_URL is required for runtime-equivalent RLS validation. DATABASE_URL fallback is not accepted."
      );
    }

    return {
      envName: "APP_RUNTIME_DATABASE_URL",
      value: appRuntimeDatabaseUrl,
    };
  }

  const candidates = [envName, "RLS_APPLY_DATABASE_URL", "RLS_DATABASE_URL", "APP_RUNTIME_DATABASE_URL", "DATABASE_URL"].filter(
    Boolean
  );
  for (const candidateName of candidates) {
    const value = readEnv(candidateName);
    if (value) {
      return {
        envName: candidateName,
        value,
      };
    }
  }

  throw new Error(
    `No apply database URL found. Set ${envName || "RLS_APPLY_DATABASE_URL"} or RLS_DATABASE_URL or APP_RUNTIME_DATABASE_URL or DATABASE_URL.`
  );
}

export function summarizeDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    user: decodeURIComponent(parsed.username || ""),
    host: parsed.hostname,
    port: parsed.port || "(default)",
    database: parsed.pathname.replace(/^\//, "") || "(default)",
    ssl: parsed.searchParams.get("sslmode") || "unspecified",
  };
}

export async function createClient(connectionString) {
  const client = new Client({
    connectionString,
    ssl:
      /\bsslmode=require\b/i.test(connectionString) || /\.supabase\./i.test(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await client.connect();
  return client;
}

export async function collectRlsRoleEvidence(client, options) {
  const { mode, envName, connectionString } = options;
  const connectionIdentity = summarizeDatabaseUrl(connectionString);

  const { rows: roleRows } = await client.query(`
    SELECT
      current_user,
      session_user,
      r.rolname,
      r.rolsuper,
      r.rolbypassrls,
      r.rolcreaterole,
      r.rolinherit
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);

  const { rows: rlsRows } = await client.query(
    `
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname
    `,
    [targetTables]
  );

  const roleInfo = roleRows[0];
  if (!roleInfo) {
    throw new Error("Could not resolve current database role for RLS validation.");
  }

  const normalizedTargetTables = rlsRows.map((row) => ({
    table_name: row.table_name,
    owner: row.owner,
    rls_enabled: Boolean(row.rls_enabled),
    rls_forced: Boolean(row.rls_forced),
  }));

  const ownedTargetTables = normalizedTargetTables
    .filter((row) => row.owner === roleInfo.current_user)
    .map((row) => row.table_name);

  const usesRequiredRuntimeEnv = mode === "apply" ? envName === "APP_RUNTIME_DATABASE_URL" : envName === "APP_RUNTIME_DATABASE_URL";
  const appSafeForValidation =
    !roleInfo.rolsuper &&
    !roleInfo.rolbypassrls &&
    ownedTargetTables.every((tableName) =>
      normalizedTargetTables.find((row) => row.table_name === tableName)?.rls_forced
    );

  return {
    mode,
    envName,
    connectionIdentity,
    connection: connectionIdentity,
    current_user: roleInfo.current_user,
    session_user: roleInfo.session_user,
    rolsuper: Boolean(roleInfo.rolsuper),
    rolbypassrls: Boolean(roleInfo.rolbypassrls),
    ownedTargetTables,
    targetTables: normalizedTargetTables,
    usesRequiredRuntimeEnv,
    appSafeForValidation,
    role: {
      rolname: roleInfo.rolname,
      current_user: roleInfo.current_user,
      session_user: roleInfo.session_user,
      rolsuper: Boolean(roleInfo.rolsuper),
      rolbypassrls: Boolean(roleInfo.rolbypassrls),
      rolcreaterole: Boolean(roleInfo.rolcreaterole),
      rolinherit: Boolean(roleInfo.rolinherit),
    },
  };
}

export function assertRuntimeValidationEvidence(evidence, options = {}) {
  const { allowPrivilegedRole = false, contextLabel = "Runtime-equivalent validation" } = options;

  if (!evidence.usesRequiredRuntimeEnv) {
    throw new Error(`${contextLabel} must use APP_RUNTIME_DATABASE_URL.`);
  }

  if (!allowPrivilegedRole && evidence.rolsuper) {
    throw new Error(`${contextLabel} role is privileged: rolsuper=true.`);
  }

  if (!allowPrivilegedRole && evidence.rolbypassrls) {
    throw new Error(`${contextLabel} role is privileged: rolbypassrls=true.`);
  }

  if (!allowPrivilegedRole && !evidence.appSafeForValidation) {
    throw new Error(
      `${contextLabel} role is not app-safe for RLS behavior. APP_RUNTIME_DATABASE_URL must resolve to a role with rolsuper=false, rolbypassrls=false, and FORCE RLS on any tenant tables it owns.`
    );
  }
}
