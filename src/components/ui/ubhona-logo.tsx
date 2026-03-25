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

const LOGO_COLORS = {
  dark: {
    portal: "#F7F1E8",
    text: "#F7F1E8",
    cubeTop: "#FFB347",
    cubeLeft: "#FF8A1F",
    cubeRight: "#E85C14",
  },
  light: {
    portal: "#0F172A",
    text: "#0F172A",
    cubeTop: "#FFB347",
    cubeLeft: "#FF8A1F",
    cubeRight: "#E85C14",
  },
} as const;

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
  const colors = LOGO_COLORS[theme];
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;
  const renderWordmark = variant === "full" || showWordmark;

  const icon = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative || undefined}
      focusable="false"
      className="shrink-0"
    >
      <motion.path
        d="M24 18 L24 55 Q24 67 34 74 L46 82 Q50 84 54 82 L66 74 Q76 67 76 55 L76 18 L70 20 L70 53 Q70 61 63 66 L53 73 Q50 75 47 73 L37 66 Q30 61 30 53 L30 20 Z"
        fill={colors.portal}
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      />
      <path
        d="M36 28 L36 51 Q36 57 41 61 L48 66 Q50 67.5 52 66 L59 61 Q64 57 64 51 L64 28 L60 29.5 L60 49 Q60 53 56 56 L51.5 59.5 Q50 60.5 48.5 59.5 L44 56 Q40 53 40 49 L40 29.5 Z"
        fill={theme === "dark" ? "#0D0B0B" : "#FFFFFF"}
      />
      <motion.g
        initial={shouldAnimate ? { y: 16, opacity: 0 } : false}
        animate={shouldAnimate ? { y: [16, -1, 0], opacity: 1 } : { y: 0, opacity: 1 }}
        transition={{
          duration: 0.36,
          delay: 0.2,
          ease: [0.22, 1, 0.36, 1],
          times: shouldAnimate ? [0, 0.78, 1] : undefined,
        }}
      >
        <polygon points="50,26 63,33 50,40 37,33" fill={colors.cubeTop} />
        <polygon points="37,33 50,40 50,54 37,47" fill={colors.cubeLeft} />
        <polygon points="63,33 50,40 50,54 63,47" fill={colors.cubeRight} />
      </motion.g>
    </svg>
  );

  if (!renderWordmark) {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: Math.max(12, Math.round(size * 0.3)) }}>
      {icon}
      <span
        className="font-semibold leading-none tracking-[-0.02em]"
        style={{ color: colors.text, fontSize: Math.max(16, Math.round(size * 0.5)) }}
      >
        Ubhona
      </span>
    </span>
  );
}

