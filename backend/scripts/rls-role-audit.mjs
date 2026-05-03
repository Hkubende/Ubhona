import process from "node:process";
import {
  assertRuntimeValidationEvidence,
  collectRlsRoleEvidence,
  createClient,
  resolveRlsDatabaseUrl,
} from "./rls-connection-contract.mjs";

function parseArgs(argv) {
  const options = {
    mode: "validate",
    databaseUrlEnv: "",
  };
  for (const arg of argv) {
    if (arg.startsWith("--mode=")) options.mode = arg.slice("--mode=".length);
    if (arg.startsWith("--database-url-env=")) options.databaseUrlEnv = arg.slice("--database-url-env=".length);
  }
  if (!["apply", "validate", "runtime"].includes(options.mode)) {
    throw new Error(`Unsupported --mode=${options.mode}. Use apply, validate, or runtime.`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { envName, value: connectionString } = resolveRlsDatabaseUrl(options.mode, options.databaseUrlEnv);
  const client = await createClient(connectionString);
  try {
    const result = await collectRlsRoleEvidence(client, {
      mode: options.mode,
      envName,
      connectionString,
    });

    console.log(JSON.stringify(result, null, 2));

    if (options.mode !== "apply") {
      assertRuntimeValidationEvidence(result, {
        contextLabel: "Runtime-equivalent validation",
      });
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[rls-role-audit] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
