import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

const LazyBurgerScene = React.lazy(async () => {
  const module = await import("./BurgerScene");
  return { default: module.BurgerScene };
});

type HeroMediaProps = {
  className?: string;
  overlay?: React.ReactNode;
};

class Hero3DErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function Hero3DFallback({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF7A1A]/24 blur-3xl"
        animate={
          reduceMotion
            ? { opacity: 0.66, scale: 1 }
            : { opacity: [0.58, 0.8, 0.58], scale: [0.98, 1.03, 0.98] }
        }
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F7F1E8]/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.14),rgba(255,255,255,0.02)_65%)]" />
      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium tracking-[0.02em] text-[#E8D8C3]/72">
        Loading 3D preview
      </p>
    </div>
  );
}

export function HeroMedia({ className, overlay }: HeroMediaProps) {
  const reduceMotion = useReducedMotion();
  const fallback = <Hero3DFallback reduceMotion={Boolean(reduceMotion)} />;

  return (
    <div
      className={cn(
        "relative z-10 flex min-h-[340px] items-center justify-center overflow-visible sm:min-h-[390px] lg:min-h-[470px]",
        className
      )}
    >
      <motion.div
        className="pointer-events-none absolute z-0 h-[430px] w-[430px] rounded-full bg-[#FF7A1A]/18 blur-[138px] sm:h-[520px] sm:w-[520px] lg:h-[600px] lg:w-[600px]"
        animate={reduceMotion ? { opacity: 0.66, scale: 1 } : { opacity: [0.56, 0.72, 0.56], scale: [0.995, 1.015, 0.995] }}
        transition={{ duration: 10.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 h-[320px] w-full max-w-[560px] overflow-hidden sm:h-[360px] lg:h-[430px]">
        <Hero3DErrorBoundary fallback={fallback}>
          <React.Suspense fallback={fallback}>
            <LazyBurgerScene />
          </React.Suspense>
        </Hero3DErrorBoundary>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,132,42,0.07)_0%,rgba(255,132,42,0.02)_34%,rgba(0,0,0,0)_66%)]" />
        <div className="pointer-events-none absolute bottom-5 left-1/2 h-16 w-[64%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,162,92,0.22)_0%,rgba(255,162,92,0.1)_44%,rgba(255,162,92,0)_74%)] blur-xl" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-[2px] w-[40%] -translate-x-1/2 bg-white/14 blur-[1px]" />
      </div>

      {overlay ? <div className="relative z-20 h-full">{overlay}</div> : null}
    </div>
  );
}
