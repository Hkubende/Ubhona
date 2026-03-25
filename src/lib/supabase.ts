import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

function isValidHttpUrl(value: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const supabaseUrlPresent = Boolean(supabaseUrl);
const supabaseAnonKeyPresent = Boolean(supabaseAnonKey);
const supabaseUrlValid = isValidHttpUrl(supabaseUrl);

export const isSupabaseConfigured = Boolean(supabaseAnonKeyPresent && supabaseUrlValid);

export const supabaseConfigStatus = {
  urlPresent: supabaseUrlPresent,
  urlValid: supabaseUrlValid,
  anonKeyPresent: supabaseAnonKeyPresent,
  configured: isSupabaseConfigured,
} as const;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
