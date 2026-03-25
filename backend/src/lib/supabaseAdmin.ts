import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const LOG_UPLOAD_DEBUG =
  String(process.env.LOG_UPLOAD_DEBUG || "").trim().toLowerCase() === "true" || process.env.NODE_ENV !== "production";

if (LOG_UPLOAD_DEBUG) {
  let host = "invalid";
  try {
    host = new URL(SUPABASE_URL).host;
  } catch {
    host = "invalid";
  }
  console.info("[uploads.config] supabase admin client initialized", {
    supabaseHost: host,
    hasServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY.length > 0,
  });
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
