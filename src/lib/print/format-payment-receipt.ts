import type { FormattedPrintDocument, PaperWidth, PrintOrder } from "./models";
import { center, charsForPaperWidth, divider, money, twoColumn } from "./text-layout";

export function formatPaymentReceipt(order: PrintOrder, paperWidth: PaperWidth): FormattedPrintDocument {
  const width = charsForPaperWidth(paperWidth);
  const lines: string[] = [];
  const payment = order.payment;

  lines.push(center(order.restaurant.name.toUpperCase(), width));
  lines.push(center("PAYMENT RECEIPT", width));
  lines.push(divider(width));
  lines.push(`Order: ${order.id}`);
  lines.push(`Status: ${(payment?.status || "paid").toUpperCase()}`);
  if (payment?.method) lines.push(`Method: ${payment.method}`);
  if (payment?.transactionId) lines.push(`Txn: ${payment.transactionId}`);
  lines.push(`Date: ${new Date(order.createdAt).toLocaleString("en-KE")}`);
  if (order.takenByWaiterName) lines.push(`Taken by: ${order.takenByWaiterName}`);
  lines.push(divider(width));

  for (const item of order.items) {
    const lineTotal = typeof item.totalPrice === "number" ? item.totalPrice : (item.unitPrice || 0) * item.quantity;
    lines.push(twoColumn(`${item.quantity} x ${item.name}`, money(lineTotal), width));
  }

  lines.push(divider(width));
  lines.push(twoColumn("Subtotal", money(order.subtotal), width));
  lines.push(twoColumn("Total", money(order.total), width));
  lines.push(twoColumn("Paid", money(payment?.paidAmount ?? order.total), width));
  if (typeof payment?.changeAmount === "number") {
    lines.push(twoColumn("Change", money(payment.changeAmount), width));
  }
  lines.push(divider(width));
  lines.push(center("Payment received", width));
  lines.push(center("Thank you", width));

  return {
    title: `Payment Receipt ${order.id}`,
    lines,
    paperWidth,
  };
}

