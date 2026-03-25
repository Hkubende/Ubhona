import * as React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { OrderPaymentMethod } from "../../lib/orders";
import {
  getRestaurantBySlug,
  getRestaurantDishesBySlug,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import {
  clearStorefrontCart,
  loadStorefrontCart,
  saveStorefrontCart,
  setStorefrontCartItemQuantity,
  storefrontCartCount,
  storefrontCartTotal,
  type StorefrontCart,
} from "../../lib/storefront-cart";
import { trackAnalyticsEvent } from "../../lib/analytics";
import { getStorefrontPaymentMethods, type StorefrontPaymentMethod } from "../../lib/storefront-payments";
import { Button } from "../../components/ui/Button";
import {
  CartCheckoutTopBar,
  CartItemsCard,
  CheckoutActionCard,
  MobileStickyCheckoutBar,
  OrderDetailsCard,
  OrderSummaryCard,
  PaymentMethodCard,
  type CheckoutOrderMode,
} from "../../components/storefront/checkout-components";
import { tokens } from "../../design-system";
import { cn } from "../../lib/utils";
import { placeStorefrontOrderWorkflow } from "../../services";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug = "" } = useParams();
  const branchId = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("branch")?.trim() || "main";
  }, [location.search]);
  const skipNextPersistRef = React.useRef(true);

  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [cart, setCart] = React.useState<StorefrontCart>({});
  const [loadError, setLoadError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [formErrors, setFormErrors] = React.useState<{ name?: string; phone?: string }>({});

  const [orderMode, setOrderMode] = React.useState<CheckoutOrderMode>("dine_in");
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [whatsappOptIn, setWhatsappOptIn] = React.useState(false);
  const [whatsappNumber, setWhatsappNumber] = React.useState("");
  const [tableNumber, setTableNumber] = React.useState("");
  const [customerNotes, setCustomerNotes] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<OrderPaymentMethod>("manual_mpesa");
  const [manualPaymentReference, setManualPaymentReference] = React.useState("");
  const [paymentNotice, setPaymentNotice] = React.useState("");
  const [placingOrder, setPlacingOrder] = React.useState(false);

  const paymentMethods = React.useMemo(() => {
    const methods = getStorefrontPaymentMethods();
    return methods.map((method) => ({
      ...method,
      label: method.id === "stk_push" ? "M-Pesa (STK Push)" : "Manual / Pay Later",
      description:
        method.id === "stk_push"
          ? "You will receive an M-Pesa prompt after confirming your order."
          : "Confirm order first. Payment can be completed and verified manually.",
    }));
  }, []);

  React.useEffect(() => {
    skipNextPersistRef.current = true;
    setCart({});
    Promise.all([getRestaurantBySlug(slug), getRestaurantDishesBySlug(slug, { branchId })])
      .then(([restaurantData, dishData]) => {
        setRestaurant(restaurantData);
        setDishes(dishData);
        setCart(loadStorefrontCart({ slug, restaurantId: restaurantData.id }));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load checkout."));
  }, [branchId, slug]);

  React.useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (!restaurant) return;
    saveStorefrontCart({ slug, restaurantId: restaurant.id }, cart);
  }, [cart, slug, restaurant]);

  const lines = React.useMemo(() => {
    return Object.entries(cart)
      .map(([dishId, qty]) => {
        const dish = dishes.find((item) => item.id === dishId);
        if (!dish || qty <= 0) return null;
        return { dish, qty, subtotal: qty * dish.price };
      })
      .filter(Boolean) as Array<{ dish: PublicDish; qty: number; subtotal: number }>;
  }, [cart, dishes]);

  const itemCount = React.useMemo(() => storefrontCartCount(cart), [cart]);
  const subtotal = React.useMemo(() => {
    const priceByDishId = Object.fromEntries(dishes.map((dish) => [dish.id, dish.price]));
    return storefrontCartTotal(cart, priceByDishId);
  }, [cart, dishes]);
  const serviceFee = 0;
  const total = subtotal + serviceFee;

  React.useEffect(() => {
    if (!restaurant) return;
    const key = `mv_analytics_seen_${restaurant.id}_${slug}_page_view_checkout`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackAnalyticsEvent({
      restaurantId: restaurant.id,
      eventType: "page_view",
      source: "storefront_checkout",
      metadata: { slug },
    });
  }, [restaurant, slug]);

  React.useEffect(() => {
    if (!restaurant || lines.length === 0) return;
    const key = `mv_analytics_seen_${restaurant.id}_${slug}_checkout_start`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackAnalyticsEvent({
      restaurantId: restaurant.id,
      eventType: "checkout_start",
      source: "storefront_checkout",
      metadata: {
        slug,
        items: lines.length,
        total,
      },
    });
  }, [restaurant, lines.length, slug, total]);

  const updateQty = React.useCallback((dishId: string, qty: number) => {
    setCart((prev) => setStorefrontCartItemQuantity(prev, dishId, qty));
  }, []);

  const placeOrder = React.useCallback(async () => {
    if (!restaurant || !lines.length) return;
    setActionError("");
    setPaymentNotice("");
    setPlacingOrder(true);
    try {
      const name = customerName.trim();
      const phone = customerPhone.trim();
      const waNumber = whatsappNumber.trim();
      const table = tableNumber.trim();
      const notes = customerNotes.trim();
      const nextFormErrors: { name?: string; phone?: string } = {};
      if (!name) nextFormErrors.name = "Customer name is required.";
      if (!phone) nextFormErrors.phone = "Customer phone is required.";
      setFormErrors(nextFormErrors);
      if (nextFormErrors.name || nextFormErrors.phone) {
        throw new Error("Enter required customer details before confirming order.");
      }

      const normalizedOrderNote = [notes, orderMode !== "dine_in" ? `Service Mode: ${orderMode}` : ""]
        .filter(Boolean)
        .join(" | ");

      const { orderId, paymentShell, trackingToken } = await placeStorefrontOrderWorkflow({
        restaurant: { id: restaurant.id, name: restaurant.name, slug },
        payload: {
          restaurantId: restaurant.id,
          branchId,
          restaurantSlug: slug,
          customerName: name,
          customerPhone: phone,
          whatsappOptIn,
          whatsappNumber: whatsappOptIn ? waNumber || phone : undefined,
          tableNumber: orderMode === "dine_in" ? table || undefined : undefined,
          customerNotes: normalizedOrderNote || undefined,
          createdAt: new Date().toISOString(),
          status: "pending",
          paymentMethod,
          paymentReference: paymentMethod === "manual_mpesa" ? manualPaymentReference.trim() || undefined : undefined,
          paymentStatus: "payment_shell_pending",
          items: lines.map((line) => ({
            dishId: line.dish.id,
            quantity: line.qty,
          })),
          itemSnapshots: lines.map((line) => ({
            dishId: line.dish.id,
            name: line.dish.name,
            quantity: line.qty,
            unitPrice: line.dish.price,
            subtotal: line.subtotal,
          })),
          subtotalAmount: subtotal,
          totalAmount: total,
        },
        paymentMethod: paymentMethod as StorefrontPaymentMethod,
        analyticsSource: "storefront_checkout",
        analyticsMetadata: {
          slug,
          total,
          checkoutMode: "mvp_no_payment",
          paymentMethod,
          orderMode,
          whatsappOptIn,
          whatsappNumberPresent: Boolean(waNumber || phone),
          tableNumber: orderMode === "dine_in" ? table || null : null,
          notesProvided: notes.length > 0,
        },
      });

      setPaymentNotice(`${paymentShell.title}: ${paymentShell.message}`);
      clearStorefrontCart({ slug, restaurantId: restaurant.id });
      setCart({});
      const confirmationQuery = new URLSearchParams();
      confirmationQuery.set("orderId", orderId);
      if (trackingToken) confirmationQuery.set("trackingToken", trackingToken);
      navigate(`/r/${slug}/confirmation?${confirmationQuery.toString()}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setPlacingOrder(false);
    }
  }, [
    restaurant,
    lines,
    customerName,
    customerPhone,
    whatsappOptIn,
    whatsappNumber,
    tableNumber,
    customerNotes,
    orderMode,
    paymentMethod,
    manualPaymentReference,
    slug,
    branchId,
    subtotal,
    total,
    navigate,
  ]);

  if (loadError) {
    const notFound = /not found/i.test(loadError);
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center">
          <div className="text-2xl font-semibold tracking-[-0.03em] text-orange-300">
            {notFound ? "Restaurant not found" : "Checkout unavailable"}
          </div>
          <p className="mt-2 text-sm text-white/65">
            {notFound ? "Check the storefront link and try again." : loadError}
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return <div className="ubhona-storefront-shell min-h-screen p-8 text-white/70">Loading checkout...</div>;
  }

  return (
    <div className={cn(tokens.classes.storefrontShell, "pb-32 lg:pb-8")}>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <CartCheckoutTopBar slug={slug} itemCount={itemCount} />
        <div className="grid gap-4 lg:grid-cols-[58fr_42fr]">
          <div className="space-y-4">
            <CartItemsCard
              lines={lines}
              onIncrease={(dishId) => {
                const line = lines.find((row) => row.dish.id === dishId);
                updateQty(dishId, (line?.qty || 0) + 1);
              }}
              onDecrease={(dishId) => {
                const line = lines.find((row) => row.dish.id === dishId);
                updateQty(dishId, Math.max(0, (line?.qty || 1) - 1));
              }}
              onRemove={(dishId) => updateQty(dishId, 0)}
            />
            <OrderDetailsCard
              orderMode={orderMode}
              onOrderModeChange={setOrderMode}
              customerName={customerName}
              onCustomerNameChange={(value) => {
                setCustomerName(value);
                setFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              customerPhone={customerPhone}
              onCustomerPhoneChange={(value) => {
                setCustomerPhone(value);
                setFormErrors((prev) => ({ ...prev, phone: undefined }));
                if (!whatsappNumber) setWhatsappNumber(value);
              }}
              whatsappOptIn={whatsappOptIn}
              onWhatsappOptInChange={setWhatsappOptIn}
              whatsappNumber={whatsappNumber}
              onWhatsappNumberChange={setWhatsappNumber}
              tableNumber={tableNumber}
              onTableNumberChange={setTableNumber}
              orderNote={customerNotes}
              onOrderNoteChange={setCustomerNotes}
              errors={formErrors}
            />
          </div>
          <div className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
            <OrderSummaryCard itemCount={itemCount} subtotal={subtotal} serviceFee={serviceFee} total={total} />
            <PaymentMethodCard
              methods={paymentMethods}
              selectedMethod={paymentMethod as StorefrontPaymentMethod}
              onMethodChange={(id) => setPaymentMethod(id)}
              manualReference={manualPaymentReference}
              onManualReferenceChange={setManualPaymentReference}
            />
            <CheckoutActionCard
              method={paymentMethod as StorefrontPaymentMethod}
              isPlacing={placingOrder}
              disabled={!lines.length || placingOrder}
              paymentNotice={paymentNotice}
              actionError={actionError}
              onPlaceOrder={() => void placeOrder()}
            />
            {actionError && /orders\/month|upgrade/i.test(actionError) ? (
              <Link to="/pricing">
                <Button variant="secondary" className="w-full">Upgrade Plan</Button>
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#B8AEA3]/75">
          Powered by Ubhona
        </div>
      </div>
      <MobileStickyCheckoutBar
        total={total}
        itemCount={itemCount}
        method={paymentMethod as StorefrontPaymentMethod}
        isPlacing={placingOrder}
        disabled={!lines.length || placingOrder}
        onPlaceOrder={() => void placeOrder()}
      />
    </div>
  );
}
