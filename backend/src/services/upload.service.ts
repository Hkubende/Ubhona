import { prisma } from "../prisma.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import type { Prisma } from "@prisma/client";

export type UploadAssetType = "logo" | "cover" | "thumb" | "model";

export type PrepareUploadInput = {
  restaurantId: string;
  fileName: string;
  fileType: string;
  assetType: UploadAssetType;
  fileSize?: number;
};
export type ServerManagedUploadInput = {
  restaurantId: string;
  dishId: string;
  fileName: string;
  fileType: string;
  bytes: Buffer;
  assetType: "thumb" | "model";
};
type UploadDbClient = typeof prisma | Prisma.TransactionClient;

function safeName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extensionFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function guessExtension(fileType: string, fallback: string) {
  if (fileType.startsWith("image/jpeg")) return "jpg";
  if (fileType.startsWith("image/png")) return "png";
  if (fileType.startsWith("image/webp")) return "webp";
  if (fileType === "model/gltf-binary") return "glb";
  if (fileType === "model/gltf+json") return "gltf";
  if (fileType === "application/octet-stream") return fallback;
  return fallback;
}

function normalizeAssetType(assetType: UploadAssetType) {
  return assetType === "thumb" ? "thumbnail" : assetType;
}

const LOG_UPLOAD_DEBUG =
  String(process.env.LOG_UPLOAD_DEBUG || "").trim().toLowerCase() === "true" || process.env.NODE_ENV !== "production";
const checkedBuckets = new Set<string>();

function uploadDebug(message: string, details?: Record<string, unknown>) {
  if (!LOG_UPLOAD_DEBUG) return;
  if (details) {
    console.info(`[uploads] ${message}`, details);
    return;
  }
  console.info(`[uploads] ${message}`);
}

function assertFileType(assetType: UploadAssetType, fileType: string, ext: string) {
  if (assetType === "model") {
    const okByType =
      fileType === "model/gltf-binary" || fileType === "model/gltf+json" || fileType === "application/octet-stream";
    const okByExt = ext === "glb" || ext === "gltf";
    if (!okByType && !okByExt) {
      throw new Error("Model upload must be a .glb or .gltf file.");
    }
    return;
  }
  if (!fileType.startsWith("image/")) {
    throw new Error("Logo, cover, and thumbnail uploads must be image files.");
  }
}

function assertFileSize(assetType: UploadAssetType, fileSize?: number) {
  if (!Number.isFinite(fileSize)) return;
  const sizeBytes = Number(fileSize);
  if (sizeBytes <= 0) {
    throw new Error("File size must be greater than 0 bytes.");
  }
  const maxBytes = assetType === "model" ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    const maxMb = assetType === "model" ? 25 : 8;
    throw new Error(`File exceeds maximum allowed size (${maxMb}MB).`);
  }
}

function getStorageBucket(assetType: UploadAssetType) {
  const legacy = process.env.SUPABASE_STORAGE_BUCKET || "";
  const thumbs = process.env.SUPABASE_STORAGE_BUCKET_THUMBNAILS || "";
  const models = process.env.SUPABASE_STORAGE_BUCKET_MODELS || "";
  const branding = process.env.SUPABASE_STORAGE_BUCKET_BRANDING || "";

  if (assetType === "thumb") return thumbs || legacy || "dish-thumbnails";
  if (assetType === "model") return models || legacy || "dish-models";
  return branding || legacy || "restaurant-branding";
}

async function createSupabaseSignedUploadUrl(bucket: string, objectKey: string) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${objectKey}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ upsert: true }),
    }
  );
  const body = (await response.json().catch(() => null)) as
    | { signedURL?: string; token?: string; error?: string; message?: string }
    | null;
  if (!response.ok || !body?.token || !body?.signedURL) {
    throw new Error(body?.error || body?.message || "Failed to create signed upload URL.");
  }
  return {
    uploadUrl: `${supabaseUrl.replace(/\/+$/, "")}/storage/v1${body.signedURL}`,
    token: body.token,
  };
}

function safePathSegment(input: string, field: string) {
  const value = String(input || "").trim();
  if (!value) {
    throw new Error(`${field} is required.`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${field} contains invalid characters.`);
  }
  return value;
}

async function putObjectViaServiceRole(input: {
  bucket: string;
  objectKey: string;
  fileType: string;
  bytes: Buffer;
}) {
  uploadDebug("putObjectViaServiceRole.begin", {
    bucket: input.bucket,
    objectKey: input.objectKey,
    fileType: input.fileType || "application/octet-stream",
    byteLength: input.bytes.byteLength,
  });
  const { error } = await supabaseAdmin.storage.from(input.bucket).upload(input.objectKey, input.bytes, {
    contentType: input.fileType || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    uploadDebug("putObjectViaServiceRole.error", {
      bucket: input.bucket,
      objectKey: input.objectKey,
      fileType: input.fileType || "application/octet-stream",
      error: error.message,
    });
    throw new Error(error.message || "Storage upload failed.");
  }
  uploadDebug("putObjectViaServiceRole.success", {
    bucket: input.bucket,
    objectKey: input.objectKey,
  });
}

async function ensureBucketExists(bucket: string) {
  if (checkedBuckets.has(bucket)) return;
  const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
  if (error || !data) {
    uploadDebug("ensureBucketExists.error", { bucket, error: error?.message || "Bucket not found." });
    throw new Error(`Supabase bucket '${bucket}' does not exist or is not accessible: ${error?.message || "not found"}`);
  }
  checkedBuckets.add(bucket);
  uploadDebug("ensureBucketExists.ok", { bucket });
}

export async function prepareUpload(input: PrepareUploadInput, client: UploadDbClient = prisma) {
  const rawExt = extensionFromName(input.fileName);
  const defaultExt = input.assetType === "model" ? "glb" : "png";
  const ext = guessExtension(input.fileType, rawExt || defaultExt);
  assertFileType(input.assetType, input.fileType, ext);
  assertFileSize(input.assetType, input.fileSize);

  const bucket = getStorageBucket(input.assetType);
  const baseName = safeName(input.fileName.replace(/\.[^.]+$/, "")) || `${input.assetType}-${Date.now()}`;
  const objectKey = `restaurants/${input.restaurantId}/${input.assetType}/${Date.now()}-${baseName}.${ext}`;
  const { uploadUrl, token } = await createSupabaseSignedUploadUrl(bucket, objectKey);

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publicBase =
    (process.env.SUPABASE_STORAGE_PUBLIC_URL || "").replace(/\/+$/, "") ||
    `${supabaseUrl}/storage/v1/object/public`;
  const publicUrl = `${publicBase}/${bucket}/${objectKey}`;

  const asset = await client.uploadAsset.create({
    data: {
      restaurantId: input.restaurantId,
      assetType: input.assetType,
      fileName: input.fileName,
      fileType: input.fileType,
      bucket,
      objectKey,
      publicUrl,
      status: "signed",
    },
    select: {
      id: true,
      restaurantId: true,
      assetType: true,
      publicUrl: true,
      fileName: true,
      fileType: true,
      objectKey: true,
      createdAt: true,
    },
  });

  return {
    id: asset.id,
    restaurant_id: asset.restaurantId,
    type: asset.assetType,
    url: asset.publicUrl,
    file_name: asset.fileName,
    mime_type: asset.fileType,
    created_at: asset.createdAt,
    upload_url: uploadUrl,
    upload_token: token,
    object_key: asset.objectKey,
    method: "PUT" as const,
  };
}

export async function uploadAssetServerManaged(input: ServerManagedUploadInput, client: UploadDbClient = prisma) {
  const restaurantId = safePathSegment(input.restaurantId, "restaurantId");
  const dishId = safePathSegment(input.dishId, "dishId");
  const rawExt = extensionFromName(input.fileName);
  const defaultExt = input.assetType === "model" ? "glb" : "png";
  const ext = guessExtension(input.fileType, rawExt || defaultExt);
  assertFileType(input.assetType, input.fileType, ext);
  assertFileSize(input.assetType, input.bytes.byteLength);

  const bucket = getStorageBucket(input.assetType);
  const objectKey =
    input.assetType === "thumb"
      ? `${restaurantId}/${dishId}/thumbnail.${ext}`
      : `${restaurantId}/${dishId}/model.${ext}`;
  const contentType = input.fileType || "application/octet-stream";

  await ensureBucketExists(bucket);

  await putObjectViaServiceRole({
    bucket,
    objectKey,
    fileType: contentType,
    bytes: input.bytes,
  });

  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publicBase =
    (process.env.SUPABASE_STORAGE_PUBLIC_URL || "").replace(/\/+$/, "") ||
    `${supabaseUrl}/storage/v1/object/public`;
  const publicUrl = `${publicBase}/${bucket}/${objectKey}`;

  const asset = await client.uploadAsset.create({
    data: {
      restaurantId,
      assetType: input.assetType,
      fileName: input.fileName,
      fileType: contentType,
      bucket,
      objectKey,
      publicUrl,
      status: "uploaded",
    },
    select: {
      id: true,
      restaurantId: true,
      assetType: true,
      fileName: true,
      fileType: true,
      bucket: true,
      objectKey: true,
      publicUrl: true,
      status: true,
      createdAt: true,
    },
  });

  return {
    id: asset.id,
    restaurant_id: asset.restaurantId,
    type: normalizeAssetType(asset.assetType as UploadAssetType),
    file_name: asset.fileName,
    mime_type: asset.fileType,
    bucket: asset.bucket,
    object_key: asset.objectKey,
    path: asset.objectKey,
    url: asset.publicUrl,
    status: asset.status,
    created_at: asset.createdAt,
  };
}

export async function completeUpload(input: {
  restaurantId: string;
  uploadId: string;
  status: "uploaded" | "failed";
}, client: UploadDbClient = prisma) {
  const existing = await client.uploadAsset.findFirst({
    where: { id: input.uploadId, restaurantId: input.restaurantId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Upload asset not found.");
  }
  const updated = await client.uploadAsset.update({
    where: { id: existing.id },
    data: { status: input.status },
    select: {
      id: true,
      restaurantId: true,
      assetType: true,
      publicUrl: true,
      fileName: true,
      fileType: true,
      createdAt: true,
      status: true,
    },
  });
  return {
    id: updated.id,
    restaurant_id: updated.restaurantId,
    type: updated.assetType,
    url: updated.publicUrl,
    file_name: updated.fileName,
    mime_type: updated.fileType,
    created_at: updated.createdAt,
    status: updated.status,
  };
}
