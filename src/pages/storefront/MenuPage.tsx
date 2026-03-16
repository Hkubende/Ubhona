import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getRestaurantBySlug,
  getRestaurantCategoriesBySlug,
  getRestaurantDishesBySlug,
  type PublicCategory,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import { trackAnalyticsEvent } from "../../lib/analytics";

function cartKey(slug: string) {
  return `mv_storefront_cart_${slug}_v1`;
}

type StorefrontCart = Record<string, number>;

function loadStorefrontCart(slug: string): StorefrontCart {
  try {
    const parsed = JSON.parse(localStorage.getItem(cartKey(slug)) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StorefrontCart;
  } catch {
    return {};
  }
}

function saveStorefrontCart(slug: string, cart: StorefrontCart) {
  localStorage.setItem(cartKey(slug), JSON.stringify(cart));
}

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export default function MenuPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [categories, setCategories] = React.useState<PublicCategory[]>([]);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [error, setError] = React.useState("");
  const [cart, setCart] = React.useState<StorefrontCart>({});

  React.useEffect(() => {
    setCart(loadStorefrontCart(slug));
    Promise.all([
      getRestaurantBySlug(slug),
      getRestaurantCategoriesBySlug(slug),
      getRestaurantDishesBySlug(slug),
    ])
      .then(([restaurantData, categoryData, dishData]) => {
        setRestaurant(restaurantData);
        setCategories(categoryData);
        setDishes(dishData);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load menu."));
  }, [slug]);

  React.useEffect(() => {
    saveStorefrontCart(slug, cart);
  }, [cart, slug]);

  React.useEffect(() => {
    if (!restaurant || !dishes.length) return;
    for (const dish of dishes) {
      const seenKey = `mv_analytics_seen_${restaurant.id}_${dish.id}_dish_view`;
      if (sessionStorage.getItem(seenKey)) continue;
      sessionStorage.setItem(seenKey, "1");
      void trackAnalyticsEvent({
        restaurantId: restaurant.id,
        eventType: "dish_view",
        dishId: dish.id,
        source: "storefront_menu",
      });
    }
  }, [restaurant, dishes]);

  React.useEffect(() => {
    if (!restaurant) return;
    const key = `mv_analytics_seen_${restaurant.id}_${slug}_page_view_menu`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackAnalyticsEvent({
      restaurantId: restaurant.id,
      eventType: "page_view",
      source: "storefront_menu",
      metadata: { slug },
    });
  }, [restaurant, slug]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, PublicDish[]>();
    for (const dish of dishes) {
      const bucket = map.get(dish.categoryId) || [];
      bucket.push(dish);
      map.set(dish.categoryId, bucket);
    }
    return map;
  }, [dishes]);

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const primary = restaurant?.themePrimary || "#f97316";

  if (error) {
    const notFound = /not found/i.test(error);
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-2xl font-black text-orange-300">
            {notFound ? "Restaurant not found" : "Menu unavailable"}
          </div>
          <p className="mt-2 text-sm text-white/65">
            {notFound ? "Check the storefront link and try again." : error}
          </p>
        </div>
      </div>
    );
  }
  if (!restaurant) {
    return <div className="min-h-screen bg-[#0b0b10] p-8 text-white/70">Loading menu...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/35 p-4">
          <div>
            <div className="text-2xl font-black" style={{ color: primary }}>
              {restaurant.name} Menu
            </div>
            <div className="text-sm text-white/60">{dishes.length} dishes</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/r/${slug}/ar`)}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold"
            >
              AR
            </button>
            <button
              onClick={() => navigate(`/r/${slug}/checkout`)}
              className="rounded-2xl px-4 py-2 text-sm font-bold text-black"
              style={{ backgroundColor: primary }}
            >
              Checkout ({totalItems})
            </button>
          </div>
        </div>

        {categories.map((category) => (
          <section key={category.id} className="mb-6">
            <h2 className="mb-3 text-xl font-black">{category.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(grouped.get(category.id) || []).map((dish) => (
                <div key={dish.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <img src={dish.thumbUrl} alt={dish.name} className="h-40 w-full rounded-2xl object-cover" />
                  <div className="mt-3 text-lg font-bold">{dish.name}</div>
                  <div className="text-sm text-white/65">{dish.description}</div>
                  <div className="mt-2 font-bold text-orange-300">{formatKsh(dish.price)}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        setCart((prev) => ({ ...prev, [dish.id]: (prev[dish.id] || 0) + 1 }));
                        void trackAnalyticsEvent({
                          restaurantId: restaurant.id,
                          eventType: "add_to_cart",
                          dishId: dish.id,
                          source: "storefront_menu",
                        });
                      }}
                      className="rounded-2xl px-3 py-2 text-sm font-bold text-black"
                      style={{ backgroundColor: primary }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        void trackAnalyticsEvent({
                          restaurantId: restaurant.id,
                          eventType: "ar_open",
                          dishId: dish.id,
                          source: "storefront_menu",
                        });
                        navigate(`/r/${slug}/ar?dish=${encodeURIComponent(dish.id)}`);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold"
                    >
                      AR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
