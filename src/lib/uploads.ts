import { api, AUTH_TOKEN_KEY } from "./api";
import { getCurrentUser } from "./auth";
import { appConfig, isApiConfigured } from "./config";
import { getRestaurantProfile } from "./restaurant";
import { supabaseConfigStatus } from "./supabase";

export type UploadAssetType = "logo" | "cover" | "thumb" | "model";

export type PreparedUpload = {
  id: string;
  restaurant_id: string;
  type: UploadAssetType;
  url: string;
  file_name: string;
  mime_type: string;
  created_at: string;
  upload_url: string;
  upload_token: string;
  object_key: string;
  method: "PUT";
};

const MAX_THUMB_SIZE = 8 * 1024 * 1024;
const MAX_MODEL_SIZE = 25 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPLOAD_PROVIDER = String(import.meta.env.VITE_UPLOAD_PROVIDER || "").trim().toLowerCase();

function extOf(name: string) {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function safeSegment(value: string, fallback: string) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function ensureRestaurantScope(requestedRestaurantId?: string) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to upload files.");
  }

  const activeProfile = getRestaurantProfile();
  const activeRestaurantId = activeProfile?.id ? safeSegment(activeProfile.id, "local-default-restaurant") : "";
  const requested = requestedRestaurantId ? safeSegment(requestedRestaurantId, activeRestaurantId || "local-default-restaurant") : "";

  // Policy-ready tenant guard: uploads are scoped to the current restaurant only.
  if (requested && activeRestaurantId && requested !== activeRestaurantId) {
    throw new Error("Upload scope mismatch. You can only upload into your current restaurant folder.");
  }

  const restaurantId = requested || activeRestaurantId;
  if (!restaurantId) {
    throw new Error("Restaurant context is missing for upload.");
  }
  return restaurantId;
}

function validateThumbnail(file: File) {
  const ext = extOf(file.name);
  if (file.size > MAX_THUMB_SIZE) {
    throw new Error("Thumbnail must be 8MB or smaller.");
  }
  if (!IMAGE_MIME_TYPES.has(file.type.toLowerCase()) && !["jpg", "jpeg", "png", "webp"].includes(ext)) {
    throw new Error("Thumbnail must be jpg, jpeg, png, or webp.");
  }
}

function validateModel(file: File) {
  const ext = extOf(file.name);
  const type = String(file.type || "").toLowerCase();
  const allowedMime =
    type === "model/gltf-binary" || type === "model/gltf+json" || type === "application/octet-stream";
  const allowedExt = ext === "glb" || ext === "gltf";
  if (file.size > MAX_MODEL_SIZE) {
    throw new Error("3D model must be 25MB or smaller.");
  }
  if (!allowedMime && !allowedExt) {
    throw new Error("3D model must be .glb or .gltf.");
  }
}

function getUploadContext(restaurantId?: string, dishId?: string) {
  return {
    restaurantId: ensureRestaurantScope(restaurantId),
    dishId: safeSegment(dishId || `draft-${Date.now()}`, `draft-${Date.now()}`),
  };
}

function getSupabaseProjectHost() {
  const raw = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).host;
  } catch {
    return "";
  }
}

function getApiBase() {
  return String(appConfig.apiUrl || "").replace(/\/+$/, "");
}

async function uploadViaApi(
  file: File,
  input: {
    assetType: "thumb" | "model";
    restaurantId: string;
    dishId: string;
  }
) {
  if (!isApiConfigured) {
    throw new Error("Upload API is not configured.");
  }
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error("Upload API base URL is missing.");
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error("Missing auth token for API upload.");
  }

  const route = input.assetType === "thumb" ? "thumbnail" : "model";
  const url = `${apiBase}/api/uploads/${route}`;
  const formData = new FormData();
  formData.append("restaurantId", input.restaurantId);
  formData.append("dishId", input.dishId);
  formData.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; url?: string; ok?: boolean; bucket?: string; path?: string }
    | null;
  if (!response.ok || !body?.url) {
    throw new Error(body?.error || `API upload failed (${response.status}).`);
  }
  return body.url;
}

export async function requestUploadUrl(file: File, assetType: UploadAssetType) {
  return api.post<PreparedUpload>("/uploads/request", {
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    assetType,
    fileSize: file.size,
  });
}

export async function uploadToSignedUrl(file: File, prepared: PreparedUpload) {
  const hasTokenQuery = /[?&]token=/.test(prepared.upload_url);
  const uploadUrl = hasTokenQuery
    ? prepared.upload_url
    : `${prepared.upload_url}${prepared.upload_url.includes("?") ? "&" : "?"}token=${encodeURIComponent(
        prepared.upload_token
      )}`;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Upload failed (${response.status}).`);
  }
}

export async function markUploadComplete(uploadId: string, status: "uploaded" | "failed" = "uploaded") {
  return api.post<{ id: string; status: string; url: string }>("/uploads/complete", {
    uploadId,
    status,
  });
}

export async function uploadFileAsset(file: File, assetType: UploadAssetType) {
  const prepared = await requestUploadUrl(file, assetType);
  try {
    await uploadToSignedUrl(file, prepared);
    await markUploadComplete(prepared.id, "uploaded");
    return prepared.url;
  } catch (error) {
    await markUploadComplete(prepared.id, "failed").catch(() => {});
    throw error;
  }
}

export async function uploadThumbnail(file: File, restaurantId?: string, dishId?: string) {
  validateThumbnail(file);
  const { restaurantId: rid, dishId: did } = getUploadContext(restaurantId, dishId);
  return uploadViaApi(file, {
    assetType: "thumb",
    restaurantId: rid,
    dishId: did,
  });
}

export async function uploadDishModel(file: File, restaurantId?: string, dishId?: string) {
  validateModel(file);
  const { restaurantId: rid, dishId: did } = getUploadContext(restaurantId, dishId);
  return uploadViaApi(file, {
    assetType: "model",
    restaurantId: rid,
    dishId: did,
  });
}

export type UploadProviderStatus = {
  mode: "api" | "none";
  configuredMode: "api" | "supabase" | "auto";
  supabaseConfigured: false;
  supabaseUrlPresent: boolean;
  supabaseUrlValid: boolean;
  supabaseAnonKeyPresent: boolean;
  apiConfigured: boolean;
  expectedBuckets: {
    thumbnail: string;
    model: string;
  };
  supabaseProjectHost: string;
};

export function getUploadProviderStatus() {
  const mode = isApiConfigured ? "api" : "none";
  const configuredMode = UPLOAD_PROVIDER === "supabase" ? "supabase" : UPLOAD_PROVIDER === "api" ? "api" : "auto";
  return {
    mode,
    configuredMode,
    supabaseConfigured: false,
    supabaseUrlPresent: supabaseConfigStatus.urlPresent,
    supabaseUrlValid: supabaseConfigStatus.urlValid,
    supabaseAnonKeyPresent: supabaseConfigStatus.anonKeyPresent,
    apiConfigured: isApiConfigured,
    expectedBuckets: {
      thumbnail: "dish-thumbnails",
      model: "dish-models",
    },
    supabaseProjectHost: getSupabaseProjectHost(),
  } satisfies UploadProviderStatus;
}

export function explainUploadFailure(error: unknown, assetType: UploadAssetType) {
  const status = getUploadProviderStatus();
  const message = error instanceof Error ? error.message : "Upload failed.";
  const lower = message.toLowerCase();
  const targetBucket = assetType === "model" ? status.expectedBuckets.model : status.expectedBuckets.thumbnail;

  if (lower.includes("you must be signed in")) {
    return "Upload blocked: sign in to your restaurant account before uploading files.";
  }
  if (lower.includes("upload scope mismatch")) {
    return "Upload blocked by tenant scope: selected restaurant does not match your active restaurant.";
  }
  if (lower.includes("restaurant context is missing")) {
    return "Upload blocked: restaurant profile is missing. Complete onboarding or select the active restaurant.";
  }
  if (lower.includes("api is not configured")) {
    return "Upload API is not configured. Set VITE_API_BASE and VITE_UPLOAD_PROVIDER=api.";
  }
  if (lower.includes("missing auth token for api upload")) {
    return "Upload API requires an authenticated app session. Sign in again and retry.";
  }
  if (lower.includes("upload api base url is missing")) {
    return "Upload API base URL is missing. Set VITE_API_BASE.";
  }
  if (lower.includes("api upload failed")) {
    return `Upload API rejected the file for '${targetBucket}'. Check backend upload validation and Supabase env vars.`;
  }
  if (lower.includes("contains invalid characters")) {
    return "Upload path validation failed. Restaurant or dish ID contains invalid characters.";
  }
  if (lower.includes("missing supabase_url or supabase_service_role_key")) {
    return "Backend is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (lower.includes("storage upload failed")) {
    return `Supabase backend upload failed for '${targetBucket}'. Check bucket existence, MIME limits, and service-role permissions.`;
  }
  if (lower.includes("restaurantid must match your active restaurant")) {
    return "Upload blocked: restaurant scope mismatch.";
  }
  if (lower.includes("api is unreachable")) {
    if (status.mode === "api") {
      return "Upload API is unreachable. Check VITE_API_BASE and backend availability.";
    }
    return "Upload failed due to service reachability. Verify network and provider configuration.";
  }

  return message;
}
