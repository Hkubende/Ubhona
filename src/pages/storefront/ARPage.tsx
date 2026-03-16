import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getRestaurantBySlug,
  getRestaurantDishesBySlug,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import { trackAnalyticsEvent } from "../../lib/analytics";

function cartKey(slug: string) {
  return `mv_storefront_cart_${slug}_v1`;
}

export default function ARPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [index, setIndex] = React.useState(0);
  const [modelReady, setModelReady] = React.useState(false);
  const [error, setError] = React.useState("");
  const modelRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (document.getElementById("model-viewer-module")) return;
    const script = document.createElement("script");
    script.id = "model-viewer-module";
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(script);
  }, []);

  React.useEffect(() => {
    Promise.all([getRestaurantBySlug(slug), getRestaurantDishesBySlug(slug)])
      .then(([restaurantData, dishData]) => {
        setRestaurant(restaurantData);
        setDishes(dishData);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load AR."));
  }, [slug]);

  React.useEffect(() => {
    if (!restaurant) return;
    const key = `mv_analytics_seen_${restaurant.id}_${slug}_page_view_ar`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackAnalyticsEvent({
      restaurantId: restaurant.id,
      eventType: "page_view",
      source: "storefront_ar",
      metadata: { slug },
    });
  }, [restaurant, slug]);

  React.useEffect(() => {
    if (!dishes.length) return;
    const wanted = searchParams.get("dish");
    const idx = wanted ? dishes.findIndex((dish) => dish.id === wanted) : -1;
    const next = idx >= 0 ? idx : 0;
    setIndex(next);
  }, [dishes, searchParams]);

  const selected = dishes[index];
  const primary = restaurant?.themePrimary || "#f97316";
  const logo = restaurant?.logoUrl || `${import.meta.env.BASE_URL}ubhona-logo.png`;

  React.useEffect(() => {
    if (!selected) return;
    const next = new URLSearchParams(searchParams);
    next.set("dish", selected.id);
    setSearchParams(next, { replace: true });
    setModelReady(false);
    if (restaurant) {
      const arSeenKey = `mv_analytics_seen_${restaurant.id}_${selected.id}_ar_open`;
      if (!sessionStorage.getItem(arSeenKey)) {
        sessionStorage.setItem(arSeenKey, "1");
        void trackAnalyticsEvent({
          restaurantId: restaurant.id,
          eventType: "ar_open",
          dishId: selected.id,
          source: "storefront_ar",
        });
      }
      const viewSeenKey = `mv_analytics_seen_${restaurant.id}_${selected.id}_dish_view`;
      if (!sessionStorage.getItem(viewSeenKey)) {
        sessionStorage.setItem(viewSeenKey, "1");
        void trackAnalyticsEvent({
          restaurantId: restaurant.id,
          eventType: "dish_view",
          dishId: selected.id,
          source: "storefront_ar",
        });
      }
    }
  }, [selected, searchParams, setSearchParams, restaurant]);

  const addToCart = () => {
    if (!selected) return;
    const current = JSON.parse(localStorage.getItem(cartKey(slug)) || "{}");
    current[selected.id] = (current[selected.id] || 0) + 1;
    localStorage.setItem(cartKey(slug), JSON.stringify(current));
    if (restaurant) {
      void trackAnalyticsEvent({
        restaurantId: restaurant.id,
        eventType: "add_to_cart",
        dishId: selected.id,
        source: "storefront_ar",
      });
    }
  };

  if (error) {
    const notFound = /not found/i.test(error);
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-2xl font-black text-orange-300">
            {notFound ? "Restaurant not found" : "AR unavailable"}
          </div>
          <p className="mt-2 text-sm text-white/65">
            {notFound ? "Check the storefront link and try again." : error}
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant || !selected) {
    return <div className="min-h-screen bg-[#0b0b10] p-8 text-white/70">Loading AR...</div>;
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#0b0b10] text-white">
      <div className="absolute inset-x-3 top-3 z-30 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
        <div className="inline-flex items-center gap-2 text-sm font-bold">
          <img src={logo} alt={restaurant.name} className="h-6 w-6 rounded-md object-cover" />
          <span style={{ color: primary }}>{restaurant.name}</span>
        </div>
        <button
          onClick={() => navigate(`/r/${slug}/menu`)}
          className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold"
        >
          Menu
        </button>
      </div>

      <model-viewer
        ref={modelRef}
        src={selected.modelUrl}
        className="h-full w-full"
        camera-controls=""
        auto-rotate=""
        ar=""
        ar-modes="webxr scene-viewer quick-look"
        onLoad={() => setModelReady(true)}
      />

      {!modelReady ? (
        <div className="pointer-events-none absolute inset-0">
          <img src={selected.thumbUrl} alt={selected.name} className="h-full w-full object-cover blur-xl" />
          <div className="absolute inset-0 bg-black/45" />
        </div>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 z-30 rounded-3xl border border-white/10 bg-black/55 p-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-bold">{selected.name}</div>
          <div className="font-black text-orange-300">KSh {selected.price.toLocaleString("en-KE")}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setIndex((i) => (i - 1 + dishes.length) % dishes.length)}
            className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-bold"
          >
            Prev
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % dishes.length)}
            className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-bold"
          >
            Next
          </button>
          <button
            onClick={addToCart}
            className="min-h-11 rounded-2xl text-sm font-bold text-black"
            style={{ backgroundColor: primary }}
          >
            Add
          </button>
        </div>
        <button
          onClick={() => navigate(`/r/${slug}/checkout`)}
          className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-bold"
        >
          Checkout
        </button>
      </div>
    </div>
  );
}
