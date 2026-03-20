import type { PaperWidth, PrintOrder } from "./models";
import { formatPaymentReceipt } from "./format-payment-receipt";

export function buildEscPosPaymentReceipt(order: PrintOrder, paperWidth: PaperWidth) {
  const formatted = formatPaymentReceipt(order, paperWidth);
  return ["[INIT]", "[ALIGN:CENTER]", ...formatted.lines, "[CUT]"];
}
