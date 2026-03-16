import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRestaurantBySlug, type PublicRestaurant } from "../../lib/storefront";
import { trackAnalyticsEvent } from "../../lib/analytics";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.png`;

export default function RestaurantHome() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [restaurant, setRestaurant] = React.useState<PublicRestaurant | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getRestaurantBySlug(slug)
      .then((data) => {
        setRestaurant(data);
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

  if (error) {
    const notFound = /not found/i.test(error);
    return (
      <div className="min-h-screen bg-[#0b0b10] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-2xl font-black text-orange-300">
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
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/70">
          Loading restaurant...
        </div>
      </div>
    );
  }

  const primary = restaurant.themePrimary || "#f97316";
  const secondary = restaurant.themeSecondary || "#34d399";

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section
          className="overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8"
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
                className="h-14 w-14 rounded-2xl object-cover"
              />
              <div>
                <h1 className="text-3xl font-black" style={{ color: primary }}>
                  {restaurant.name}
                </h1>
                <p className="text-sm text-white/70">{restaurant.location}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/r/${slug}/menu`)}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-black"
                style={{ backgroundColor: primary }}
              >
                View Menu
              </button>
              <button
                onClick={() => navigate(`/r/${slug}/ar`)}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white"
              >
                View in AR
              </button>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-white/80">
            {restaurant.shortDescription || "Welcome to our digital storefront. Browse menu items and preview in AR."}
          </p>
        </section>
      </div>
    </div>
  );
}
