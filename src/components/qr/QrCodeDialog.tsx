import * as React from "react";
import { Copy, Download, ExternalLink, Link2, Printer, QrCode, X } from "lucide-react";
import { Button } from "../ui/Button";
import { getQrCodeImageUrl } from "../../lib/qr";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";

type QrCodeDialogProps = {
  open: boolean;
  title: string;
  description: string;
  linkLabel: string;
  url: string;
  printTitle: string;
  onClose: () => void;
};

export function QrCodeDialog({
  open,
  title,
  description,
  linkLabel,
  url,
  printTitle,
  onClose,
}: QrCodeDialogProps) {
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const qrCodeUrl = React.useMemo(() => (url ? getQrCodeImageUrl(url, 280) : ""), [url]);

  React.useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) {
      setNotice("");
      setError("");
    }
  }, [open]);

  const copyUrl = React.useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setError("");
      setNotice("Link copied.");
    } catch {
      setNotice("");
      setError("Could not copy link. Copy manually from the field.");
    }
  }, [url]);

  const downloadQr = React.useCallback(() => {
    if (!qrCodeUrl) return;
    const a = document.createElement("a");
    a.href = qrCodeUrl;
    a.download = `${printTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-qr.png`;
    a.rel = "noopener noreferrer";
    a.click();
  }, [printTitle, qrCodeUrl]);

  const printQr = React.useCallback(() => {
    if (!qrCodeUrl || !url) return;
    const printWindow = window.open("", "_blank", "width=640,height=760");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to print QR.");
      return;
    }
    const escapedTitle = printTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const escapedUrl = url.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapedTitle} QR</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Plus Jakarta Sans", Inter, system-ui, sans-serif;
        background: #050505;
        color: #F7F1E8;
        display: grid;
        place-items: center;
      }
      .card {
        width: min(92vw, 420px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        background: #0D0B0B;
        padding: 20px;
        text-align: center;
      }
      img {
        width: 280px;
        height: 280px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        background: #fff;
      }
      h1 {
        margin: 0 0 14px;
        font-size: 22px;
      }
      p {
        margin: 12px 0 0;
        font-size: 12px;
        color: #B8AEA3;
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>${escapedTitle}</h1>
      <img src="${qrCodeUrl}" alt="${escapedTitle} QR code" />
      <p>${escapedUrl}</p>
    </main>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [printTitle, qrCodeUrl, url]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cn(tokens.classes.surfaceElevated, "w-full max-w-2xl border border-border/90 p-4 sm:p-5")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/8 pb-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-primary">
              <QrCode className="h-3.5 w-3.5 text-primary" />
              QR Preview
            </div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">{title}</h2>
            <p className={cn("mt-1", typography.mutedBody)}>{description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close QR dialog">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!url || !qrCodeUrl ? (
          <p className="rounded-xl border border-red-300/35 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            QR link is unavailable. Set restaurant slug and dish data first.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)] md:items-start">
            <div className="rounded-2xl border border-white/12 bg-white p-2 shadow-[0_20px_32px_rgba(0,0,0,0.35)]">
              <img src={qrCodeUrl} alt={`${title} QR`} className="h-[280px] w-[280px] rounded-xl" />
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className={cn("mb-1 inline-flex items-center gap-1.5", typography.label)}>
                  <Link2 className="h-3.5 w-3.5 text-primary/85" />
                  {linkLabel}
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-text-secondary break-all">
                  {url}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" size="sm" onClick={() => void copyUrl()} className="justify-start">
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
                </Button>
                <a href={url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </Button>
                </a>
                <Button variant="primary" size="sm" onClick={downloadQr} className="justify-start">
                  <Download className="h-3.5 w-3.5" />
                  Download QR
                </Button>
                <Button variant="secondary" size="sm" onClick={printQr} className="justify-start">
                  <Printer className="h-3.5 w-3.5" />
                  Print QR
                </Button>
              </div>
              <p className="text-[11px] text-text-secondary/70">
                Download for digital sharing. Print for table cards, counters, and in-store promotions.
              </p>
              {notice ? (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
