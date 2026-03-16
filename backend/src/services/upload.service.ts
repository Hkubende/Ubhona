import { prisma } from "../prisma.js";

export type UploadAssetType = "logo" | "cover" | "thumb" | "model";

export type PrepareUploadInput = {
  restaurantId: string;
  fileName: string;
  fileType: string;
  assetType: UploadAssetType;
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
  return fallback;
}

function assertFileType(assetType: UploadAssetType, fileType: string, ext: string) {
  if (assetType === "model") {
    const okByType = fileType === "model/gltf-binary";
    const okByExt = ext === "glb";
    if (!okByType && !okByExt) {
      throw new Error("Model upload must be a .glb file.");
    }
    return;
  }
  if (!fileType.startsWith("image/")) {
    throw new Error("Logo, cover, and thumbnail uploads must be image files.");
  }
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

export async function prepareUpload(input: PrepareUploadInput) {
  const rawExt = extensionFromName(input.fileName);
  const defaultExt = input.assetType === "model" ? "glb" : "png";
  const ext = guessExtension(input.fileType, rawExt || defaultExt);
  assertFileType(input.assetType, input.fileType, ext);

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "menuvista-assets";
  const baseName = safeName(input.fileName.replace(/\.[^.]+$/, "")) || `${input.assetType}-${Date.now()}`;
  const objectKey = `restaurants/${input.restaurantId}/${input.assetType}/${Date.now()}-${baseName}.${ext}`;
  const { uploadUrl, token } = await createSupabaseSignedUploadUrl(bucket, objectKey);

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publicBase =
    (process.env.SUPABASE_STORAGE_PUBLIC_URL || "").replace(/\/+$/, "") ||
    `${supabaseUrl}/storage/v1/object/public`;
  const publicUrl = `${publicBase}/${bucket}/${objectKey}`;

  const asset = await prisma.uploadAsset.create({
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

export async function completeUpload(input: {
  restaurantId: string;
  uploadId: string;
  status: "uploaded" | "failed";
}) {
  const existing = await prisma.uploadAsset.findFirst({
    where: { id: input.uploadId, restaurantId: input.restaurantId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Upload asset not found.");
  }
  const updated = await prisma.uploadAsset.update({
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
