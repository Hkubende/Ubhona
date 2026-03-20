import { formatPrintCurrency, type PrintableOrder } from "./print-types";

type CustomerReceiptProps = {
  restaurantName: string;
  order: PrintableOrder;
};

export function CustomerReceipt({ restaurantName, order }: CustomerReceiptProps) {
  return (
    <section className="print-document print-customer-receipt" data-print-root="true">
      <header className="print-header">
        <h1 className="print-title">{restaurantName}</h1>
        <p className="print-label">CUSTOMER RECEIPT</p>
      </header>

      <div className="print-meta">
        <p>Order: {order.id}</p>
        <p>{new Date(order.createdAt).toLocaleString("en-KE")}</p>
        <p>Customer: {order.customerName || "Guest"}</p>
      </div>

      <hr className="print-divider" />

      <div className="print-items">
        {order.items.map((item) => (
          <article key={`${order.id}-${item.dishId}`} className="print-line-item">
            <div className="print-line-main">
              <span>{item.name}</span>
              <span>{formatPrintCurrency(item.totalPrice)}</span>
            </div>
            <div className="print-line-sub">
              <span>{item.quantity} x {formatPrintCurrency(item.unitPrice)}</span>
            </div>
          </article>
        ))}
      </div>

      <hr className="print-divider" />

      <div className="print-totals">
        <p>
          <span>Subtotal</span>
          <span>{formatPrintCurrency(order.subtotal)}</span>
        </p>
        <p className="print-total-row">
          <span>Total</span>
          <span>{formatPrintCurrency(order.total)}</span>
        </p>
      </div>

      <hr className="print-divider" />
      <p className="print-footer">Thank you for your order</p>
      <p className="print-footer">Powered by Ubhona</p>
    </section>
  );
}
