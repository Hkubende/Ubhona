import { api } from "./api";
import { getCurrentUser } from "./auth";
import { isApiConfigured } from "./config";
import { getRestaurantProfile } from "./restaurant";
import { isSupabaseConfigured, supabase, supabaseConfigStatus } from "./supabase";

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

const THUMB_BUCKET = "dish-thumbnails";
const MODEL_BUCKET = "dish-models";
const MAX_THUMB_SIZE = 8 * 1024 * 1024;
const MAX_MODEL_SIZE = 25 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const allowedMime = type === "model/gltf-binary" || type === "model/gltf+json";
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

async function uploadToSupabaseStorage(file: File, bucket: string, objectPath: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase upload is not configured.");
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    throw new Error(uploadError.message || "Supabase upload failed.");
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data.publicUrl) {
    throw new Error("Failed to resolve public URL for uploaded file.");
  }
  return data.publicUrl;
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
  const ext = extOf(file.name) || "jpg";
  const objectPath = `${rid}/${did}/thumbnail.${ext}`;

  if (isSupabaseConfigured) {
    return uploadToSupabaseStorage(file, THUMB_BUCKET, objectPath);
  }

  return uploadFileAsset(file, "thumb");
}

export async function uploadDishModel(file: File, restaurantId?: string, dishId?: string) {
  validateModel(file);
  const { restaurantId: rid, dishId: did } = getUploadContext(restaurantId, dishId);
  const ext = extOf(file.name) || "glb";
  const objectPath = `${rid}/${did}/model.${ext}`;

  if (isSupabaseConfigured) {
    return uploadToSupabaseStorage(file, MODEL_BUCKET, objectPath);
  }

  return uploadFileAsset(file, "model");
}

export type UploadProviderStatus = {
  mode: "supabase" | "api" | "none";
  supabaseConfigured: boolean;
  supabaseUrlPresent: boolean;
  supabaseUrlValid: boolean;
  supabaseAnonKeyPresent: boolean;
  apiConfigured: boolean;
  expectedBuckets: {
    thumbnail: string;
    model: string;
  };
};

export function getUploadProviderStatus() {
  const mode = isSupabaseConfigured ? "supabase" : isApiConfigured ? "api" : "none";
  return {
    mode,
    supabaseConfigured: isSupabaseConfigured,
    supabaseUrlPresent: supabaseConfigStatus.urlPresent,
    supabaseUrlValid: supabaseConfigStatus.urlValid,
    supabaseAnonKeyPresent: supabaseConfigStatus.anonKeyPresent,
    apiConfigured: isApiConfigured,
    expectedBuckets: {
      thumbnail: THUMB_BUCKET,
      model: MODEL_BUCKET,
    },
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
  if (lower.includes("bucket not found")) {
    return `Supabase bucket '${targetBucket}' was not found. Create it in Storage and set it to public.`;
  }
  if (lower.includes("mime type") && lower.includes("not supported")) {
    return `Supabase bucket '${targetBucket}' rejected the file MIME type. Verify allowed MIME types and upload a valid ${assetType === "model" ? ".glb/.gltf" : "image"} file.`;
  }
  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("unauthorized")) {
    return `Supabase Storage policy denied upload to '${targetBucket}'. Verify insert/update policies for your restaurant path.`;
  }
  if (lower.includes("supabase upload is not configured")) {
    if (!status.supabaseUrlPresent && !status.supabaseAnonKeyPresent) {
      return "Supabase uploads are disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
    }
    if (!status.supabaseUrlValid) {
      return "Supabase uploads are disabled: VITE_SUPABASE_URL is invalid. Use a full https://<project>.supabase.co URL.";
    }
    if (!status.supabaseAnonKeyPresent) {
      return "Supabase uploads are disabled: VITE_SUPABASE_ANON_KEY is missing.";
    }
  }
  if (lower.includes("api is not configured")) {
    if (!status.supabaseConfigured) {
      return "No upload provider is active. Configure Supabase env vars or VITE_API_BASE backend uploads.";
    }
    return `Fallback upload API is disabled. Supabase should be active; verify bucket '${targetBucket}' and Storage policies.`;
  }
  if (lower.includes("api is unreachable")) {
    if (status.mode === "api") {
      return "Upload API is unreachable. Check VITE_API_BASE and backend availability.";
    }
    return "Upload failed due to service reachability. Verify network and provider configuration.";
  }

  return message;
}
