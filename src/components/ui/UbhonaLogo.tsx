import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

type LogoTheme = "light" | "dark";

type BaseLogoProps = {
  size?: number;
  animated?: boolean;
  showWordmark?: boolean;
  theme?: LogoTheme;
  className?: string;
  ariaLabel?: string;
};

type MarkProps = {
  size: number;
  animated: boolean;
  theme: LogoTheme;
  ariaLabel?: string;
};

type SnappedGeometry = {
  viewBox: string;
  glow: { cx: number; cy: number; rx: number; ry: number };
  ring: { cx: number; cy: number; r: number; strokeWidth: number };
  portalPath: string;
  portalStroke: number;
  cube: { top: string; left: string; right: string };
  cubeLiftStart: number;
};

const LOGO_TIMING = {
  u: 0.5,
  ring: 0.62,
  cube: 0.88,
} as const;

const PALETTE: Record<
  LogoTheme,
  { portal: string; text: string; ring: string; cube: string; cubeSide: string; glow: string }
> = {
  dark: {
    portal: "#F7F1E8",
    text: "#F7F1E8",
    ring: "rgba(255, 127, 51, 0.35)",
    cube: "#FF6A1A",
    cubeSide: "#E85C14",
    glow: "rgba(255, 106, 26, 0.28)",
  },
  light: {
    portal: "#111111",
    text: "#111111",
    ring: "rgba(228, 87, 46, 0.32)",
    cube: "#FF6A1A",
    cubeSide: "#E85C14",
    glow: "rgba(232, 92, 20, 0.22)",
  },
};

const SNAPPED_GEOMETRY: Record<24 | 32, SnappedGeometry> = {
  24: {
    viewBox: "0 0 24 24",
    glow: { cx: 14, cy: 8, rx: 5.5, ry: 3.25 },
    ring: { cx: 14, cy: 8, r: 3.25, strokeWidth: 1.4 },
    portalPath: "M6 4V14C6 18.418 9.582 22 14 22C18.418 22 22 18.418 22 14V4",
    portalStroke: 4,
    cube: {
      top: "14,9 17,11 14,13 11,11",
      left: "11,11 14,13 14,17 11,15",
      right: "17,11 14,13 14,17 17,15",
    },
    cubeLiftStart: 8.5,
  },
  32: {
    viewBox: "0 0 32 32",
    glow: { cx: 18, cy: 11, rx: 7, ry: 4.25 },
    ring: { cx: 18, cy: 11, r: 4.2, strokeWidth: 1.55 },
    portalPath: "M8 5V19C8 24.523 12.477 29 18 29C23.523 29 28 24.523 28 19V5",
    portalStroke: 5,
    cube: {
      top: "18,12 22,14 18,16 14,14",
      left: "14,14 18,16 18,21 14,19",
      right: "22,14 18,16 18,21 22,19",
    },
    cubeLiftStart: 10,
  },
};

function getSnappedGeometry(size: number): SnappedGeometry | null {
  if (size === 24 || size === 32) return SNAPPED_GEOMETRY[size];
  return null;
}

function UbhonaMark({ size, animated, theme, ariaLabel }: MarkProps) {
  const reduceMotion = useReducedMotion();
  const colors = PALETTE[theme];
  const shouldAnimate = animated && !reduceMotion;
  const snapped = getSnappedGeometry(size);
  const compact = size <= 28;
  const small = size <= 32;
  const portalStrokeWidth = snapped ? snapped.portalStroke : compact ? 15 : small ? 14.5 : 14;
  const ringOpacity = compact ? 0.22 : 0.28;
  const cubeLiftStart = snapped ? snapped.cubeLiftStart : compact ? 30 : 28;
  const cubeScale = compact ? 1.04 : 1;

  return (
    <svg
      viewBox={snapped?.viewBox ?? "0 0 100 100"}
      width={size}
      height={size}
      className="shrink-0"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={`ubhona-glow-${theme}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.glow} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <motion.ellipse
        cx={snapped?.glow.cx ?? 50}
        cy={snapped?.glow.cy ?? 36}
        rx={snapped?.glow.rx ?? 20}
        ry={snapped?.glow.ry ?? 12}
        fill={`url(#ubhona-glow-${theme})`}
        initial={shouldAnimate ? { opacity: 0, scale: 0.9 } : false}
        animate={shouldAnimate ? { opacity: [0, 1, 0.55], scale: [0.9, 1.04, 1] } : { opacity: 0.55, scale: 1 }}
        transition={{ duration: LOGO_TIMING.ring, ease: "easeOut", delay: 0.15 }}
      />

      <motion.circle
        cx={snapped?.ring.cx ?? 50}
        cy={snapped?.ring.cy ?? 36}
        r={snapped?.ring.r ?? 11}
        fill="none"
        stroke={colors.ring}
        strokeWidth={snapped?.ring.strokeWidth ?? (small ? 2 : 1.8)}
        initial={shouldAnimate ? { opacity: 0, scale: 0.86 } : false}
        animate={
          shouldAnimate
            ? { opacity: [0, 0.8, ringOpacity], scale: [0.86, 1.06, 1] }
            : { opacity: ringOpacity, scale: 1 }
        }
        transition={{ duration: LOGO_TIMING.ring, ease: "easeOut", delay: 0.12 }}
      />

      <motion.path
        d={snapped?.portalPath ?? "M24 18V60C24 74.359 35.641 86 50 86C64.359 86 76 74.359 76 60V18"}
        fill="none"
        stroke={colors.portal}
        strokeWidth={portalStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={shouldAnimate ? { opacity: 0, pathLength: 0.25 } : false}
        animate={shouldAnimate ? { opacity: 1, pathLength: 1 } : { opacity: 1, pathLength: 1 }}
        transition={{ duration: LOGO_TIMING.u, ease: [0.22, 1, 0.36, 1] }}
      />

      <motion.g
        initial={shouldAnimate ? { y: cubeLiftStart, opacity: 0, scale: 0.9 * cubeScale } : false}
        animate={
          shouldAnimate
            ? {
                y: [cubeLiftStart, -1, 2, 0],
                opacity: [0, 1, 1, 1],
                scale: [0.9 * cubeScale, 1.02 * cubeScale, 0.995 * cubeScale, cubeScale],
              }
            : { y: 0, opacity: 1, scale: cubeScale }
        }
        transition={{
          duration: LOGO_TIMING.cube,
          ease: [0.22, 1, 0.36, 1],
          delay: 0.18,
          times: shouldAnimate ? [0, 0.72, 0.88, 1] : undefined,
        }}
      >
        <polygon
          points={snapped?.cube.top ?? (compact ? "50,43 59.5,48.5 50,54 40.5,48.5" : "50,42 60,48 50,54 40,48")}
          fill="#FF9B63"
          opacity="0.9"
        />
        <polygon
          points={snapped?.cube.left ?? (compact ? "40.5,48.5 50,54 50,65.5 40.5,60" : "40,48 50,54 50,66 40,60")}
          fill={colors.cubeSide}
        />
        <polygon
          points={snapped?.cube.right ?? (compact ? "59.5,48.5 50,54 50,65.5 59.5,60" : "60,48 50,54 50,66 60,60")}
          fill={colors.cube}
        />
      </motion.g>
    </svg>
  );
}

function LogoLockup({
  size,
  theme,
  className,
  children,
}: {
  size: number;
  theme: LogoTheme;
  className?: string;
  children: React.ReactNode;
}) {
  const colors = PALETTE[theme];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {children}
      <span
        className="font-semibold leading-none tracking-[-0.02em]"
        style={{ color: colors.text, fontSize: Math.round(size * 0.48) }}
      >
        Ubhona
      </span>
    </span>
  );
}

export function UbhonaLogo({
  size = 32,
  animated = false,
  showWordmark = false,
  theme = "dark",
  className,
  ariaLabel,
}: BaseLogoProps) {
  const mark = <UbhonaMark size={size} animated={animated} theme={theme} ariaLabel={ariaLabel} />;

  if (!showWordmark) {
    return <span className={className}>{mark}</span>;
  }

  return (
    <LogoLockup size={size} theme={theme} className={className}>
      {mark}
    </LogoLockup>
  );
}

export function AnimatedUbhonaLogo({
  size = 32,
  animated = true,
  showWordmark = false,
  theme = "dark",
  className,
  ariaLabel,
}: BaseLogoProps) {
  return (
    <UbhonaLogo
      size={size}
      animated={animated}
      showWordmark={showWordmark}
      theme={theme}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}

export function UbhonaLogoDemo() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Animated Icon</p>
        <div className="mt-3">
          <AnimatedUbhonaLogo size={48} theme="dark" ariaLabel="Animated Ubhona logo" />
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Static Icon</p>
        <div className="mt-3">
          <UbhonaLogo size={48} theme="dark" ariaLabel="Ubhona logo" />
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Header Lockup</p>
        <div className="mt-3">
          <AnimatedUbhonaLogo size={36} showWordmark theme="dark" ariaLabel="Ubhona brand lockup" />
        </div>
      </div>
    </div>
  );
}
