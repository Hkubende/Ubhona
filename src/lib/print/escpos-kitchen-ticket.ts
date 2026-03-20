import type { PaperWidth, PrintOrder } from "./models";
import { formatKitchenTicket } from "./format-kitchen-ticket";

export function buildEscPosKitchenTicket(order: PrintOrder, paperWidth: PaperWidth) {
  const formatted = formatKitchenTicket(order, paperWidth);
  return ["[INIT]", "[ALIGN:CENTER]", ...formatted.lines, "[CUT]"];
}
