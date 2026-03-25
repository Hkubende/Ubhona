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
import { CheckoutSuccessPage } from "../../components/storefront/checkout-components";

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const { slug = "", orderId: orderIdParam = "" } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = orderIdParam || searchParams.get("orderId") || "";
  const trackingToken = searchParams.get("trackingToken") || "";
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
    if (typeof window !== "undefined") {
      const alreadyPrinted = sessionStorage.getItem(`ubhona:auto_printed_order:${order.id}`);
      if (alreadyPrinted) return;
    }
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
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`ubhona:auto_printed_order:${order.id}`, "1");
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

  return (
    <CheckoutSuccessPage
      slug={slug}
      restaurant={restaurant}
      orderReference={order.id}
      orderStatus={order.status}
      paymentMethodLabel={getPaymentMethodLabel(order.paymentMethod)}
      paymentStatus={order.paymentStatus}
      paymentReference={order.paymentReference}
      createdAt={order.createdAt}
      customerName={order.customerName}
      customerPhone={order.customerPhone}
      tableNumber={order.tableNumber}
      customerNotes={order.customerNotes}
      total={order.total}
      items={order.items}
      onPrimary={() =>
        navigate(
          trackingToken
            ? `/order/${encodeURIComponent(order.id)}?token=${encodeURIComponent(trackingToken)}`
            : `/r/${slug}`
        )
      }
      onSecondary={() => navigate(`/r/${slug}/menu`)}
      onPrintPayment={() => {
        void printPaymentReceiptService(toPrintOrder(order, restaurant.name));
      }}
    />
  );
}
