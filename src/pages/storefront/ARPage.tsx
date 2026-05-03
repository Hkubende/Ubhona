import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getRestaurantBySlug,
  getRestaurantArDishesBySlug,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import { addStorefrontCartItem, loadStorefrontCart, saveStorefrontCart } from "../../lib/storefront-cart";
import { trackAnalyticsEvent } from "../../lib/analytics";
import { BackButton } from "../../components/ui/back-button";
import { Button } from "../../components/ui/Button";
import { UbhonaLoader } from "../../components/ui/ubhona-loader";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";
import { applyDishImageFallback, getDishImageVariantUrl } from "../../lib/image-variants";
import { getStorefrontBrandColors } from "../../lib/storefront-theme";

export default function ARPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const modelViewerRef = React.useRef<HTMLElement | null>(null);
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [index, setIndex] = React.useState(0);
  const [isModelLoaded, setIsModelLoaded] = React.useState(false);
  const [hasModelError, setHasModelError] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (document.getElementById("model-viewer-module")) return;
    const script = document.createElement("script");
    script.id = "model-viewer-module";
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(script);
  }, []);

  React.useEffect(() => {
    Promise.all([getRestaurantBySlug(slug), getRestaurantArDishesBySlug(slug)])
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
  const logo = restaurant?.logoUrl || `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;
  const tagline = restaurant?.shortDescription || "Visualize your meal before you order.";
  const heroAccent = getStorefrontBrandColors(restaurant ?? {}).heroAccent;

  React.useEffect(() => {
    if (!selected) return;
    const next = new URLSearchParams(searchParams);
    next.set("dish", selected.id);
    setSearchParams(next, { replace: true });
    setIsModelLoaded(false);
    setHasModelError(false);
    if (restaurant) {
      const arSeenKey = `mv_analytics_seen_${restaurant.id}_${selected.id}_ar_open`;
      if (!sessionStorage.getItem(arSeenKey)) {
        sessionStorage.setItem(arSeenKey, "1");
        void trackAnalyticsEvent({
          restaurantId: restaurant.id,
          eventType: "ar_open",
          dishId: selected.id,
          source: "storefront_ar",
          metadata: { dishName: selected.name },
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
          metadata: { dishName: selected.name },
        });
      }
    }
  }, [selected, searchParams, setSearchParams, restaurant]);

  React.useEffect(() => {
    const node = modelViewerRef.current;
    if (!node || !selected?.modelUrl) return;

    const markLoaded = () => {
      setIsModelLoaded(true);
      setHasModelError(false);
    };
    const markError = () => {
      setIsModelLoaded(false);
      setHasModelError(true);
    };

    node.addEventListener("load", markLoaded);
    node.addEventListener("error", markError);
    node.addEventListener("model-visibility", markLoaded);

    return () => {
      node.removeEventListener("load", markLoaded);
      node.removeEventListener("error", markError);
      node.removeEventListener("model-visibility", markLoaded);
    };
  }, [selected?.modelUrl]);

  const addToCart = () => {
    if (!selected || !restaurant) return;
    const scope = { slug, restaurantId: restaurant.id };
    const current = loadStorefrontCart(scope);
    saveStorefrontCart(scope, addStorefrontCartItem(current, selected.id));
    if (restaurant) {
      void trackAnalyticsEvent({
        restaurantId: restaurant.id,
        eventType: "add_to_cart",
        dishId: selected.id,
        source: "storefront_ar",
        metadata: { dishName: selected.name },
      });
    }
  };

  if (error) {
    const notFound = /not found/i.test(error);
    return (
      <div className={cn(tokens.classes.storefrontShell, "p-8")}>
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center">
          <div className="ubhona-storefront-text-accent text-2xl font-semibold tracking-[-0.03em]">
            {notFound ? "Restaurant not found" : "AR unavailable"}
          </div>
          <p className="ubhona-storefront-text-secondary mt-2 text-sm">
            {notFound ? "Check the storefront link and try again." : error}
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return <UbhonaLoader fullScreen label="Loading AR" shellClassName={tokens.classes.storefrontShell} />;
  }

  if (!dishes.length || !selected) {
    return (
      <div className={cn(tokens.classes.storefrontShell, "p-8")}>
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center">
          <div className="ubhona-storefront-text-accent text-2xl font-semibold tracking-[-0.03em]">No AR dishes available</div>
          <p className="ubhona-storefront-text-secondary mt-2 text-sm">
            This restaurant has no available dishes with AR previews right now.
          </p>
          <Button
            onClick={() => navigate(`/r/${slug}/menu`)}
            variant="secondary"
            className="mt-4"
          >
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(tokens.classes.storefrontShell, "relative h-screen overflow-hidden")}>
      <div className="ubhona-storefront-floating absolute inset-x-3 top-3 z-30 flex items-center justify-between px-3 py-2">
        <div className="inline-flex items-center gap-2">
          <BackButton
            label="Back"
            fallbackHref={`/r/${slug}/menu`}
            className="h-9 px-2.5 text-xs sm:h-10 sm:px-3 sm:text-sm"
          />
          <img src={logo} alt={restaurant.name} className="h-6 w-6 rounded-md object-cover" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-[-0.02em]" style={{ color: heroAccent }}>{restaurant.name}</div>
            <div className="ubhona-storefront-text-secondary max-w-[220px] truncate text-[10px] sm:max-w-[320px]">{tagline}</div>
          </div>
        </div>
        <Button
          onClick={() => navigate(`/r/${slug}/menu`)}
          variant="secondary"
          size="sm"
        >
          Menu
        </Button>
      </div>

      <model-viewer
        ref={modelViewerRef}
        src={selected.modelUrl}
        className="h-full w-full"
        camera-controls=""
        auto-rotate=""
        ar=""
        ar-modes="webxr scene-viewer quick-look"
        onLoad={() => {
          setIsModelLoaded(true);
          setHasModelError(false);
        }}
        onError={() => {
          setIsModelLoaded(false);
          setHasModelError(true);
        }}
      />

      {!isModelLoaded && !hasModelError ? (
        <div className="pointer-events-none absolute inset-0">
          <img
            src={getDishImageVariantUrl(selected.thumbUrl, "medium")}
            alt={selected.name}
            loading="lazy"
            decoding="async"
            onError={(event) => applyDishImageFallback(event, selected.thumbUrl)}
            className="h-full w-full object-cover blur-xl"
          />
          <div className="ubhona-storefront-overlay-backdrop absolute inset-0" />
        </div>
      ) : null}

      {hasModelError ? (
        <div className="ubhona-storefront-overlay-alert-layer pointer-events-none absolute inset-0 grid place-items-center">
          <div className="ubhona-storefront-overlay-card ubhona-storefront-text-accent rounded-2xl px-4 py-3 text-center text-sm">
            Could not load this 3D model. Try another dish.
          </div>
        </div>
      ) : null}

      <div className="ubhona-storefront-floating absolute inset-x-3 bottom-3 z-30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="ubhona-storefront-text-primary font-semibold tracking-[-0.02em]">{selected.name}</div>
          <div className="ubhona-storefront-text-accent font-semibold">KSh {selected.price.toLocaleString("en-KE")}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => setIndex((i) => (i - 1 + dishes.length) % dishes.length)}
            variant="secondary"
            size="lg"
          >
            Prev
          </Button>
          <Button
            onClick={() => setIndex((i) => (i + 1) % dishes.length)}
            variant="secondary"
            size="lg"
          >
            Next
          </Button>
          <Button
            onClick={addToCart}
            variant="primary"
            size="lg"
          >
            Add
          </Button>
        </div>
        <Button
          onClick={() => navigate(`/r/${slug}/checkout`)}
          variant="secondary"
          size="lg"
          className="mt-2 w-full"
        >
          Checkout
        </Button>
        <div className="ubhona-storefront-text-muted mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em]">
          Powered by Ubhona
        </div>
      </div>
    </div>
  );
}
