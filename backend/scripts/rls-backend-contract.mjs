import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertRuntimeValidationEvidence,
  collectRlsRoleEvidence,
  createClient,
  resolveRlsDatabaseUrl,
} from "./rls-connection-contract.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const { envName, value: appRuntimeDatabaseUrl } = resolveRlsDatabaseUrl("validate");
process.env.DATABASE_URL = appRuntimeDatabaseUrl;

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ADMIN_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PUBLIC_USER_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_SENTINEL_RESTAURANT_ID = "00000000-0000-0000-0000-000000000000";

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch. Expected ${expected}, got ${actual}`);
  }
}

async function loadBuiltBackendModule(relativePath) {
  const absolutePath = path.resolve(scriptDir, "..", "dist", relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing built backend artifact ${absolutePath}. Run npm --prefix backend run build first.`);
  }
  return import(pathToFileURL(absolutePath).href);
}

async function assertRuntimeRoleIsAppSafe(connectionString) {
  const client = await createClient(connectionString);
  try {
    const evidence = await collectRlsRoleEvidence(client, {
      mode: "validate",
      envName,
      connectionString,
    });
    console.log("Backend RLS role audit evidence:", JSON.stringify(evidence, null, 2));
    assertRuntimeValidationEvidence(evidence, {
      contextLabel: "Backend RLS contract validation",
    });
  } finally {
    await client.end();
  }
}

async function main() {
  await assertRuntimeRoleIsAppSafe(appRuntimeDatabaseUrl);
  const { prisma } = await loadBuiltBackendModule("prisma.js");
  const { runWithDbRlsContext, runWithPublicStorefrontDbContext } = await loadBuiltBackendModule("db-rls.js");

  try {
    const tenantSession = await runWithDbRlsContext(
      {
        userId: USER_ID,
        restaurantId: TENANT_ID,
        isAdmin: false,
      },
      () =>
        prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT
              current_setting('app.restaurant_id', true) AS restaurant_id,
              current_setting('app.user_id', true) AS user_id,
              current_setting('app.is_admin', true) AS is_admin
          `;
          return rows[0];
        })
    );

    assertEqual(tenantSession.restaurant_id, TENANT_ID, "tenant app.restaurant_id");
    assertEqual(tenantSession.user_id, USER_ID, "tenant app.user_id");
    assertEqual(tenantSession.is_admin, "false", "tenant app.is_admin");

    const adminSession = await runWithDbRlsContext(
      {
        userId: ADMIN_USER_ID,
        isAdmin: true,
      },
      () =>
        prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw`
            SELECT
              current_setting('app.restaurant_id', true) AS restaurant_id,
              current_setting('app.user_id', true) AS user_id,
              current_setting('app.is_admin', true) AS is_admin
          `;
          return rows[0];
        })
    );

    assertEqual(adminSession.restaurant_id, ADMIN_SENTINEL_RESTAURANT_ID, "admin app.restaurant_id");
    assertEqual(adminSession.user_id, ADMIN_USER_ID, "admin app.user_id");
    assertEqual(adminSession.is_admin, "true", "admin app.is_admin");

    const storefrontSession = await runWithPublicStorefrontDbContext(TENANT_ID, () =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT
            current_setting('app.restaurant_id', true) AS restaurant_id,
            current_setting('app.user_id', true) AS user_id,
            current_setting('app.is_admin', true) AS is_admin
        `;
        return rows[0];
      })
    );

    assertEqual(storefrontSession.restaurant_id, TENANT_ID, "public app.restaurant_id");
    assertEqual(storefrontSession.user_id, PUBLIC_USER_ID, "public app.user_id");
    assertEqual(storefrontSession.is_admin, "false", "public app.is_admin");

    let failClosed = false;
    try {
      await runWithDbRlsContext(
        {
          userId: USER_ID,
          isAdmin: false,
        },
        () => prisma.$transaction(async (tx) => tx.$queryRaw`SELECT 1`)
      );
    } catch (error) {
      failClosed =
        error instanceof Error &&
        error.message.includes("Missing app.restaurant_id context before RLS-protected query.");
    }

    if (!failClosed) {
      throw new Error("Non-admin backend session contract did not fail closed for missing app.restaurant_id.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenantSession,
          adminSession,
          storefrontSession,
          failClosed,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`[rls-backend-contract] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
