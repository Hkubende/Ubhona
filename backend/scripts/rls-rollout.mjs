import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertRuntimeValidationEvidence,
  collectRlsRoleEvidence,
  createClient,
  resolveRlsDatabaseUrl,
  summarizeDatabaseUrl,
  targetTables,
} from "./rls-connection-contract.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function printUsage() {
  console.log(`Ubhona RLS rollout runner

Usage:
  node backend/scripts/rls-rollout.mjs preflight [--database-url-env=VAR]
  node backend/scripts/rls-rollout.mjs apply [--file=backend/src/prisma/rls_rollout_consolidated.sql] [--database-url-env=VAR]
  node backend/scripts/rls-rollout.mjs validate [--file=backend/src/prisma/rls_rollout_validate.sql] [--database-url-env=VAR]

Database URL resolution:
  preflight/validate:
    1. APP_RUNTIME_DATABASE_URL
  apply:
    1. env var passed by --database-url-env
    2. RLS_APPLY_DATABASE_URL
    3. RLS_DATABASE_URL
    4. APP_RUNTIME_DATABASE_URL
    5. DATABASE_URL

Notes:
  - preflight/validate must use the same non-privileged DB role as the application runtime.
  - apply may use a separate migration/apply role.
  - preflight/validate fail if the connected role is SUPERUSER or BYPASSRLS unless you explicitly override it.
  - apply prints role-audit evidence so operators can confirm the stronger apply identity before SQL runs.
  - For pooled environments, this runner opens a fresh session and executes the SQL file as-is.
`);
}

function parseArgs(argv) {
  const [action = "help", ...flags] = argv;
  const options = {
    file: "",
    databaseUrlEnv: "",
    allowPrivilegedRole: false,
  };
  for (const flag of flags) {
    if (flag.startsWith("--file=")) options.file = flag.slice("--file=".length);
    if (flag.startsWith("--database-url-env=")) {
      options.databaseUrlEnv = flag.slice("--database-url-env=".length);
    }
    if (flag === "--allow-privileged-role") {
      options.allowPrivilegedRole = true;
    }
  }
  return { action, options };
}

function defaultFileFor(action) {
  if (action === "apply") return "backend/src/prisma/rls_rollout_consolidated.sql";
  if (action === "validate") return "backend/src/prisma/rls_rollout_validate.sql";
  return "";
}

async function runSqlFile(client, filePath) {
  const absolutePath = path.resolve(repoRoot, filePath);
  const sql = await fs.readFile(absolutePath, "utf8");
  await client.query(sql);
  return absolutePath;
}

async function runPreflight(client) {
  const [{ rows: dbInfo }, { rows: tableInfo }] = await Promise.all([
    client.query(`
      SELECT
        current_user AS current_user,
        session_user AS session_user,
        current_database() AS database_name,
        current_setting('server_version') AS server_version
    `),
    client.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `,
      [targetTables]
    ),
  ]);

  console.log("Preflight database info:", JSON.stringify(dbInfo[0], null, 2));
  console.log("Tenant tables present:", tableInfo.map((row) => row.table_name).join(", "));
}

async function main() {
  const { action, options } = parseArgs(process.argv.slice(2));
  if (action === "help" || action === "--help" || action === "-h") {
    printUsage();
    return;
  }

  if (!["preflight", "apply", "validate"].includes(action)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const auditMode = action === "apply" ? "apply" : "validate";
  const { envName, value: connectionString } = resolveRlsDatabaseUrl(auditMode, options.databaseUrlEnv);
  const summary = summarizeDatabaseUrl(connectionString);
  console.log(
    `Using ${envName} -> ${summary.user}@${summary.host}:${summary.port}/${summary.database} (ssl=${summary.ssl})`
  );

  const client = await createClient(connectionString);
  try {
    const audit = await collectRlsRoleEvidence(client, {
      mode: auditMode,
      envName,
      connectionString,
    });
    console.log("RLS role audit evidence:", JSON.stringify(audit, null, 2));

    if (action !== "apply") {
      assertRuntimeValidationEvidence(audit, {
        allowPrivilegedRole: options.allowPrivilegedRole,
        contextLabel: `Runtime-equivalent ${action}`,
      });
    }

    if (action === "preflight") {
      await runPreflight(client);
      console.log("RLS preflight completed.");
      return;
    }

    if (action === "validate") {
      await runPreflight(client);
    }

    const file = options.file || defaultFileFor(action);
    const absolutePath = await runSqlFile(client, file);
    console.log(`${action === "apply" ? "Applied" : "Validated"} SQL file: ${absolutePath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[rls-rollout] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
