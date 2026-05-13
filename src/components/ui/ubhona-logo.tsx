import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

export interface UbhonaLogoProps {
  size?: number;
  animated?: boolean;
  showWordmark?: boolean;
  theme?: "light" | "dark";
  variant?: "icon" | "full";
  className?: string;
  ariaLabel?: string;
  decorative?: boolean;
}

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export function UbhonaLogo({
  size = 32,
  animated = false,
  showWordmark = false,
  theme = "dark",
  variant = "icon",
  className,
  ariaLabel = "Ubhona logo",
  decorative = false,
}: UbhonaLogoProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;
  const renderWordmark = variant === "full" || showWordmark;
  const imageClassName = "shrink-0 rounded-[22%] object-cover ring-1 ring-white/10";
  const imageStyle: React.CSSProperties = { width: size, height: size };
  const imageProps: React.ImgHTMLAttributes<HTMLImageElement> = {
    src: LOGO_SRC,
    alt: decorative ? "" : ariaLabel,
    width: size,
    height: size,
    role: decorative ? undefined : "img",
    "aria-label": decorative ? undefined : ariaLabel,
    "aria-hidden": decorative || undefined,
    className: imageClassName,
    style: imageStyle,
  };

  const icon = shouldAnimate ? (
    <motion.img
      {...imageProps}
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    />
  ) : (
    <img {...imageProps} />
  );

  if (!renderWordmark) {
    return <span className={cn("inline-flex items-center", className)}>{icon}</span>;
  }

  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: Math.max(12, Math.round(size * 0.3)) }}>
      {icon}
      <span
        className="font-semibold leading-none tracking-[-0.02em]"
        style={{ color: theme === "dark" ? "#F7F1E8" : "#0F172A", fontSize: Math.max(16, Math.round(size * 0.5)) }}
      >
        Ubhona
      </span>
    </span>
  );
}
