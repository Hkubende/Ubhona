import * as React from "react";
import { cn } from "../../lib/utils";

type AvatarProps = {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

export function Avatar({
  src,
  alt = "Avatar",
  fallback = "U",
  size = "md",
  className,
}: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("rounded-full border border-border object-cover", sizeMap[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-white/10 font-semibold text-text-secondary",
        sizeMap[size],
        className
      )}
    >
      {fallback.slice(0, 1).toUpperCase()}
    </div>
  );
}
