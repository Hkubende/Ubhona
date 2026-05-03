import * as React from "react";
import { AlertCircle, CheckCircle2, FileUp, Image as ImageIcon, Package } from "lucide-react";
import {
  explainUploadFailure,
  getUploadProviderStatus,
  uploadDishModelAsset,
  uploadFileAsset,
  uploadThumbnailAsset,
  type UploadedMediaAsset,
  type UploadAssetType,
} from "../../lib/uploads";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

type UploadFieldProps = {
  label: string;
  assetType: UploadAssetType;
  accept: string;
  value: string;
  onUploaded: (url: string) => void;
  onUploadedAsset?: (asset: UploadedMediaAsset) => void;
  linkedFieldLabel?: string;
  className?: string;
  disabled?: boolean;
  maxSizeMb?: number;
  restaurantId?: string;
  dishId?: string;
};

export default function UploadField({
  label,
  assetType,
  accept,
  value,
  onUploaded,
  onUploadedAsset,
  linkedFieldLabel,
  className,
  disabled = false,
  maxSizeMb,
  restaurantId,
  dishId,
}: UploadFieldProps) {
  const effectiveMaxSizeMb = maxSizeMb ?? (assetType === "model" ? 25 : 8);
  const assetLabel = assetType === "model" ? "3D model" : "thumbnail";
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "uploading" | "uploaded" | "failed">("idle");
  const supportsImagePreview = assetType !== "model";

  const acceptedSummary =
    assetType === "model"
      ? `.glb, .gltf up to ${effectiveMaxSizeMb}MB`
      : `jpg, jpeg, png, webp up to ${effectiveMaxSizeMb}MB`;

  const validateFile = React.useCallback(
    (nextFile: File | null) => {
      if (!nextFile) return "";
      const maxBytes = effectiveMaxSizeMb * 1024 * 1024;
      if (nextFile.size > maxBytes) {
        return `File must be ${effectiveMaxSizeMb}MB or smaller.`;
      }
      const name = nextFile.name.toLowerCase();
      const mime = String(nextFile.type || "").toLowerCase();
      if (assetType === "model") {
        const modelMimeAllowed =
          mime === "model/gltf-binary" || mime === "model/gltf+json" || mime === "application/octet-stream";
        const modelExtAllowed = name.endsWith(".glb") || name.endsWith(".gltf");
        if (!modelMimeAllowed && !modelExtAllowed) {
          return "Only .glb and .gltf files are supported.";
        }
      } else if (!mime.startsWith("image/")) {
        return "Only image files are supported.";
      }
      return "";
    },
    [assetType, effectiveMaxSizeMb]
  );

  const upload = async () => {
    if (disabled) return;
    if (!file) {
      setError("Select a file before uploading.");
      setStatus("failed");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    setStatus("uploading");
    try {
      let url = "";
      if (assetType === "thumb") {
        const result = await uploadThumbnailAsset(file, restaurantId, dishId);
        url = result.url;
        if (result.asset && onUploadedAsset) onUploadedAsset(result.asset);
      } else if (assetType === "model") {
        const result = await uploadDishModelAsset(file, restaurantId, dishId);
        url = result.url;
        if (result.asset && onUploadedAsset) onUploadedAsset(result.asset);
      } else {
        url = await uploadFileAsset(file, assetType);
      }
      onUploaded(url);
      const linkedText = linkedFieldLabel ? ` and linked to ${linkedFieldLabel}` : "";
      setNotice(
        `${assetLabel[0].toUpperCase()}${assetLabel.slice(1)} uploaded${linkedText}. Save dish to persist changes.`
      );
      setFile(null);
      setStatus("uploaded");
    } catch (err) {
      const providerStatus = getUploadProviderStatus();
      const configuredHint =
        providerStatus.mode === "supabase"
          ? `Provider: Supabase (${providerStatus.expectedBuckets.thumbnail}, ${providerStatus.expectedBuckets.model}) @ ${providerStatus.supabaseProjectHost || "unknown-project"}`
          : providerStatus.mode === "api"
            ? "Provider: API upload endpoint"
            : "Provider: none configured";
      const reason = explainUploadFailure(err, assetType);
      setError(`${reason} ${configuredHint}`.trim());
      setStatus("failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("ui-panel-inset rounded-2xl p-3", className)}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/72">{label}</div>
      <p className="mb-2 text-[11px] text-text-secondary/70">{acceptedSummary}</p>
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <label className="block">
          <input
            type="file"
            accept={accept}
            disabled={disabled || uploading}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null;
              const validationError = validateFile(nextFile);
              setError(validationError);
              setNotice("");
              setStatus(validationError ? "failed" : "idle");
              setFile(validationError ? null : nextFile);
            }}
            className="sr-only"
          />
          <span className="ui-input-control inline-flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-primary transition hover:border-primary/35">
            <FileUp className="h-4 w-4 text-primary/80" />
            {file ? `Replace ${assetLabel}` : `Choose ${assetLabel}`}
          </span>
        </label>
        <Button
          type="button"
          onClick={() => void upload()}
          disabled={disabled || !file || uploading}
          variant="primary"
          size="sm"
          className="md:min-w-[108px]"
        >
          {uploading ? `Uploading ${assetLabel}...` : `Upload ${assetLabel}`}
        </Button>
      </div>
      {file ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-[color:var(--ui-note-icon-bg)] px-2.5 py-2 text-xs text-text-secondary/78">
          {supportsImagePreview ? <ImageIcon className="h-3.5 w-3.5 text-primary/80" /> : <Package className="h-3.5 w-3.5 text-primary/80" />}
          <span className="truncate">{file.name}</span>
          <span className="text-text-secondary/55">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-text-secondary/62">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            status === "uploaded"
              ? "bg-emerald-300"
              : status === "failed"
                ? "bg-red-300"
                : status === "uploading"
                  ? "bg-primary"
                  : "bg-border-strong"
          )}
        />
        Status: {status}
      </div>
      {value ? (
        supportsImagePreview ? (
          <div className="mt-2 rounded-xl border border-border bg-[color:var(--ui-note-icon-bg)] p-2">
            <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-text-secondary/62">Current asset</div>
            <img
              src={value}
              alt={`${label} preview`}
              className="h-24 w-full rounded-xl border border-border object-cover"
            />
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-border bg-[color:var(--ui-note-icon-bg)] px-2.5 py-2 text-xs text-text-secondary/72">
            <div className="mb-1 uppercase tracking-[0.08em] text-text-secondary/62">Current model</div>
            <div className="truncate font-medium text-text-primary">
              {value.split("/").pop() || "Model linked"}
            </div>
            <div className="truncate text-text-secondary/70">{value}</div>
          </div>
        )
      ) : null}
      {value && file ? (
        <div className="mt-2 text-xs text-text-secondary/72">
          Uploading this file will replace the current {assetLabel} once you save the dish.
        </div>
      ) : null}
      {notice ? (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-700 dark:text-red-200">
          <AlertCircle className="h-3.5 w-3.5" />
          Upload failed: {error}
        </div>
      ) : null}
    </div>
  );
}
