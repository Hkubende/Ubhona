import * as React from "react";
import { cn } from "../../lib/utils";

type AvatarProps = {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
} & React.HTMLAttributes<HTMLElement>;

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
  ...props
}: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("rounded-full border border-border object-cover", sizeMap[size], className)}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border bg-[color:var(--ui-note-icon-bg)] font-semibold text-text-secondary",
        sizeMap[size],
        className
      )}
      {...props}
    >
      {fallback.slice(0, 1).toUpperCase()}
    </div>
  );
}
