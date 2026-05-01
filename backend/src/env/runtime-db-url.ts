function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

export type RuntimeDatabaseUrlResolution = {
  source: "APP_RUNTIME_DATABASE_URL" | "DATABASE_URL" | "missing";
  value: string;
};

export function applyRuntimeDatabaseUrlContract(): RuntimeDatabaseUrlResolution {
  const appRuntimeDatabaseUrl = readEnv("APP_RUNTIME_DATABASE_URL");
  if (appRuntimeDatabaseUrl) {
    process.env.DATABASE_URL = appRuntimeDatabaseUrl;
    return {
      source: "APP_RUNTIME_DATABASE_URL",
      value: appRuntimeDatabaseUrl,
    };
  }

  const databaseUrl = readEnv("DATABASE_URL");
  if (databaseUrl) {
    return {
      source: "DATABASE_URL",
      value: databaseUrl,
    };
  }

  return {
    source: "missing",
    value: "",
  };
}

