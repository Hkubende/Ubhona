import { api } from "./api";

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

export async function requestUploadUrl(file: File, assetType: UploadAssetType) {
  return api.post<PreparedUpload>("/uploads/request", {
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    assetType,
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
