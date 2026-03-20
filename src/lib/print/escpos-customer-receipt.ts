import type { PaperWidth, PrintOrder } from "./models";
import { formatCustomerReceipt } from "./format-customer-receipt";

export function buildEscPosCustomerReceipt(order: PrintOrder, paperWidth: PaperWidth) {
  const formatted = formatCustomerReceipt(order, paperWidth);
  return ["[INIT]", "[ALIGN:CENTER]", ...formatted.lines, "[CUT]"];
}
