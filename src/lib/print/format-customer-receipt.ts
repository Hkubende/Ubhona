import type { FormattedPrintDocument, PaperWidth, PrintOrder } from "./models";
import { center, charsForPaperWidth, divider, money, twoColumn } from "./text-layout";

export function formatCustomerReceipt(order: PrintOrder, paperWidth: PaperWidth): FormattedPrintDocument {
  const width = charsForPaperWidth(paperWidth);
  const lines: string[] = [];

  lines.push(center(order.restaurant.name.toUpperCase(), width));
  lines.push(center("CUSTOMER RECEIPT", width));
  lines.push(divider(width));
  lines.push(`Order: ${order.id}`);
  lines.push(`Date: ${new Date(order.createdAt).toLocaleString("en-KE")}`);
  if (order.customerName) lines.push(`Customer: ${order.customerName}`);
  if (order.takenByWaiterName) lines.push(`Taken by: ${order.takenByWaiterName}`);
  lines.push(divider(width));

  for (const item of order.items) {
    const lineTotal = typeof item.totalPrice === "number" ? item.totalPrice : (item.unitPrice || 0) * item.quantity;
    lines.push(twoColumn(`${item.quantity} x ${item.name}`, money(lineTotal), width));
    if (typeof item.unitPrice === "number") {
      lines.push(`  @ ${money(item.unitPrice)}`);
    }
  }

  lines.push(divider(width));
  lines.push(twoColumn("Subtotal", money(order.subtotal), width));
  lines.push(twoColumn("Total", money(order.total), width));
  lines.push(divider(width));
  lines.push(center("Thank you for your order", width));
  lines.push(center(order.restaurant.footerText || "Powered by Ubhona", width));

  return {
    title: `Receipt ${order.id}`,
    lines,
    paperWidth,
  };
}

