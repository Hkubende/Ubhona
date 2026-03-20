import { formatPrintCurrency, type PrintableOrder } from "./print-types";

type PaymentReceiptProps = {
  restaurantName: string;
  order: PrintableOrder;
  paymentMethod?: string;
  paymentStatus?: string;
  transactionId?: string;
};

export function PaymentReceipt({
  restaurantName,
  order,
  paymentMethod,
  paymentStatus,
  transactionId,
}: PaymentReceiptProps) {
  return (
    <section className="print-document print-payment-receipt" data-print-root="true">
      <header className="print-header">
        <h1 className="print-title">{restaurantName}</h1>
        <p className="print-label">PAYMENT RECEIPT</p>
      </header>

      <div className="print-meta">
        <p>Order: {order.id}</p>
        <p>Status: {(paymentStatus || "paid").toUpperCase()}</p>
        {paymentMethod ? <p>Method: {paymentMethod}</p> : null}
        {transactionId ? <p>Txn: {transactionId}</p> : null}
        <p>{new Date(order.createdAt).toLocaleString("en-KE")}</p>
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
        <p>
          <span>Total</span>
          <span>{formatPrintCurrency(order.total)}</span>
        </p>
        <p className="print-total-row">
          <span>Paid</span>
          <span>{formatPrintCurrency(order.total)}</span>
        </p>
      </div>

      <hr className="print-divider" />
      <p className="print-footer">Payment received</p>
      <p className="print-footer">Thank you</p>
    </section>
  );
}
