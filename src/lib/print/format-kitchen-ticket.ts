import type { FormattedPrintDocument, PaperWidth, PrintOrder } from "./models";
import { center, charsForPaperWidth, divider, twoColumn, wrapText } from "./text-layout";

export function formatKitchenTicket(order: PrintOrder, paperWidth: PaperWidth): FormattedPrintDocument {
  const width = charsForPaperWidth(paperWidth);
  const lines: string[] = [];

  lines.push(center(order.restaurant.name.toUpperCase(), width));
  lines.push(center("KITCHEN TICKET", width));
  lines.push(divider(width));
  lines.push(twoColumn(`Order ${order.id}`, new Date(order.createdAt).toLocaleTimeString("en-KE"), width));
  if (order.customerName) lines.push(`Customer: ${order.customerName}`);
  if (order.takenByWaiterName) lines.push(`Taken by: ${order.takenByWaiterName}`);
  if (order.tableNumber) lines.push(`Table: ${order.tableNumber}`);
  if (order.notes) lines.push(`Notes: ${order.notes}`);
  lines.push(divider(width));

  for (const item of order.items) {
    lines.push(`QTY ${String(item.quantity).padStart(2, " ")}  ${item.name.toUpperCase()}`);
    if (item.notes) {
      for (const wrapped of wrapText(`NOTE: ${item.notes}`, width)) {
        lines.push(wrapped);
      }
    }
    lines.push("");
  }

  lines.push(divider(width));
  lines.push(center("--- END ---", width));

  return {
    title: `Kitchen Ticket ${order.id}`,
    lines,
    paperWidth,
  };
}

