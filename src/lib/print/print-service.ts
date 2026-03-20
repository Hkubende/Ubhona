import { bluetoothPrinterAdapter } from "./adapters/bluetooth-printer-adapter";
import { browserPrintAdapter } from "./adapters/browser-print-adapter";
import { escposPreviewAdapter } from "./adapters/escpos-preview-adapter";
import { buildEscPosCustomerReceipt } from "./escpos-customer-receipt";
import { buildEscPosKitchenTicket } from "./escpos-kitchen-ticket";
import { buildEscPosPaymentReceipt } from "./escpos-payment-receipt";
import { formatCustomerReceipt } from "./format-customer-receipt";
import { formatKitchenTicket } from "./format-kitchen-ticket";
import { formatPaymentReceipt } from "./format-payment-receipt";
import type { FormattedPrintDocument, PrintOrder } from "./models";
import { getPrinterSettings } from "./printer-settings";

export type PrintTrigger = "manual" | "auto";

export type PrintJobResult = {
  ok: boolean;
  skipped?: boolean;
  transport: "browser" | "bluetooth" | "escpos-preview";
  message?: string;
};

function applyFooterSetting(order: PrintOrder, lines: string[]) {
  const settings = getPrinterSettings();
  if (settings.showBrandingFooter) return lines;
  const hiddenFooter = (order.restaurant.footerText || "Powered by Ubhona").trim().toLowerCase();
  return lines.filter((line) => line.trim().toLowerCase() !== hiddenFooter);
}

function shouldRunAuto(trigger: PrintTrigger, enabled: boolean) {
  if (trigger !== "auto") return true;
  const settings = getPrinterSettings();
  if (settings.printMode !== "auto") return false;
  return enabled;
}

async function dispatchPrint(
  title: string,
  browserDocument: FormattedPrintDocument,
  escposCommands: string[]
): Promise<PrintJobResult> {
  const settings = getPrinterSettings();

  if (settings.printerTransport === "escpos-preview") {
    const ok = escposPreviewAdapter({ title, commands: escposCommands });
    return {
      ok,
      transport: "escpos-preview",
      message: ok ? undefined : "ESC/POS preview window could not open.",
    };
  }

  if (settings.printerTransport === "bluetooth") {
    const result = await bluetoothPrinterAdapter(escposCommands);

    if (result.delivered) {
      return {
        ok: true,
        transport: "bluetooth",
        message: "Sent to Bluetooth thermal printer.",
      };
    }

    const fallback = browserPrintAdapter(browserDocument);
    return {
      ok: fallback,
      transport: fallback ? "browser" : "bluetooth",
      message: result.message,
    };
  }

  const printed = browserPrintAdapter(browserDocument);
  if (!printed) {
    const preview = escposPreviewAdapter({ title, commands: escposCommands });
    return {
      ok: preview,
      transport: preview ? "escpos-preview" : "browser",
      message: "Browser print popup was blocked. Opened ESC/POS preview instead.",
    };
  }

  return {
    ok: true,
    transport: "browser",
  };
}

export async function printKitchenTicket(
  order: PrintOrder,
  options?: { trigger?: PrintTrigger }
): Promise<PrintJobResult> {
  const trigger = options?.trigger || "manual";
  const settings = getPrinterSettings();
  if (!shouldRunAuto(trigger, settings.autoPrintKitchenTicketOnOrder)) {
    return { ok: true, skipped: true, transport: settings.printerTransport, message: "Auto kitchen ticket disabled." };
  }

  const formatted = formatKitchenTicket(order, settings.paperWidth);
  formatted.lines = applyFooterSetting(order, formatted.lines);
  const escpos = buildEscPosKitchenTicket(order, settings.paperWidth);
  return dispatchPrint(formatted.title, formatted, escpos);
}

export async function printCustomerReceipt(
  order: PrintOrder,
  options?: { trigger?: PrintTrigger }
): Promise<PrintJobResult> {
  const trigger = options?.trigger || "manual";
  const settings = getPrinterSettings();
  if (!shouldRunAuto(trigger, settings.autoPrintCustomerReceiptOnOrder)) {
    return { ok: true, skipped: true, transport: settings.printerTransport, message: "Auto customer receipt disabled." };
  }

  const formatted = formatCustomerReceipt(order, settings.paperWidth);
  formatted.lines = applyFooterSetting(order, formatted.lines);
  const escpos = buildEscPosCustomerReceipt(order, settings.paperWidth);
  return dispatchPrint(formatted.title, formatted, escpos);
}

export async function printPaymentReceipt(
  order: PrintOrder,
  options?: { trigger?: PrintTrigger }
): Promise<PrintJobResult> {
  const trigger = options?.trigger || "manual";
  const settings = getPrinterSettings();
  if (!shouldRunAuto(trigger, settings.autoPrintPaymentReceiptOnPayment)) {
    return { ok: true, skipped: true, transport: settings.printerTransport, message: "Auto payment receipt disabled." };
  }

  const formatted = formatPaymentReceipt(order, settings.paperWidth);
  formatted.lines = applyFooterSetting(order, formatted.lines);
  const escpos = buildEscPosPaymentReceipt(order, settings.paperWidth);
  return dispatchPrint(formatted.title, formatted, escpos);
}
