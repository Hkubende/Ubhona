import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getStorefrontOrder, type Order } from "../../lib/orders";
import { getRestaurantBySlug, type PublicRestaurant } from "../../lib/storefront";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function OrderStatusPage() {
  const navigate = useNavigate();
  const { slug = "", orderId = "" } = useParams();
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);

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
    if (!restaurant || !orderId) return;
    const timer = window.setInterval(() => {
      void getStorefrontOrder(orderId, restaurant.id)
        .then((next) => setOrder(next))
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [restaurant, orderId]);

  const primary = restaurant?.themePrimary || "#f97316";

  if (loading) return <div className="min-h-screen bg-[#0b0b10] p-8 text-white/70">Loading...</div>;
  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-2xl font-black text-orange-300">Restaurant not found</div>
          <p className="mt-2 text-sm text-white/65">Check the storefront link and try again.</p>
        </div>
      </div>
    );
  }
  if (!order) return <div className="min-h-screen bg-[#0b0b10] p-8 text-white/70">Order not found.</div>;

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="text-2xl font-black" style={{ color: primary }}>
            Order {order.id}
          </div>
          <div className="mt-1 text-sm text-white/60">Status: {order.status}</div>
          <div className="mt-1 text-sm text-white/60">Payment: {order.paymentStatus}</div>
          <div className="mt-4 space-y-2">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.dishId}`} className="flex items-center justify-between text-sm">
                <div>
                  {item.quantity} x {item.name}
                </div>
                <div className="text-orange-300">{formatKsh(item.subtotal)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-lg font-black">{formatKsh(order.total)}</div>
          <button
            onClick={() => navigate(`/r/${slug}/menu`)}
            className="mt-5 rounded-2xl px-4 py-3 text-sm font-bold text-black"
            style={{ backgroundColor: primary }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
