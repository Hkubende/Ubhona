import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getStorefrontDataBySlug,
  type PublicCategory,
  type PublicDish,
  type PublicRestaurant,
} from "../../lib/storefront";
import { trackAnalyticsEvent } from "../../lib/analytics";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export default function RestaurantHome() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [categories, setCategories] = React.useState<PublicCategory[]>([]);
  const [dishes, setDishes] = React.useState<PublicDish[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getStorefrontDataBySlug(slug)
      .then((payload) => {
        setRestaurant(payload.restaurant);
        setCategories(payload.categories);
        setDishes(payload.dishes);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load restaurant."));
  }, [slug]);

  React.useEffect(() => {
    if (!restaurant) return;
    const key = `mv_analytics_seen_${restaurant.id}_${slug}_page_view_home`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackAnalyticsEvent({
      restaurantId: restaurant.id,
      eventType: "page_view",
      source: "storefront_home",
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

  if (error) {
    const notFound = /not found/i.test(error);
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center">
          <div className="text-2xl font-semibold tracking-[-0.03em] text-orange-300">
            {notFound ? "Restaurant not found" : "Storefront unavailable"}
          </div>
          <p className="mt-2 text-sm text-white/65">
            {notFound ? "Check the storefront link and try again." : error}
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center text-white/70">
          Loading restaurant...
        </div>
      </div>
    );
  }

  const primary = restaurant.themePrimary || "#E4572E";
  const secondary = restaurant.themeSecondary || "#E8D8C3";

  return (
    <div className={tokens.classes.storefrontShell}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section
          className={cn(tokens.classes.storefrontHero, "p-6 sm:p-8")}
          style={{
            background: restaurant.coverImage
              ? `linear-gradient(135deg, ${primary}66 0%, rgba(11,11,16,0.82) 45%, ${secondary}55 100%), url(${restaurant.coverImage}) center/cover no-repeat`
              : `linear-gradient(135deg, ${primary}33 0%, rgba(255,255,255,0.03) 45%, ${secondary}30 100%)`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={restaurant.logoUrl || LOGO_SRC}
                alt={restaurant.name}
                className="h-14 w-14 rounded-2xl border border-white/20 object-cover shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
              />
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em]" style={{ color: primary }}>
                  {restaurant.name}
                </h1>
                <p className="text-sm text-white/72">{restaurant.location}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/r/${slug}/menu`)}
                variant="primary"
                size="lg"
                style={{ backgroundColor: primary }}
              >
                View Menu
              </Button>
              <Button
                onClick={() => navigate(`/r/${slug}/ar`)}
                variant="secondary"
                size="lg"
              >
                View in AR
              </Button>
            </div>
          </div>
          <p className={cn("mt-4 max-w-2xl", typography.body, "text-white/82")}>
            {restaurant.shortDescription || "Welcome to our digital storefront. Browse menu items and preview in AR."}
          </p>
        </section>

        <Card className="mt-6 border-primary/10 p-5">
          <div className="mb-1 text-xl font-semibold tracking-[-0.03em] text-white">Menu Preview</div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span className={tokens.classes.metricChip}>{displayCategories.length} categories</span>
            <span className={tokens.classes.metricChip}>{dishes.length} dishes</span>
          </div>
          <div className="mt-4 space-y-5">
            {displayCategories.map((category) => {
              const items = grouped.get(category.id) || [];
              if (!items.length) return null;
              return (
                <div key={category.id}>
                  <h2 className="mb-2 text-lg font-semibold tracking-[-0.02em] text-orange-300">{category.name}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.slice(0, 3).map((dish) => (
                      <article key={dish.id} className="ui-surface-soft rounded-2xl p-3 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/20">
                        <img src={dish.thumbUrl} alt={dish.name} className="h-32 w-full rounded-xl object-cover" />
                        <div className="mt-2 font-semibold">{dish.name}</div>
                        <div className="text-xs text-white/60">{dish.description}</div>
                        <div className="mt-1 text-sm font-semibold text-orange-300">
                          KSh {dish.price.toLocaleString("en-KE")}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {!dishes.length ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/65">
              No dishes are published for this restaurant yet.
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={() => navigate(`/r/${slug}/menu`)}
              variant="primary"
              size="lg"
              style={{ backgroundColor: primary }}
            >
              Open Full Menu
            </Button>
            <Button
              onClick={() => navigate(`/r/${slug}/checkout`)}
              variant="secondary"
              size="lg"
            >
              Go to Checkout
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

