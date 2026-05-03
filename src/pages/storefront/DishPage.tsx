import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DishInfoPanel,
  DishMediaStage,
  DishTopBar,
  type MediaMode,
  MobileStickyOrderBar,
  RelatedDishesSection,
} from "../../components/storefront/dish-public-components";
import { UbhonaLoader } from "../../components/ui/ubhona-loader";
import { tokens } from "../../design-system";
import { trackAnalyticsEvent } from "../../lib/analytics";
import { getDishUrl } from "../../lib/qr";
import {
  addStorefrontCartItem,
  loadStorefrontCart,
  saveStorefrontCart,
} from "../../lib/storefront-cart";
import { getStorefrontDataBySlug, type PublicDish, type PublicRestaurant } from "../../lib/storefront";

function detectArSupport() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { xr?: unknown };
  if ("xr" in nav) return true;
  return /android|iphone|ipad/i.test(window.navigator.userAgent);
}

export default function DishPage() {
  const navigate = useNavigate();
  const { restaurantSlug = "", dishId = "" } = useParams();
  const modelViewerRef = React.useRef<HTMLElement | null>(null);
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [dish, setDish] = React.useState<PublicDish | null>(null);
  const [relatedDishes, setRelatedDishes] = React.useState<PublicDish[]>([]);
  const [categoryLabel, setCategoryLabel] = React.useState("Dish");
  const [mode, setMode] = React.useState<MediaMode>("photo");
  const [quantity, setQuantity] = React.useState(1);
  const [isModelLoaded, setIsModelLoaded] = React.useState(false);
  const [hasModelError, setHasModelError] = React.useState(false);
  const [error, setError] = React.useState("");
  const supportsAr = React.useMemo(() => detectArSupport(), []);

  React.useEffect(() => {
    if (document.getElementById("model-viewer-module")) return;
    const script = document.createElement("script");
    script.id = "model-viewer-module";
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    document.head.appendChild(script);
  }, []);

  React.useEffect(() => {
    getStorefrontDataBySlug(restaurantSlug)
      .then((payload) => {
        const selectedDish = payload.dishes.find((row) => row.id === dishId) || null;
        if (!selectedDish) {
          setError("Dish not found.");
          return;
        }
        setRestaurant(payload.restaurant);
        setDish(selectedDish);
        const category = payload.categories.find((row) => row.id === selectedDish.categoryId);
        setCategoryLabel(category?.name || "Dish");
        setRelatedDishes(
          payload.dishes
            .filter((row) => row.categoryId === selectedDish.categoryId && row.id !== selectedDish.id)
            .slice(0, 3)
        );
        setMode("photo");
        setQuantity(1);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dish."));
  }, [dishId, restaurantSlug]);

  React.useEffect(() => {
    if (!dish?.modelUrl && mode !== "photo") {
      setMode("photo");
    }
  }, [dish?.modelUrl, mode]);

  React.useEffect(() => {
    if (!restaurant || !dish) return;
    const key = `mv_analytics_seen_${restaurant.id}_${dish.id}_page_view_dish`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackAnalyticsEvent({
      restaurantId: restaurant.id,
      dishId: dish.id,
      eventType: "dish_view",
      source: "storefront_dish_page",
      metadata: { dishName: dish.name },
    });
  }, [dish, restaurant]);

  React.useEffect(() => {
    const node = modelViewerRef.current;
    if (!node || !dish?.modelUrl) return;

    const markLoaded = () => {
      setIsModelLoaded(true);
      setHasModelError(false);
    };
    const markError = () => {
      setIsModelLoaded(false);
      setHasModelError(true);
    };

    setIsModelLoaded(false);
    setHasModelError(false);
    node.addEventListener("load", markLoaded);
    node.addEventListener("error", markError);
    node.addEventListener("model-visibility", markLoaded);
    return () => {
      node.removeEventListener("load", markLoaded);
      node.removeEventListener("error", markError);
      node.removeEventListener("model-visibility", markLoaded);
    };
  }, [dish?.modelUrl, mode]);

  const addToCart = React.useCallback(() => {
    if (!restaurant || !dish || !dish.isAvailable) return;
    const scope = { slug: restaurantSlug, restaurantId: restaurant.id };
    let cart = loadStorefrontCart(scope);
    cart = addStorefrontCartItem(cart, dish.id, quantity);
    saveStorefrontCart(scope, cart);
    void trackAnalyticsEvent({
      restaurantId: restaurant.id,
      dishId: dish.id,
      eventType: "add_to_cart",
      source: "storefront_dish_page",
      metadata: { dishName: dish.name, quantity },
    });
  }, [dish, quantity, restaurant, restaurantSlug]);

  const orderNow = React.useCallback(() => {
    addToCart();
    navigate(`/r/${restaurantSlug}/checkout`);
  }, [addToCart, navigate, restaurantSlug]);

  const launchAr = React.useCallback(() => {
    if (!dish?.modelUrl || !supportsAr) return;
    if (restaurant) {
      void trackAnalyticsEvent({
        restaurantId: restaurant.id,
        dishId: dish.id,
        eventType: "ar_open",
        source: "storefront_dish_page",
        metadata: { dishName: dish.name },
      });
    }
    navigate(`/r/${restaurantSlug}/ar?dish=${encodeURIComponent(dish.id)}`);
  }, [dish, navigate, restaurant, restaurantSlug, supportsAr]);

  const openArAction = React.useCallback(() => {
    if (!dish?.modelUrl || !supportsAr) return;
    launchAr();
  }, [dish?.modelUrl, launchAr, supportsAr]);

  const shareDish = React.useCallback(async () => {
    if (!restaurant || !dish) return;
    const url = getDishUrl(restaurant.slug, dish.id);
    const shareData = {
      title: `${dish.name} • ${restaurant.name}`,
      text: `Check out ${dish.name} on ${restaurant.name}`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy dish link", url);
    }
  }, [dish, restaurant]);

  if (error) {
    return (
      <div className={`${tokens.classes.storefrontShell} p-6 sm:p-8`}>
        <div className={`${tokens.classes.storefrontPanel} mx-auto max-w-3xl p-6 text-center`}>
          <h1 className="ubhona-storefront-text-accent text-2xl font-semibold tracking-[-0.03em]">Dish unavailable</h1>
          <p className="ubhona-storefront-text-secondary mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!restaurant || !dish) {
    return <UbhonaLoader fullScreen label="Loading dish" shellClassName={tokens.classes.storefrontShell} />;
  }

  return (
    <div className={`${tokens.classes.storefrontShell} pb-28 md:pb-10`}>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <DishTopBar restaurantSlug={restaurantSlug} restaurant={restaurant} onShare={shareDish} />

        <section className="grid gap-4 lg:grid-cols-[58fr_42fr] lg:items-start">
          <DishMediaStage
            dish={dish}
            mode={mode}
            onModeChange={setMode}
            supportsAr={supportsAr}
            isModelLoaded={isModelLoaded}
            hasModelError={hasModelError}
            modelViewerRef={modelViewerRef}
            onLaunchAr={launchAr}
          />

          <DishInfoPanel
            restaurantName={restaurant.name}
            dish={dish}
            categoryLabel={categoryLabel}
            supportsAr={supportsAr}
            quantity={quantity}
            onQuantityChange={setQuantity}
            onAddToCart={addToCart}
            onOrderNow={orderNow}
            onShare={shareDish}
            onOpenAr={openArAction}
          />
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[58fr_42fr]">
          <section className={`${tokens.classes.storefrontPanel} p-4 sm:p-5`}>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-text-primary">About This Dish</h2>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary/84">
              <li className="ubhona-storefront-inline-surface rounded-xl px-3 py-2">Chef-prepared portion for one order.</li>
              <li className="ubhona-storefront-inline-surface rounded-xl px-3 py-2">Fresh ingredients based on current kitchen stock.</li>
              <li className="ubhona-storefront-inline-surface rounded-xl px-3 py-2">Pricing and availability update in real time.</li>
            </ul>
          </section>
          <RelatedDishesSection restaurantSlug={restaurantSlug} dishes={relatedDishes} />
        </div>
      </div>

      <MobileStickyOrderBar
        price={dish.price}
        quantity={quantity}
        onQuantityChange={setQuantity}
        onAddToCart={addToCart}
        disabled={!dish.isAvailable}
      />
    </div>
  );
}
