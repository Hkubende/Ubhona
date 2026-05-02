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
import { UbhonaLoader } from "../../components/ui/ubhona-loader";
import { cn } from "../../lib/utils";
import { spacing, tokens, typography } from "../../design-system";
import { applyDishImageFallback, getDishImageVariantUrl } from "../../lib/image-variants";
import { getStorefrontBrandColors } from "../../lib/storefront-theme";

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
      <div className={cn(tokens.classes.storefrontShell, "p-8")}>
        <div className="ubhona-storefront-panel mx-auto max-w-4xl p-8 text-center">
          <div className="ubhona-storefront-text-accent text-2xl font-semibold tracking-[-0.03em]">
            {notFound ? "Restaurant not found" : "Storefront unavailable"}
          </div>
          <p className="ubhona-storefront-text-secondary mt-2 text-sm">
            {notFound ? "Check the storefront link and try again." : error}
          </p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return <UbhonaLoader fullScreen label="Loading restaurant" shellClassName={tokens.classes.storefrontShell} />;
  }

  const { primary, secondary, heroAccent } = getStorefrontBrandColors(restaurant);

  return (
    <div className={tokens.classes.storefrontShell}>
      <div className={cn("mx-auto max-w-6xl", spacing.pagePadding)}>
        <section
          className={cn(tokens.classes.storefrontHero, "p-5 sm:p-6 lg:p-7")}
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
                className="ubhona-storefront-media-frame-strong h-14 w-14 rounded-[20px] object-cover"
              />
              <div>
                <h1 className={cn("text-[2rem] sm:text-[2.4rem]", typography.pageTitle)} style={{ color: heroAccent }}>
                  {restaurant.name}
                </h1>
                <p className={cn("ubhona-storefront-text-secondary", typography.body)}>{restaurant.location}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/r/${slug}/menu`)}
                variant="primary"
                size="lg"
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
          <p className={cn("ubhona-storefront-text-secondary mt-4 max-w-2xl", typography.body)}>
            {restaurant.shortDescription || "Welcome to our digital storefront. Browse menu items and preview in AR."}
          </p>
        </section>

        <Card className="mt-6 border-primary/10 p-5 sm:p-6">
          <div className={cn(typography.sectionTitle, "mb-1 text-text-primary")}>Menu Preview</div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary/72">
            <span className={tokens.classes.metricChip}>{displayCategories.length} categories</span>
            <span className={tokens.classes.metricChip}>{dishes.length} dishes</span>
          </div>
          <div className="mt-4 space-y-5">
            {displayCategories.map((category) => {
              const items = grouped.get(category.id) || [];
              if (!items.length) return null;
                return (
                  <div key={category.id}>
                  <h2 className={cn("ubhona-storefront-text-accent mb-2", typography.subSectionTitle)}>{category.name}</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.slice(0, 3).map((dish) => (
                      <article key={dish.id} className="ui-surface-soft rounded-[22px] p-4 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/20">
                        <img
                          src={getDishImageVariantUrl(dish.thumbUrl, "small")}
                          alt={dish.name}
                          loading="lazy"
                          decoding="async"
                          onError={(event) => applyDishImageFallback(event, dish.thumbUrl)}
                          className="h-32 w-full rounded-xl object-cover"
                        />
                        <div className="mt-3 text-sm font-semibold text-text-primary">{dish.name}</div>
                        <div className="mt-1 text-sm leading-6 text-text-secondary/78">{dish.description}</div>
                        <div className="ubhona-storefront-text-accent mt-2 text-sm font-semibold">
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
            <div className="ui-panel-inset mt-4 rounded-2xl border-dashed p-4 text-sm text-text-secondary/78">
              No dishes are published for this restaurant yet.
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={() => navigate(`/r/${slug}/menu`)}
              variant="primary"
              size="lg"
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
        <div className="ubhona-storefront-text-muted mt-4 text-center text-xs font-semibold uppercase tracking-[0.14em]">
          Powered by Ubhona
        </div>
      </div>
    </div>
  );
}

