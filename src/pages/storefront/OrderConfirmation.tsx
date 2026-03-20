import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPaymentMethodLabel, getStorefrontOrder, type Order } from "../../lib/orders";
import { getRestaurantBySlug, type PublicRestaurant } from "../../lib/storefront";
import type { PrintOrder } from "../../lib/print";
import {
  getPrinterSettings,
  printKitchenTicket as printKitchenTicketService,
  printCustomerReceipt as printCustomerReceiptService,
  printPaymentReceipt as printPaymentReceiptService,
} from "../../lib/print";
import { BackButton } from "../../components/ui/back-button";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const { slug = "", orderId: orderIdParam = "" } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = orderIdParam || searchParams.get("orderId") || "";
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);

  const autoPrintedPaymentRef = React.useRef(false);
  const autoPrintedOrderRef = React.useRef(false);
  const toPrintOrder = React.useCallback(
    (currentOrder: Order, restaurantName: string): PrintOrder => ({
      id: currentOrder.id,
      restaurant: {
        name: restaurantName,
        footerText: "Powered by Ubhona",
      },
      createdAt: currentOrder.createdAt,
      customerName: currentOrder.customerName,
      customerPhone: currentOrder.customerPhone,
      takenByWaiterName: currentOrder.takenByWaiterName,
      tableNumber: currentOrder.tableNumber,
      notes: currentOrder.customerNotes,
      items: currentOrder.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.subtotal,
      })),
      subtotal: currentOrder.subtotal,
      total: currentOrder.total,
      payment: {
        status: currentOrder.paymentStatus,
        method: getPaymentMethodLabel(currentOrder.paymentMethod),
        transactionId: currentOrder.paymentReference,
        paidAmount: currentOrder.paymentStatus === "paid" ? currentOrder.total : undefined,
      },
    }),
    []
  );

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    getRestaurantBySlug(slug)
      .then(async (restaurantData) => {
        if (!mounted) return;
        setRestaurant(restaurantData);
        const fetchedOrder = await getStorefrontOrder(orderId, restaurantData.id);
        if (!mounted) return;
        setOrder(fetchedOrder);
      })
      .catch(() => {
        if (!mounted) return;
        setRestaurant(null);
        setOrder(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug, orderId]);

  React.useEffect(() => {
    if (!restaurant || !order) return;
    const settings = getPrinterSettings();
    if (settings.printMode !== "auto") return;
    if (autoPrintedOrderRef.current) return;
    autoPrintedOrderRef.current = true;
    if (settings.autoPrintKitchenTicketOnOrder) {
      void printKitchenTicketService(toPrintOrder(order, restaurant.name), { trigger: "auto" });
    }
    if (settings.autoPrintCustomerReceiptOnOrder) {
      void printCustomerReceiptService(toPrintOrder(order, restaurant.name), { trigger: "auto" });
    }
  }, [order, restaurant, toPrintOrder]);

  React.useEffect(() => {
    if (!restaurant || !order) return;
    const settings = getPrinterSettings();
    if (settings.printMode !== "auto") return;
    if (!settings.autoPrintPaymentReceiptOnPayment) return;
    if (autoPrintedPaymentRef.current) return;
    if (String(order.paymentStatus || "").toLowerCase() !== "paid") return;
    autoPrintedPaymentRef.current = true;
    void printPaymentReceiptService(toPrintOrder(order, restaurant.name), { trigger: "auto" });
  }, [order, restaurant, toPrintOrder]);

  if (loading) return <div className="ubhona-storefront-shell min-h-screen p-8 text-white/70">Loading order...</div>;
  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center">
          <div className="text-2xl font-semibold tracking-[-0.03em] text-orange-300">Restaurant not found</div>
          <p className="mt-2 text-sm text-white/65">Check the storefront link and try again.</p>
        </div>
      </div>
    );
  }
  if (!order) return <div className="ubhona-storefront-shell min-h-screen p-8 text-white/70">Order not found.</div>;

  const primary = restaurant.themePrimary || "#E4572E";
  const printReceipt = () => {
    void printCustomerReceiptService(toPrintOrder(order, restaurant.name));
  };
  const handlePrintPaymentReceipt = () => {
    void printPaymentReceiptService(toPrintOrder(order, restaurant.name));
  };

  return (
    <div className={tokens.classes.storefrontShell}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className={cn(tokens.classes.storefrontPanel, "p-6")}>
          <div className={typography.label}>Order Confirmed</div>
          <div className="text-2xl font-semibold tracking-[-0.04em]" style={{ color: primary }}>
            Reference: {order.id}
          </div>
          <div className="mt-1 text-sm text-white/60">
            Status: <span className="font-semibold text-amber-300">{order.status}</span>
          </div>
          <div className="mt-1 text-sm text-white/60">
            Payment:{" "}
            <span className="font-semibold text-cyan-200">
              {getPaymentMethodLabel(order.paymentMethod)} - {order.paymentStatus}
            </span>
          </div>
          <div className="mt-1 text-sm text-white/60">Payment Ref: {order.paymentReference || "Pending"}</div>
          <div className="mt-1 text-sm text-white/60">
            Submitted: {new Date(order.createdAt).toLocaleString("en-KE")}
          </div>
          {order.customerName ? <div className="mt-1 text-sm text-white/60">Customer: {order.customerName}</div> : null}
          {order.customerPhone ? <div className="mt-1 text-sm text-white/60">Phone: {order.customerPhone}</div> : null}
          {order.tableNumber ? <div className="mt-1 text-sm text-white/60">Table: {order.tableNumber}</div> : null}
          {order.customerNotes ? <div className="mt-1 text-sm text-white/60">Notes: {order.customerNotes}</div> : null}

          <div id="receipt-content" className={cn(tokens.classes.previewFrame, "mt-4 p-4")}>
            <div className="mb-2 text-sm font-semibold text-white/80">Order Summary</div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={`${order.id}-${item.dishId}`} className="flex items-center justify-between text-sm">
                  <div>
                    {item.quantity} x {item.name}
                  </div>
                  <div className="text-orange-300">{formatKsh(item.subtotal)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-white/70">
              <span>Subtotal</span>
              <span>{formatKsh(order.subtotal)}</span>
            </div>
            <div className="mt-4 text-lg font-semibold">{formatKsh(order.total)}</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => navigate(`/r/${slug}`)}
              variant="primary"
              size="lg"
            >
              Done
            </Button>
            <Button
              onClick={printReceipt}
              variant="secondary"
              size="lg"
            >
              Print Receipt
            </Button>
            <Button
              onClick={handlePrintPaymentReceipt}
              variant="secondary"
              size="lg"
            >
              Print Payment Receipt
            </Button>
            <BackButton
              label="Back to Menu"
              fallbackHref={`/r/${slug}/menu`}
              className="border-white/15 bg-white/[0.06] hover:bg-white/[0.12]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
