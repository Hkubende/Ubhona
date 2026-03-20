import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createStorefrontOrder, type OrderPaymentMethod } from "../../lib/orders";
import {
  getRestaurantBySlug,
  getRestaurantDishesBySlug,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import {
  clearStorefrontCart,
  loadStorefrontCart,
  removeStorefrontCartItem,
  saveStorefrontCart,
  setStorefrontCartItemQuantity,
  storefrontCartTotal,
  type StorefrontCart,
} from "../../lib/storefront-cart";
import { trackAnalyticsEvent } from "../../lib/analytics";
import {
  getStorefrontPaymentMethods,
  initializeStorefrontPaymentShell,
} from "../../lib/storefront-payments";
import { BackButton } from "../../components/ui/back-button";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const skipNextPersistRef = React.useRef(true);
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [cart, setCart] = React.useState<StorefrontCart>({});
  const [loadError, setLoadError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [formErrors, setFormErrors] = React.useState<{ name?: string; phone?: string }>({});
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [tableNumber, setTableNumber] = React.useState("");
  const [customerNotes, setCustomerNotes] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<OrderPaymentMethod>("manual_mpesa");
  const [manualPaymentReference, setManualPaymentReference] = React.useState("");
  const [paymentNotice, setPaymentNotice] = React.useState("");
  const [placingOrder, setPlacingOrder] = React.useState(false);
  const paymentMethods = React.useMemo(() => getStorefrontPaymentMethods(), []);

  React.useEffect(() => {
    skipNextPersistRef.current = true;
    setCart({});
    Promise.all([getRestaurantBySlug(slug), getRestaurantDishesBySlug(slug)])
      .then(([restaurantData, dishData]) => {
        setRestaurant(restaurantData);
        setDishes(dishData);
        setCart(loadStorefrontCart({ slug, restaurantId: restaurantData.id }));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load checkout."));
  }, [slug]);

  React.useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (!restaurant) return;
    saveStorefrontCart({ slug, restaurantId: restaurant.id }, cart);
  }, [cart, slug, restaurant]);

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

  const lines = React.useMemo(() => {
    return Object.entries(cart)
      .map(([dishId, qty]) => {
        const dish = dishes.find((item) => item.id === dishId);
        if (!dish || qty <= 0) return null;
        return {
          dish,
          qty,
          subtotal: qty * dish.price,
        };
      })
      .filter(Boolean) as Array<{ dish: PublicDish; qty: number; subtotal: number }>;
  }, [cart, dishes]);

  const total = React.useMemo(() => {
    const priceByDishId = Object.fromEntries(dishes.map((dish) => [dish.id, dish.price]));
    return storefrontCartTotal(cart, priceByDishId);
  }, [cart, dishes]);
  const primary = restaurant?.themePrimary || "#E4572E";

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

  const placeOrder = async () => {
    if (!restaurant || !lines.length) return;
    setActionError("");
    setPaymentNotice("");
    setPlacingOrder(true);
    try {
      const name = customerName.trim();
      const phone = customerPhone.trim();
      const table = tableNumber.trim();
      const notes = customerNotes.trim();
      const nextFormErrors: { name?: string; phone?: string } = {};
      if (!name) nextFormErrors.name = "Customer name is required.";
      if (!phone) nextFormErrors.phone = "Customer phone is required.";
      setFormErrors(nextFormErrors);
      if (nextFormErrors.name || nextFormErrors.phone) {
        throw new Error("Enter required customer details before placing order.");
      }

      const orderId = await createStorefrontOrder({
        restaurantId: restaurant.id,
        restaurantSlug: slug,
        customerName: name,
        customerPhone: phone,
        tableNumber: table || undefined,
        customerNotes: notes || undefined,
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
        subtotalAmount: total,
        totalAmount: total,
      });

      const paymentShell = initializeStorefrontPaymentShell({
        orderId,
        restaurantId: restaurant.id,
        method: paymentMethod,
        customerPhone: phone,
      });
      setPaymentNotice(`${paymentShell.title}: ${paymentShell.message}`);

      void trackAnalyticsEvent({
        restaurantId: restaurant.id,
        eventType: "order_placed",
        orderId,
        source: "storefront_checkout",
        metadata: {
          slug,
          total,
          checkoutMode: "mvp_no_payment",
          paymentMethod,
          paymentStatus: paymentShell.paymentStatus,
          paymentReference: paymentShell.paymentReference,
          tableNumber: table || null,
          notesProvided: notes.length > 0,
          items: lines.map((line) => ({
            dishId: line.dish.id,
            name: line.dish.name,
            quantity: line.qty,
            unitPrice: line.dish.price,
            subtotal: line.subtotal,
            })),
        },
      });
      clearStorefrontCart({ slug, restaurantId: restaurant.id });
      setCart({});
      navigate(`/r/${slug}/confirmation?orderId=${encodeURIComponent(orderId)}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setPlacingOrder(false);
    }
  };

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
  if (!restaurant) return <div className="ubhona-storefront-shell min-h-screen p-8 text-white/70">Loading checkout...</div>;

  return (
    <div className={tokens.classes.storefrontShell}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-3">
          <BackButton label="Back to Menu" fallbackHref={`/r/${slug}/menu`} />
        </div>
        <div className={cn(tokens.classes.storefrontPanel, "mb-6 p-4")}>
          <div className="text-2xl font-semibold tracking-[-0.04em]" style={{ color: primary }}>
            {restaurant.name} Checkout
          </div>
          <div className="mt-1 text-sm text-white/62">Review your cart and place your order.</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className={cn(tokens.classes.storefrontPanel, "p-4")}>
            <div className="mb-3 text-sm font-semibold text-white/80">
              Order Summary ({lines.length} {lines.length === 1 ? "item" : "items"})
            </div>
            {lines.length === 0 ? (
              <div className="text-sm text-white/60">Your cart is empty.</div>
            ) : (
              lines.map((line) => (
                <div key={line.dish.id} className={cn(tokens.classes.previewFrame, "mb-3 p-3")}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{line.dish.name}</div>
                      <div className="text-xs text-white/55">{formatKsh(line.dish.price)} each</div>
                    </div>
                    <div className="text-orange-300">{formatKsh(line.subtotal)}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() =>
                        setCart((prev) => setStorefrontCartItemQuantity(prev, line.dish.id, line.qty - 1))
                      }
                      variant="secondary"
                      size="sm"
                    >
                      -
                    </Button>
                    <span className="text-sm">{line.qty}</span>
                    <Button
                      onClick={() =>
                        setCart((prev) => setStorefrontCartItemQuantity(prev, line.dish.id, line.qty + 1))
                      }
                      variant="secondary"
                      size="sm"
                    >
                      +
                    </Button>
                    <Button
                      onClick={() => setCart((prev) => removeStorefrontCartItem(prev, line.dish.id))}
                      variant="danger"
                      size="sm"
                      className="ml-auto min-w-[88px]"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className={cn(tokens.classes.storefrontPanel, "p-4 lg:sticky lg:top-6 lg:h-fit")}>
            <div className="text-sm text-white/60">Total</div>
            <div className="text-3xl font-semibold tracking-[-0.04em] text-orange-300">{formatKsh(total)}</div>
            <div className="mt-4 space-y-2">
              <label htmlFor="storefront-customer-name" className={cn("block", typography.label)}>
                Customer Name
              </label>
              <Input
                id="storefront-customer-name"
                name="customerName"
                autoComplete="name"
                value={customerName}
                onChange={(event) => {
                  setCustomerName(event.target.value);
                  setFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Customer name"
              />
              {formErrors.name ? <div className="text-xs text-red-300">{formErrors.name}</div> : null}
              <label htmlFor="storefront-customer-phone" className={cn("block", typography.label)}>
                Customer Phone
              </label>
              <Input
                id="storefront-customer-phone"
                name="customerPhone"
                autoComplete="tel"
                value={customerPhone}
                onChange={(event) => {
                  setCustomerPhone(event.target.value);
                  setFormErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="Customer phone"
              />
              {formErrors.phone ? <div className="text-xs text-red-300">{formErrors.phone}</div> : null}
              <label htmlFor="storefront-table-number" className={cn("block", typography.label)}>
                Table Number
              </label>
              <Input
                id="storefront-table-number"
                name="tableNumber"
                autoComplete="off"
                value={tableNumber}
                onChange={(event) => setTableNumber(event.target.value)}
                placeholder="Table number (optional)"
              />
              <label htmlFor="storefront-customer-notes" className={cn("block", typography.label)}>
                Notes
              </label>
              <Textarea
                id="storefront-customer-notes"
                name="customerNotes"
                autoComplete="off"
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
                placeholder="Order notes (optional)"
                rows={3}
              />
            </div>
            <div className={cn(tokens.classes.previewFrame, "mt-4 p-3")}>
              <div className={cn("mb-2", typography.label)}>Payment Method</div>
              <div className="space-y-2">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`block rounded-xl border px-3 py-2 ${
                      paymentMethod === method.id
                        ? "border-[#E4572E]/45 bg-[#E4572E]/12"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === method.id}
                        onChange={() => setPaymentMethod(method.id)}
                        className="h-4 w-4 accent-[#E4572E]"
                      />
                      <span className="text-sm font-semibold text-[#FBF6EE]">{method.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/60">{method.description}</p>
                  </label>
                ))}
              </div>
              {paymentMethod === "manual_mpesa" ? (
                <div>
                  <label htmlFor="storefront-manual-payment-reference" className={cn("mt-2 block", typography.label)}>
                    Manual Payment Reference
                  </label>
                  <Input
                    id="storefront-manual-payment-reference"
                    name="manualPaymentReference"
                    autoComplete="off"
                    value={manualPaymentReference}
                    onChange={(event) => setManualPaymentReference(event.target.value)}
                    placeholder="Manual payment reference (optional)"
                    className="mt-1.5"
                  />
                </div>
              ) : null}
            </div>
            <div className={cn(tokens.classes.previewFrame, "mt-4 p-3 text-xs text-white/65")}>
              Payment provider calls are placeholders in this MVP. Orders are created first, then payment status is set
              for follow-up processing.
            </div>
            <Button
              onClick={() => void placeOrder()}
              disabled={!lines.length || placingOrder}
              variant="primary"
              size="lg"
              className="mt-4 w-full"
              style={{ backgroundColor: primary }}
            >
              {placingOrder ? "Placing Order..." : "Place Order"}
            </Button>
            {paymentNotice ? <div className="mt-2 text-xs text-emerald-200">{paymentNotice}</div> : null}
            {actionError ? <div className="mt-2 text-xs text-red-300">{actionError}</div> : null}
            <Button
              onClick={() => navigate(`/r/${slug}/menu`)}
              variant="secondary"
              size="lg"
              className="mt-2 w-full"
            >
              Back to Menu
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
