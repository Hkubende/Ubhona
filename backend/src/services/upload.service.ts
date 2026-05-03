import { prisma, runWithTenantContext } from "../prisma.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";

export type UploadAssetType = "logo" | "cover" | "thumb" | "model";
export type MediaAssetType = "thumbnail" | "dish-image" | "model";

export type PrepareUploadInput = {
  restaurantId: string;
  userId: string;
  isAdmin: boolean;
  fileName: string;
  fileType: string;
  assetType: UploadAssetType;
  fileSize?: number;
};
export type ServerManagedUploadInput = {
  restaurantId: string;
  userId: string;
  isAdmin: boolean;
  dishId: string;
  fileName: string;
  fileType: string;
  bytes: Buffer;
  assetType: "thumb" | "model";
  uploadedBy?: string;
};

export type MediaAssetMetadata = {
  id: string;
  restaurantId: string;
  dishId?: string;
  assetType: MediaAssetType;
  bucket: string;
  path: string;
  publicUrl: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: string;
  uploadedBy?: string;
  variants?: {
    small?: string;
    medium?: string;
    original: string;
  };
};
type ImageVariantName = "small" | "medium" | "large";
type ImageVariantOutput = {
  name: ImageVariantName;
  width: number;
  height: number;
  bytes: Buffer;
  mimeType: "image/webp";
  fileName: `${ImageVariantName}.webp`;
};

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

function mapUploadTypeToMediaAssetType(assetType: UploadAssetType): MediaAssetType {
  if (assetType === "thumb") return "thumbnail";
  if (assetType === "model") return "model";
  return "dish-image";
}

const LOG_UPLOAD_DEBUG =
  String(process.env.LOG_UPLOAD_DEBUG || "").trim().toLowerCase() === "true" || process.env.NODE_ENV !== "production";
const checkedBuckets = new Set<string>();
const IMAGE_VARIANT_SIZES: ReadonlyArray<{ name: ImageVariantName; width: number }> = [
  { name: "small", width: 320 },
  { name: "medium", width: 640 },
  { name: "large", width: 1280 },
];

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
  const imageType = fileType.toLowerCase();
  const okImageType = imageType === "image/jpeg" || imageType === "image/png" || imageType === "image/webp";
  const okImageExt = ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
  if (!okImageType && !okImageExt) {
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

function normalizeModelMime(fileType: string, ext: string) {
  if (fileType === "application/octet-stream") {
    if (ext === "gltf") return "model/gltf+json";
    return "model/gltf-binary";
  }
  return fileType;
}

async function processImageVariants(input: {
  bytes: Buffer;
  fileType: string;
  fileName: string;
}) {
  try {
    const normalized = sharp(input.bytes, { failOn: "none" }).rotate();
    const metadata = await normalized.metadata();
    const originalWidth = Number(metadata.width || 0);
    const originalHeight = Number(metadata.height || 0);
    const variants: ImageVariantOutput[] = [];

    for (const config of IMAGE_VARIANT_SIZES) {
      const resized = normalized.clone().resize({
        width: config.width,
        fit: "inside",
        withoutEnlargement: true,
      });
      const rendered = await resized.webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
      variants.push({
        name: config.name,
        width: rendered.info.width,
        height: rendered.info.height,
        bytes: rendered.data,
        mimeType: "image/webp",
        fileName: `${config.name}.webp`,
      });
    }

    return {
      originalWidth: originalWidth || variants[variants.length - 1]?.width || undefined,
      originalHeight: originalHeight || variants[variants.length - 1]?.height || undefined,
      variants,
    };
  } catch (error) {
    throw new Error(
      `Image optimization failed for '${input.fileName}': ${error instanceof Error ? error.message : "Sharp processing error."}`
    );
  }
}

function deriveDishIdFromPath(path: string) {
  const parts = String(path || "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
  if ((parts[0] === "thumbnails" || parts[0] === "models") && parts.length >= 3) {
    return parts[2] || "";
  }
  if (parts.length < 2) return "";
  return parts[parts.length - 2] || "";
}

function extractAssetVersion(objectKey: string, prefix: string) {
  const normalizedPrefix = `${prefix.replace(/\/+$/, "")}/`;
  if (!objectKey.startsWith(normalizedPrefix)) return 0;
  const remainder = objectKey.slice(normalizedPrefix.length);
  const versionSegment = remainder.split("/")[0] || "";
  const match = versionSegment.match(/^v(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

async function getNextDishAssetVersion(input: {
  restaurantId: string;
  dishId: string;
  assetType: "thumb" | "model";
}, db: { uploadAsset: { findMany: typeof prisma.uploadAsset.findMany } } = prisma) {
  const prefix =
    input.assetType === "thumb"
      ? `thumbnails/${input.restaurantId}/${input.dishId}`
      : `models/${input.restaurantId}/${input.dishId}`;
  const rows = await db.uploadAsset.findMany({
    where: {
      restaurantId: input.restaurantId,
      assetType: input.assetType,
      objectKey: {
        startsWith: `${prefix}/`,
      },
    },
    select: {
      objectKey: true,
    },
  });
  const maxVersion = rows.reduce((highest, row) => Math.max(highest, extractAssetVersion(row.objectKey, prefix)), 0);
  return maxVersion + 1;
}

function toMediaAssetMetadata(row: {
  id: string;
  restaurantId: string;
  assetType: UploadAssetType;
  fileName: string;
  fileType: string;
  bucket: string;
  objectKey: string;
  publicUrl: string;
  createdAt: Date;
}, input: { sizeBytes: number; uploadedBy?: string }): MediaAssetMetadata {
  const dishId = deriveDishIdFromPath(row.objectKey);
  const mediaType = mapUploadTypeToMediaAssetType(row.assetType);
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    dishId: dishId || undefined,
    assetType: mediaType,
    bucket: row.bucket,
    path: row.objectKey,
    publicUrl: row.publicUrl,
    mimeType: row.fileType,
    originalFilename: row.fileName,
    sizeBytes: input.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    uploadedBy: input.uploadedBy,
    variants:
      mediaType === "thumbnail"
        ? {
            original: row.publicUrl,
            medium: row.publicUrl,
            small: row.publicUrl,
          }
        : {
            original: row.publicUrl,
          },
  };
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

export async function prepareUpload(input: PrepareUploadInput) {
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

  const asset = await runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) =>
      tx.uploadAsset.create({
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
      }),
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

export async function uploadAssetServerManaged(input: ServerManagedUploadInput) {
  const restaurantId = safePathSegment(input.restaurantId, "restaurantId");
  const dishId = safePathSegment(input.dishId, "dishId");
  const rawExt = extensionFromName(input.fileName);
  const defaultExt = input.assetType === "model" ? "glb" : "png";
  const ext = guessExtension(input.fileType, rawExt || defaultExt);
  assertFileType(input.assetType, input.fileType, ext);
  assertFileSize(input.assetType, input.bytes.byteLength);

  const bucket = getStorageBucket(input.assetType);
  const version = await runWithTenantContext({
    restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) =>
      getNextDishAssetVersion(
        {
          restaurantId,
          dishId,
          assetType: input.assetType,
        },
        tx as Prisma.TransactionClient
      ),
  });
  const versionDir =
    input.assetType === "thumb"
      ? `thumbnails/${restaurantId}/${dishId}/v${version}`
      : `models/${restaurantId}/${dishId}/v${version}`;
  const objectKey = input.assetType === "thumb" ? `${versionDir}/medium.webp` : `${versionDir}/model.${ext}`;
  const contentType =
    input.assetType === "model"
      ? normalizeModelMime(input.fileType || "application/octet-stream", ext)
      : "image/webp";

  await ensureBucketExists(bucket);

  let variantUrls: { small?: string; medium?: string; large?: string; original: string } | undefined;
  let variantWidth: number | undefined;
  let variantHeight: number | undefined;
  let persistedObjectKey = objectKey;
  let persistedContentType = contentType;
  let persistedByteSize = input.bytes.byteLength;

  if (input.assetType === "thumb") {
    const processed = await processImageVariants({
      bytes: input.bytes,
      fileType: input.fileType,
      fileName: input.fileName,
    });
    const baseDir = versionDir;
    for (const variant of processed.variants) {
      await putObjectViaServiceRole({
        bucket,
        objectKey: `${baseDir}/${variant.fileName}`,
        fileType: variant.mimeType,
        bytes: variant.bytes,
      });
    }
    const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
    const publicBase =
      (process.env.SUPABASE_STORAGE_PUBLIC_URL || "").replace(/\/+$/, "") ||
      `${supabaseUrl}/storage/v1/object/public`;
    variantUrls = {
      small: `${publicBase}/${bucket}/${baseDir}/small.webp`,
      medium: `${publicBase}/${bucket}/${baseDir}/medium.webp`,
      large: `${publicBase}/${bucket}/${baseDir}/large.webp`,
      original: `${publicBase}/${bucket}/${baseDir}/large.webp`,
    };
    persistedObjectKey = `${baseDir}/medium.webp`;
    persistedContentType = "image/webp";
    const mediumVariant = processed.variants.find((item) => item.name === "medium") || processed.variants[0];
    persistedByteSize = mediumVariant?.bytes.byteLength || input.bytes.byteLength;
    variantWidth = processed.originalWidth;
    variantHeight = processed.originalHeight;
  } else {
    await putObjectViaServiceRole({
      bucket,
      objectKey: persistedObjectKey,
      fileType: persistedContentType,
      bytes: input.bytes,
    });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publicBase =
    (process.env.SUPABASE_STORAGE_PUBLIC_URL || "").replace(/\/+$/, "") ||
    `${supabaseUrl}/storage/v1/object/public`;
  const publicUrl = `${publicBase}/${bucket}/${persistedObjectKey}`;

  const asset = await runWithTenantContext({
    restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) =>
      tx.uploadAsset.create({
        data: {
          restaurantId,
          assetType: input.assetType,
          fileName: input.fileName,
          fileType: persistedContentType,
          bucket,
          objectKey: persistedObjectKey,
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
      }),
  });

  const metadata = toMediaAssetMetadata(
    {
      id: asset.id,
      restaurantId: asset.restaurantId,
      assetType: input.assetType,
      fileName: asset.fileName,
      fileType: asset.fileType,
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      publicUrl: asset.publicUrl,
      createdAt: asset.createdAt,
    },
    { sizeBytes: persistedByteSize, uploadedBy: input.uploadedBy }
  );
  if (variantUrls) {
    metadata.variants = variantUrls;
    metadata.width = variantWidth;
    metadata.height = variantHeight;
  }

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
    asset: metadata,
  };
}

export async function completeUpload(input: {
  restaurantId: string;
  userId: string;
  isAdmin: boolean;
  uploadId: string;
  status: "uploaded" | "failed";
}) {
  return runWithTenantContext({
    restaurantId: input.restaurantId,
    userId: input.userId,
    isAdmin: input.isAdmin,
    fn: async (tx) => {
      const existing = await tx.uploadAsset.findFirst({
        where: { id: input.uploadId },
        select: { id: true },
      });
      if (!existing) {
        throw new Error("Upload asset not found.");
      }
      const updated = await tx.uploadAsset.update({
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
    },
  });
}
