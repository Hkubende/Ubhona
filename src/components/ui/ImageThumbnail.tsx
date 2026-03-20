import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { radius } from "../../design-system";

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
  const showImage = Boolean(src) && !broken;

  if (showImage) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className={cn("h-14 w-14 border border-white/10 object-cover shadow-subtle", radius.panel, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center border border-dashed border-white/10 bg-white/[0.03] text-white/45",
        radius.panel,
        className
      )}
    >
      <ImageOff className="h-4 w-4" />
    </div>
  );
}
