import * as React from "react";
import { uploadFileAsset, type UploadAssetType } from "../../lib/uploads";

type UploadFieldProps = {
  label: string;
  assetType: UploadAssetType;
  accept: string;
  value: string;
  onUploaded: (url: string) => void;
  className?: string;
};

export default function UploadField({
  label,
  assetType,
  accept,
  value,
  onUploaded,
  className,
}: UploadFieldProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const upload = async () => {
    if (!file) {
      setError("Select a file before uploading.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const url = await uploadFileAsset(file, assetType);
      onUploaded(url);
      setNotice("Upload complete.");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <div className="mb-1 text-xs text-white/60">{label}</div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          type="file"
          accept={accept}
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-3 file:py-1 file:text-xs file:font-bold file:text-black"
        />
        <button
          type="button"
          onClick={() => void upload()}
          disabled={!file || uploading}
          className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      {value ? (
        assetType === "model" ? (
          <div className="mt-2 truncate text-xs text-white/70">{value}</div>
        ) : (
          <img
            src={value}
            alt={`${label} preview`}
            className="mt-2 h-16 w-16 rounded-xl border border-white/10 object-cover"
          />
        )
      ) : null}
      {notice ? <div className="mt-1 text-xs text-emerald-300">{notice}</div> : null}
      {error ? <div className="mt-1 text-xs text-red-300">{error}</div> : null}
    </div>
  );
}
