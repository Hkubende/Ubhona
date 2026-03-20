import { formatPrintCurrency, type PrintableOrder } from "./print-types";

type KitchenTicketProps = {
  restaurantName: string;
  order: PrintableOrder;
};

export function KitchenTicket({ restaurantName, order }: KitchenTicketProps) {
  return (
    <section className="print-document print-kitchen-ticket" data-print-root="true">
      <header className="print-header">
        <h1 className="print-title">{restaurantName}</h1>
        <p className="print-label">KITCHEN TICKET</p>
      </header>

      <div className="print-meta">
        <p>Order: {order.id}</p>
        <p>{new Date(order.createdAt).toLocaleString("en-KE")}</p>
        <p>Customer: {order.customerName || "Guest"}</p>
        {order.tableNumber ? <p>Table: {order.tableNumber}</p> : null}
        {order.customerNotes ? <p>Notes: {order.customerNotes}</p> : null}
      </div>

      <hr className="print-divider" />

      <div className="print-items">
        {order.items.map((item) => (
          <article key={`${order.id}-${item.dishId}`} className="print-ticket-item">
            <div className="print-ticket-item-top">
              <span className="print-ticket-qty">x{item.quantity}</span>
              <span className="print-ticket-name">{item.name}</span>
            </div>
            <p className="print-ticket-sub">{formatPrintCurrency(item.totalPrice)}</p>
            {item.notes ? <p className="print-ticket-note">{item.notes}</p> : null}
          </article>
        ))}
      </div>

      <hr className="print-divider" />
      <p className="print-footer">--- END ---</p>
    </section>
  );
}
