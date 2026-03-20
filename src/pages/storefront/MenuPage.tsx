import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getStorefrontDataBySlug,
  type PublicCategory,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import {
  addStorefrontCartItem,
  loadStorefrontCart,
  saveStorefrontCart,
  storefrontCartCount,
  type StorefrontCart,
} from "../../lib/storefront-cart";
import { trackAnalyticsEvent } from "../../lib/analytics";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export default function MenuPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const skipNextPersistRef = React.useRef(true);
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [categories, setCategories] = React.useState<PublicCategory[]>([]);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [error, setError] = React.useState("");
  const [cart, setCart] = React.useState<StorefrontCart>({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategoryId, setActiveCategoryId] = React.useState<string>("all");
  const [selectedDish, setSelectedDish] = React.useState<PublicDish | null>(null);

  React.useEffect(() => {
    skipNextPersistRef.current = true;
    setCart({});
    getStorefrontDataBySlug(slug)
      .then((payload) => {
        setRestaurant(payload.restaurant);
        setCategories(payload.categories);
        setDishes(payload.dishes);
        setCart(loadStorefrontCart({ slug, restaurantId: payload.restaurant.id }));
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load menu."));
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
        metadata: { dishName: dish.name },
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

  const displayCategories = React.useMemo(() => {
    if (categories.length) return categories;
    const seen = new Set<string>();
    const derived: PublicCategory[] = [];
    for (const dish of dishes) {
      if (seen.has(dish.categoryId)) continue;
      seen.add(dish.categoryId);
      derived.push({
        id: dish.categoryId,
        name: dish.categoryId ? `Category ${derived.length + 1}` : "Menu",
        sortOrder: derived.length,
      });
    }
    return derived;
  }, [categories, dishes]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGrouped = React.useMemo(() => {
    const map = new Map<string, PublicDish[]>();
    for (const category of displayCategories) {
      const allItems = grouped.get(category.id) || [];
      const queryFiltered = normalizedQuery
        ? allItems.filter((dish) => {
            const haystack = `${dish.name} ${dish.description}`.toLowerCase();
            return haystack.includes(normalizedQuery);
          })
        : allItems;
      if (activeCategoryId !== "all" && category.id !== activeCategoryId) {
        map.set(category.id, []);
      } else {
        map.set(category.id, queryFiltered);
      }
    }
    return map;
  }, [displayCategories, grouped, normalizedQuery, activeCategoryId]);

  const visibleDishCount = React.useMemo(() => {
    let count = 0;
    for (const category of displayCategories) {
      count += (filteredGrouped.get(category.id) || []).length;
    }
    return count;
  }, [displayCategories, filteredGrouped]);

  const totalItems = storefrontCartCount(cart);
  const primary = restaurant?.themePrimary || "#E4572E";

  const addToCart = React.useCallback(
    (dish: PublicDish) => {
      if (!dish.isAvailable || !restaurant) return;
      setCart((prev) => addStorefrontCartItem(prev, dish.id));
      void trackAnalyticsEvent({
        restaurantId: restaurant.id,
        eventType: "add_to_cart",
        dishId: dish.id,
        source: "storefront_menu",
        metadata: { dishName: dish.name },
      });
    },
    [restaurant]
  );

  if (error) {
    const notFound = /not found/i.test(error);
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center">
          <div className="text-2xl font-semibold tracking-[-0.03em] text-orange-300">
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
    return <div className="ubhona-storefront-shell min-h-screen p-8 text-white/70">Loading menu...</div>;
  }

  return (
    <div className={cn(tokens.classes.storefrontShell, "pb-24 md:pb-8")}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className={cn(tokens.classes.storefrontPanel, "mb-4 p-4 sm:p-5")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={restaurant.logoUrl || LOGO_SRC}
                alt={restaurant.name}
                className="h-12 w-12 rounded-xl border border-white/15 object-cover shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
              />
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-white/58">Storefront</div>
                <div className="text-2xl font-semibold tracking-[-0.04em]" style={{ color: primary }}>
                  {restaurant.name}
                </div>
                <div className="text-sm text-white/62">{restaurant.shortDescription || "Visualize"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate(`/r/${slug}/ar`)}
                variant="secondary"
              >
                AR
              </Button>
              <Button
                onClick={() => navigate(`/r/${slug}/checkout`)}
                variant="primary"
                style={{ backgroundColor: primary }}
              >
                Checkout ({totalItems})
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span className={tokens.classes.metricChip}>{displayCategories.length} categories</span>
            <span className={tokens.classes.metricChip}>{visibleDishCount} visible dishes</span>
            <span className={tokens.classes.metricChip}>{totalItems} in cart</span>
          </div>
        </div>

        <div className={cn(tokens.classes.storefrontFloating, "sticky top-0 z-20 mb-4 p-3")}>
          <label htmlFor="storefront-menu-search" className={cn("mb-1.5 block", typography.label)}>
            Search Menu
          </label>
          <Input
            id="storefront-menu-search"
            name="storefrontMenuSearch"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search dishes..."
            className="mb-3"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              onClick={() => setActiveCategoryId("all")}
              size="sm"
              variant={activeCategoryId === "all" ? "primary" : "secondary"}
              className={`shrink-0 rounded-full ${
                activeCategoryId === "all"
                  ? "text-[#FBF6EE]"
                  : "text-white/70"
              }`}
            >
              All
            </Button>
            {displayCategories.map((category) => (
              <Button
                key={category.id}
                onClick={() => {
                  setActiveCategoryId(category.id);
                  const section = document.getElementById(`menu-category-${category.id}`);
                  if (section) {
                    section.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                size="sm"
                variant={activeCategoryId === category.id ? "primary" : "secondary"}
                className={`shrink-0 rounded-full ${
                  activeCategoryId === category.id
                    ? "text-[#FBF6EE]"
                    : "text-white/70"
                }`}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {displayCategories.map((category) => {
          const items = filteredGrouped.get(category.id) || [];
          if (!items.length) return null;
          return (
            <section key={category.id} id={`menu-category-${category.id}`} className="mb-6 scroll-mt-28">
              <h2 className="mb-3 text-xl font-semibold tracking-[-0.03em]">{category.name}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((dish) => (
                  <article
                    key={dish.id}
                    className={cn(tokens.classes.storefrontPanel, "p-4 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/20")}
                  >
                    <img src={dish.thumbUrl} alt={dish.name} className="h-40 w-full rounded-2xl object-cover" />
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold tracking-[-0.02em]">{dish.name}</h3>
                        <p className="text-sm text-white/65">{dish.description}</p>
                      </div>
                      <Badge variant={dish.isAvailable ? "success" : "danger"} className="uppercase tracking-wide">
                        {dish.isAvailable ? "Available" : "Sold out"}
                      </Badge>
                    </div>
                    <div className="mt-2 font-semibold text-orange-300">{formatKsh(dish.price)}</div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        onClick={() => addToCart(dish)}
                        disabled={!dish.isAvailable}
                        variant="primary"
                        size="sm"
                        className="w-full"
                        style={{ backgroundColor: primary }}
                      >
                        Add to Cart
                      </Button>
                      <Button
                        onClick={() => setSelectedDish(dish)}
                        variant="secondary"
                        size="sm"
                        className="w-full"
                      >
                        Quick View
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {!visibleDishCount ? (
          <div className={cn(tokens.classes.storefrontPanel, "p-6 text-center text-sm text-white/65")}>
            No dishes match your current search/filter.
          </div>
        ) : null}
      </div>

      {selectedDish ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 p-4 sm:items-center">
          <div className={cn(tokens.classes.storefrontPanel, "w-full max-w-lg p-4 shadow-2xl shadow-black/50")}>
            <img src={selectedDish.thumbUrl} alt={selectedDish.name} className="h-52 w-full rounded-2xl object-cover" />
            <div className="mt-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#FBF6EE]">{selectedDish.name}</h3>
                <p className="mt-1 text-sm text-white/70">{selectedDish.description}</p>
              </div>
              <div className="text-sm font-semibold text-orange-300">{formatKsh(selectedDish.price)}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => addToCart(selectedDish)}
                disabled={!selectedDish.isAvailable}
                variant="primary"
                className="min-w-[124px]"
                style={{ backgroundColor: primary }}
              >
                Add to Cart
              </Button>
              <Button
                onClick={() => {
                  void trackAnalyticsEvent({
                    restaurantId: restaurant.id,
                    eventType: "ar_open",
                    dishId: selectedDish.id,
                    source: "storefront_menu",
                    metadata: { dishName: selectedDish.name },
                  });
                  navigate(`/r/${slug}/ar?dish=${encodeURIComponent(selectedDish.id)}`);
                }}
                variant="secondary"
                className="min-w-[124px]"
              >
                View in AR
              </Button>
              <Button
                onClick={() => setSelectedDish(null)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ubhona-storefront-floating fixed inset-x-4 bottom-4 z-30 p-3 shadow-xl md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={typography.label}>Cart</div>
            <div className="text-sm font-semibold text-[#FBF6EE]">{totalItems} {totalItems === 1 ? "item" : "items"}</div>
          </div>
          <Button
            onClick={() => navigate(`/r/${slug}/checkout`)}
            variant="primary"
            style={{ backgroundColor: primary }}
          >
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
