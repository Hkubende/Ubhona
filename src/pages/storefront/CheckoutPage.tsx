import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createStorefrontOrder, getStorefrontOrder } from "../../lib/orders";
import { getPaymentStatus, requestStkPush } from "../../lib/payments";
import {
  getRestaurantBySlug,
  getRestaurantDishesBySlug,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import { trackAnalyticsEvent } from "../../lib/analytics";

type StorefrontCart = Record<string, number>;

function cartKey(slug: string) {
  return `mv_storefront_cart_${slug}_v1`;
}

function loadCart(slug: string): StorefrontCart {
  try {
    const parsed = JSON.parse(localStorage.getItem(cartKey(slug)) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StorefrontCart;
  } catch {
    return {};
  }
}

function saveCart(slug: string, cart: StorefrontCart) {
  localStorage.setItem(cartKey(slug), JSON.stringify(cart));
}

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [cart, setCart] = React.useState<StorefrontCart>({});
  const [loadError, setLoadError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [placingOrder, setPlacingOrder] = React.useState(false);
  const [sendingStk, setSendingStk] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [activeOrderId, setActiveOrderId] = React.useState("");
  const [paymentStatus, setPaymentStatus] = React.useState("");

  React.useEffect(() => {
    setCart(loadCart(slug));
    Promise.all([getRestaurantBySlug(slug), getRestaurantDishesBySlug(slug)])
      .then(([restaurantData, dishData]) => {
        setRestaurant(restaurantData);
        setDishes(dishData);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load checkout."));
  }, [slug]);

  React.useEffect(() => {
    saveCart(slug, cart);
  }, [cart, slug]);

  React.useEffect(() => {
    if (!activeOrderId || !restaurant) return;
    const timer = window.setInterval(() => {
      void getPaymentStatus(activeOrderId, restaurant.id)
        .then((status) => {
          const nextStatus = status.paymentStatus || "unpaid";
          setPaymentStatus(nextStatus);
          if (nextStatus === "paid") {
            setStatusMessage("Payment received successfully.");
          } else if (nextStatus === "failed") {
            setStatusMessage("Payment failed. You can retry STK.");
          }
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeOrderId, restaurant]);

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

  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const primary = restaurant?.themePrimary || "#f97316";

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

  const createOrder = async () => {
    if (!lines.length || !restaurant) return;
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name) {
      throw new Error("Enter customer name before placing order.");
    }
    if (!phone) {
      throw new Error("Enter customer phone before placing order.");
    }
    const orderId = await createStorefrontOrder({
      restaurantId: restaurant.id,
      customerName: name,
      customerPhone: phone,
      items: lines.map((line) => ({
        dishId: line.dish.id,
        quantity: line.qty,
      })),
    });
    saveCart(slug, {});
    setCart({});
    setActiveOrderId(orderId);
    return orderId;
  };

  const placeOrder = async () => {
    setActionError("");
    setStatusMessage("");
    setPlacingOrder(true);
    try {
      const orderId = await createOrder();
      if (!orderId) {
        throw new Error("Failed to create order.");
      }
      navigate(`/r/${slug}/order/${encodeURIComponent(orderId)}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const payViaStk = async () => {
    if (!restaurant) return;
    let orderIdForError = activeOrderId;
    setActionError("");
    setSendingStk(true);
    setStatusMessage("Sending payment request...");
    try {
      let orderId: string | undefined = activeOrderId;
      if (!orderId) {
        orderId = await createOrder();
      }
      orderIdForError = orderId || "";
      if (!orderId) {
        throw new Error("Failed to create order.");
      }
      const response = await requestStkPush({
        orderId,
        phone: customerPhone.trim(),
        restaurantId: restaurant.id,
      });
      if (!response?.ok) {
        void trackAnalyticsEvent({
          restaurantId: restaurant.id,
          eventType: "payment_failed",
          orderId,
          source: "storefront_checkout",
        });
        throw new Error("STK push request failed.");
      }
      setStatusMessage("Payment prompt sent. Please check your phone.");
      const refreshed = await getPaymentStatus(orderId, restaurant.id);
      setPaymentStatus(refreshed.paymentStatus || "processing");
    } catch (err) {
      setStatusMessage("Payment request failed.");
      if (restaurant && orderIdForError) {
        void trackAnalyticsEvent({
          restaurantId: restaurant.id,
          eventType: "payment_failed",
          orderId: orderIdForError,
          source: "storefront_checkout",
        });
      }
      setActionError(err instanceof Error ? err.message : "Failed to request STK push.");
    } finally {
      setSendingStk(false);
    }
  };

  if (loadError) {
    const notFound = /not found/i.test(loadError);
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-2xl font-black text-orange-300">
            {notFound ? "Restaurant not found" : "Checkout unavailable"}
          </div>
          <p className="mt-2 text-sm text-white/65">
            {notFound ? "Check the storefront link and try again." : loadError}
          </p>
        </div>
      </div>
    );
  }
  if (!restaurant) return <div className="min-h-screen bg-[#0b0b10] p-8 text-white/70">Loading checkout...</div>;

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-white/10 bg-black/35 p-4">
          <div className="text-2xl font-black" style={{ color: primary }}>
            {restaurant.name} Checkout
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            {lines.length === 0 ? (
              <div className="text-sm text-white/60">Your cart is empty.</div>
            ) : (
              lines.map((line) => (
                <div key={line.dish.id} className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{line.dish.name}</div>
                      <div className="text-xs text-white/55">{formatKsh(line.dish.price)} each</div>
                    </div>
                    <div className="text-orange-300">{formatKsh(line.subtotal)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCart((prev) => ({ ...prev, [line.dish.id]: Math.max(0, (prev[line.dish.id] || 0) - 1) }))
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-1 text-xs"
                    >
                      -
                    </button>
                    <span className="text-sm">{line.qty}</span>
                    <button
                      onClick={() =>
                        setCart((prev) => ({ ...prev, [line.dish.id]: (prev[line.dish.id] || 0) + 1 }))
                      }
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-1 text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-sm text-white/60">Total</div>
            <div className="text-3xl font-black text-orange-300">{formatKsh(total)}</div>
            <div className="mt-4 space-y-2">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
              />
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Customer phone"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <button
              onClick={() => void placeOrder()}
              disabled={!lines.length || placingOrder}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              {placingOrder ? "Placing Order..." : "Place Order"}
            </button>
            <button
              onClick={() => void payViaStk()}
              disabled={!lines.length || sendingStk}
              className="mt-2 w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {sendingStk ? "Sending request..." : "Pay with M-Pesa STK Push"}
            </button>
            {statusMessage ? <div className="mt-2 text-xs text-white/80">{statusMessage}</div> : null}
            {paymentStatus ? <div className="mt-1 text-xs text-emerald-300">Payment status: {paymentStatus}</div> : null}
            {actionError ? <div className="mt-2 text-xs text-red-300">{actionError}</div> : null}
            {activeOrderId ? (
              <button
                onClick={() => navigate(`/r/${slug}/order/${encodeURIComponent(activeOrderId)}`)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white"
              >
                View Current Order
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
