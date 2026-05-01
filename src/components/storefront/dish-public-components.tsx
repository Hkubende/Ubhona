import * as React from "react";
import { ArrowLeft, Box, Scan, QrCode, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";
import type { PublicDish, PublicRestaurant } from "../../lib/storefront";
import { applyDishImageFallback, getDishImageVariantUrl } from "../../lib/image-variants";

export type MediaMode = "photo" | "model" | "ar";

function formatKsh(value: number) {
  return `KSh ${value.toLocaleString("en-KE")}`;
}

export function DishTopBar({
  restaurantSlug,
  restaurant,
  onShare,
}: {
  restaurantSlug: string;
  restaurant: PublicRestaurant;
  onShare?: () => void;
}) {
  return (
    <div className={cn(tokens.classes.storefrontFloating, "mb-4 flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3")}>
      <Link
        to={`/r/${restaurantSlug}/menu`}
        className="ubhona-storefront-control inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-primary transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Menu
      </Link>
      <div className="flex items-center gap-2">
        <div className="ubhona-storefront-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-text-secondary/88">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {restaurant.name}
        </div>
        {onShare ? (
          <Button type="button" variant="ghost" onClick={onShare} className="h-9 rounded-full px-3 text-text-secondary hover:text-text-primary">
            <Share2 className="mr-1.5 h-4 w-4" />
            Share
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MediaModeTabs({
  mode,
  onModeChange,
  hasModel,
  supportsAr,
}: {
  mode: MediaMode;
  onModeChange: (mode: MediaMode) => void;
  hasModel: boolean;
  supportsAr: boolean;
}) {
  const tabClass =
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition";
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onModeChange("photo")}
        className={cn(
          tabClass,
          mode === "photo"
            ? "border-primary/45 bg-primary/15 text-text-primary"
            : "ubhona-storefront-control text-text-secondary"
        )}
      >
        <Box className="h-4 w-4" />
        Photo
      </button>
      <button
        type="button"
        onClick={() => hasModel && onModeChange("model")}
        disabled={!hasModel}
        className={cn(
          tabClass,
          mode === "model"
            ? "border-primary/45 bg-primary/15 text-text-primary"
            : "ubhona-storefront-control text-text-secondary disabled:cursor-not-allowed disabled:opacity-45"
        )}
      >
        <Scan className="h-4 w-4" />
        3D
      </button>
      <button
        type="button"
        onClick={() => hasModel && supportsAr && onModeChange("ar")}
        disabled={!hasModel || !supportsAr}
        className={cn(
          tabClass,
          mode === "ar"
            ? "border-primary/45 bg-primary/15 text-text-primary"
            : "ubhona-storefront-control text-text-secondary disabled:cursor-not-allowed disabled:opacity-45"
        )}
      >
        <QrCode className="h-4 w-4" />
        AR
      </button>
    </div>
  );
}

export function DishMediaStage({
  dish,
  mode,
  onModeChange,
  supportsAr,
  isModelLoaded,
  hasModelError,
  modelViewerRef,
  onLaunchAr,
}: {
  dish: PublicDish;
  mode: MediaMode;
  onModeChange: (mode: MediaMode) => void;
  supportsAr: boolean;
  isModelLoaded: boolean;
  hasModelError: boolean;
  modelViewerRef: React.RefObject<HTMLElement | null>;
  onLaunchAr: () => void;
}) {
  return (
    <div className={cn(tokens.classes.storefrontPanel, "overflow-hidden p-3 sm:p-4")}>
      <MediaModeTabs mode={mode} onModeChange={onModeChange} hasModel={Boolean(dish.modelUrl)} supportsAr={supportsAr} />
      <div className="ubhona-storefront-inline-surface-strong relative overflow-hidden rounded-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_18%,rgba(255,106,26,0.24),rgba(255,106,26,0)_58%)]" />
        {mode === "photo" ? (
          <img
            src={getDishImageVariantUrl(dish.thumbUrl, "large")}
            alt={dish.name}
            decoding="async"
            onError={(event) => applyDishImageFallback(event, dish.thumbUrl)}
            className="h-[320px] w-full object-cover sm:h-[460px]"
          />
        ) : null}

        {mode === "model" && dish.modelUrl ? (
          <div className="relative h-[320px] sm:h-[460px]">
            <model-viewer
              ref={modelViewerRef}
              src={dish.modelUrl}
              className="h-full w-full"
              camera-controls=""
              auto-rotate=""
              exposure="1"
              shadow-intensity="1"
            />
            {!isModelLoaded && !hasModelError ? (
              <div className="pointer-events-none absolute inset-0">
                <img
                  src={getDishImageVariantUrl(dish.thumbUrl, "medium")}
                  alt={dish.name}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => applyDishImageFallback(event, dish.thumbUrl)}
                  className="h-full w-full object-cover blur-xl"
                />
                <div className="ubhona-storefront-overlay-backdrop absolute inset-0" />
              </div>
            ) : null}
            {hasModelError ? (
              <div className="ubhona-storefront-overlay-alert-layer absolute inset-0 grid place-items-center">
                <div className="ubhona-storefront-overlay-card ubhona-storefront-text-accent rounded-xl px-3 py-2 text-center text-sm">
                  Could not load 3D model. Switch back to photo.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "ar" ? (
          <div className="grid h-[320px] place-items-center p-6 text-center sm:h-[460px]">
            <div className="max-w-sm space-y-3">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">View In AR</h3>
              <p className="text-sm text-text-secondary/82">
                {supportsAr
                  ? "Launch AR to preview this dish in your environment."
                  : "AR is not supported on this device. You can still use photo and 3D preview."}
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={onLaunchAr}
                disabled={!supportsAr}
                className="mx-auto min-w-[140px]"
              >
                {supportsAr ? "Launch AR" : "AR Unsupported"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-text-secondary/75">
        {mode === "photo"
          ? "Photo preview for quick ordering."
          : mode === "model"
            ? "Drag to rotate the 3D model."
            : supportsAr
              ? "Open AR on your phone camera for a real-world preview."
              : "AR currently unavailable on this device."}
      </p>
    </div>
  );
}

export function QuantitySelector({
  quantity,
  onChange,
}: {
  quantity: number;
  onChange: (next: number) => void;
}) {
  const inputId = React.useId();
  return (
    <div className="ubhona-storefront-control inline-flex items-center overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, quantity - 1))}
        className="inline-flex h-10 w-10 items-center justify-center text-lg text-text-primary transition hover:bg-white/8"
        aria-label="Decrease quantity"
      >
        -
      </button>
      <Input
        id={inputId}
        name={inputId}
        value={String(quantity)}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1);
        }}
        type="number"
        min="1"
        step="1"
        className="h-10 w-16 rounded-none border-x border-y-0 border-border/70 bg-transparent px-1 text-center text-sm"
      />
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        className="inline-flex h-10 w-10 items-center justify-center text-lg text-text-primary transition hover:bg-white/8"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function DishInfoPanel({
  restaurantName,
  dish,
  categoryLabel,
  supportsAr,
  quantity,
  onQuantityChange,
  onAddToCart,
  onOrderNow,
  onShare,
  onOpenAr,
}: {
  restaurantName: string;
  dish: PublicDish;
  categoryLabel: string;
  supportsAr: boolean;
  quantity: number;
  onQuantityChange: (next: number) => void;
  onAddToCart: () => void;
  onOrderNow: () => void;
  onShare: () => void;
  onOpenAr: () => void;
}) {
  return (
    <div className={cn(tokens.classes.storefrontPanel, "space-y-4 p-4 sm:p-5")}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ubhona-storefront-chip inline-flex rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] text-text-secondary/82">
            {restaurantName} / {categoryLabel}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-text-primary sm:text-4xl">{dish.name}</h1>
        <div className="text-2xl font-semibold text-primary">{formatKsh(dish.price)}</div>
        <div className="flex items-center gap-2">
          <Badge variant={dish.isAvailable ? "success" : "danger"} className="uppercase tracking-wide">
            {dish.isAvailable ? "Available" : "Sold out"}
          </Badge>
        </div>
        <p className={cn(typography.body, "text-text-secondary/86")}>{dish.description}</p>
      </div>

      <div>
        <div className={cn("mb-1.5 block", typography.label)}>Quantity</div>
        <QuantitySelector quantity={quantity} onChange={onQuantityChange} />
      </div>

      <div className="grid gap-2">
        <Button variant="primary" onClick={onAddToCart} disabled={!dish.isAvailable} className="min-h-11">
          Add To Cart
        </Button>
        <Button variant="secondary" onClick={onOrderNow} disabled={!dish.isAvailable} className="min-h-11">
          Order Now
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onShare} className="gap-1.5 text-text-secondary hover:text-text-primary">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button variant="ghost" onClick={onOpenAr} disabled={!dish.modelUrl || !supportsAr} className="gap-1.5 text-text-secondary hover:text-text-primary">
          <QrCode className="h-4 w-4" />
          View in AR
        </Button>
      </div>

      <div className="ubhona-storefront-inline-surface rounded-xl px-3 py-2 text-xs text-text-secondary/78">
        Fresh prep. Updated availability. Secure checkout.
      </div>
    </div>
  );
}

export function RelatedDishesSection({
  restaurantSlug,
  dishes,
}: {
  restaurantSlug: string;
  dishes: PublicDish[];
}) {
  if (!dishes.length) return null;
  return (
    <section className={cn(tokens.classes.storefrontPanel, "p-4 sm:p-5")}>
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-text-primary">Related Dishes</h2>
      <p className="mt-1 text-sm text-text-secondary/80">Explore more from this category.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dishes.map((dish) => (
          <Link
            key={dish.id}
            to={`/r/${restaurantSlug}/dish/${dish.id}`}
            className="ubhona-storefront-inline-surface-strong rounded-2xl p-3 transition hover:-translate-y-0.5 hover:border-primary/30"
          >
            <img
              src={getDishImageVariantUrl(dish.thumbUrl, "small")}
              alt={dish.name}
              loading="lazy"
              decoding="async"
              onError={(event) => applyDishImageFallback(event, dish.thumbUrl)}
              className="h-32 w-full rounded-xl object-cover"
            />
            <div className="mt-2 font-semibold text-text-primary">{dish.name}</div>
            <div className="text-xs text-text-secondary/74 line-clamp-2">{dish.description}</div>
            <div className="mt-1 text-sm font-semibold text-primary">{formatKsh(dish.price)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function MobileStickyOrderBar({
  price,
  quantity,
  onQuantityChange,
  onAddToCart,
  disabled,
}: {
  price: number;
  quantity: number;
  onQuantityChange: (next: number) => void;
  onAddToCart: () => void;
  disabled: boolean;
}) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 md:hidden">
      <div className={cn(tokens.classes.storefrontFloating, "p-3")}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-text-secondary/84">Total</div>
          <div className="text-base font-semibold text-primary">{formatKsh(price * quantity)}</div>
        </div>
        <div className="mb-2">
          <QuantitySelector quantity={quantity} onChange={onQuantityChange} />
        </div>
        <Button variant="primary" onClick={onAddToCart} disabled={disabled} className="w-full">
          Add To Cart
        </Button>
      </div>
    </div>
  );
}
