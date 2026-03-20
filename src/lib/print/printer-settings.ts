import type { PaperWidth, PrintMode, PrinterTransport } from "./models";

export type PrinterSettings = {
  printMode: PrintMode;
  printerTransport: PrinterTransport;
  paperWidth: PaperWidth;
  showBrandingFooter: boolean;
  autoPrintCustomerReceiptOnOrder: boolean;
  autoPrintPaymentReceiptOnPayment: boolean;
  autoPrintKitchenTicketOnOrder: boolean;
};

const PRINTER_SETTINGS_KEY = "ubhona_printer_settings_v1";

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  printMode: "manual",
  printerTransport: "browser",
  paperWidth: "80mm",
  showBrandingFooter: true,
  autoPrintCustomerReceiptOnOrder: false,
  autoPrintPaymentReceiptOnPayment: false,
  autoPrintKitchenTicketOnOrder: false,
};

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function getPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(PRINTER_SETTINGS_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrinterSettings>;
    return {
      printMode: parsed.printMode === "auto" ? "auto" : "manual",
      printerTransport: parsed.printerTransport === "bluetooth"
        ? "bluetooth"
        : parsed.printerTransport === "escpos-preview"
          ? "escpos-preview"
          : "browser",
      paperWidth: parsed.paperWidth === "58mm" ? "58mm" : "80mm",
      showBrandingFooter: toBoolean(parsed.showBrandingFooter, true),
      autoPrintCustomerReceiptOnOrder: toBoolean(parsed.autoPrintCustomerReceiptOnOrder, false),
      autoPrintPaymentReceiptOnPayment: toBoolean(parsed.autoPrintPaymentReceiptOnPayment, false),
      autoPrintKitchenTicketOnOrder: toBoolean(parsed.autoPrintKitchenTicketOnOrder, false),
    };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function savePrinterSettings(settings: PrinterSettings) {
  localStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export function updatePrinterSettings(patch: Partial<PrinterSettings>) {
  const next = {
    ...getPrinterSettings(),
    ...patch,
  } satisfies PrinterSettings;
  return savePrinterSettings(next);
}
