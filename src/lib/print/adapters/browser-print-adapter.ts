import type { FormattedPrintDocument } from "../models";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function browserPrintAdapter(document: FormattedPrintDocument) {
  if (typeof window === "undefined") return false;
  const printWindow = window.open("", "_blank", "width=420,height=720");
  if (!printWindow) return false;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(document.title)}</title>
<style>
  @page { size: ${document.paperWidth} auto; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    width: ${document.paperWidth};
    font-family: "Courier New", monospace;
    font-size: 12px;
    line-height: 1.35;
  }
  body { padding: 6mm 5mm; }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body><pre>${escapeHtml(document.lines.join("\n"))}</pre></body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    printWindow.focus();
    printWindow.print();
    setTimeout(() => {
      try {
        printWindow.close();
      } catch {
        // Ignore window close errors.
      }
    }, 120);
  };

  printWindow.addEventListener("load", triggerPrint, { once: true });
  setTimeout(triggerPrint, 240);
  return true;
}
