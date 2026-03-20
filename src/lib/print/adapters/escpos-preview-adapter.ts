export type EscPosPreviewPayload = {
  title: string;
  commands: string[];
};

const SHOULD_LOG_INFO = import.meta.env.DEV;

export function escposPreviewAdapter(payload: EscPosPreviewPayload) {
  const text = payload.commands.join("\n");
  if (SHOULD_LOG_INFO) {
    // Keep visible in devtools for easy QA before real printer transport is added.
    // eslint-disable-next-line no-console
    console.info(`[ESC/POS PREVIEW] ${payload.title}\n${text}`);
  }
  if (typeof window === "undefined") return false;
  const previewWindow = window.open("", "_blank", "width=420,height=720");
  if (!previewWindow) return false;
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${payload.title}</title>
  <style>body{margin:0;padding:12px;background:#0b0b10;color:#f8f8f2;font-family:"Courier New",monospace;font-size:12px;}pre{white-space:pre-wrap;word-break:break-word;}</style>
  </head><body><pre>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre></body></html>`;
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  return true;
}
