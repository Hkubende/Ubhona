import * as React from "react";
import { Box } from "lucide-react";
import { HeroActions } from "../ui/hero-actions";

type HeroProps = {
  onGetStarted: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  onViewDemo: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  rightPanel?: React.ReactNode;
};

export function Hero({ onGetStarted, onViewDemo, rightPanel }: HeroProps) {
  const hasRightPanel = Boolean(rightPanel);

  return (
    <section className="ubhona-landing-hero mb-10">
      <div
        className={
          hasRightPanel
            ? "grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-10"
            : "grid gap-8 lg:grid-cols-1"
        }
      >
        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-[linear-gradient(180deg,rgba(255,248,241,0.06),rgba(255,255,255,0.02))] px-3 py-1 text-xs font-semibold text-[#F7F1E8]/90">
            <Box className="h-3.5 w-3.5 text-primary" />
            Ubhona - Visualize
          </div>
          <h1 className="text-4xl font-black leading-[1.02] tracking-[-0.032em] text-[#FBF6EE] sm:text-5xl lg:text-[3.55rem]">
            Visual restaurant menus in <span className="ubhona-landing-highlight">3D and AR</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#E8D8C3]/90 sm:text-base">
            Ubhona helps restaurants showcase food visually, create digital storefronts, and turn
            menus into interactive experiences.
          </p>
          <HeroActions
            primaryLabel="Get Started"
            primaryOnClick={onGetStarted}
            secondaryLabel="View Demo"
            secondaryHref="/r/demo"
            secondaryOnClick={onViewDemo}
            className="max-w-lg"
          />
        </div>

        {hasRightPanel ? (
          <div className="relative z-10 lg:pl-1">
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-[#E4572E]/20 via-transparent to-[#E8D8C3]/5 blur-3xl" />
            <div className="relative">{rightPanel}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

