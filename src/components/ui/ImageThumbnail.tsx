import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { radius } from "../../design-system";
import { applyDishImageFallback, getDishImageVariantUrl, resolveDishImageSrc } from "../../lib/image-variants";

export function ImageThumbnail({
  src,
  name,
  className,
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);
  const variantSrc = getDishImageVariantUrl(resolveDishImageSrc(src || ""), "small");
  const showImage = Boolean(variantSrc) && !broken;

  if (showImage) {
    return (
      <img
        src={variantSrc}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={(event) => {
          applyDishImageFallback(event, src || "");
          setBroken(true);
        }}
        className={cn("h-14 w-14 border border-border object-cover shadow-subtle", radius.panel, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center border border-dashed border-border bg-[color:var(--ui-note-icon-bg)] text-text-secondary/55",
        radius.panel,
        className
      )}
    >
      <ImageOff className="h-4 w-4" />
    </div>
  );
}
