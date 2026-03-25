import * as React from "react";
import { Box } from "lucide-react";
import { HeroActions } from "../ui/hero-actions";
import { UbhonaLogo } from "../ui/ubhona-logo";
import { HeroMedia } from "./HeroMedia";

type HeroProps = {
  onGetStarted: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  onViewDemo: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  rightPanel?: React.ReactNode;
};

export function Hero({ onGetStarted, onViewDemo, rightPanel }: HeroProps) {
  return (
    <section className="ubhona-landing-hero mb-12 mt-3 sm:mt-5">
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)] lg:items-stretch lg:gap-11">
        <div className="relative z-10 flex min-w-0 flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/24 bg-[linear-gradient(180deg,rgba(255,248,241,0.08),rgba(255,255,255,0.02))] px-3.5 py-1.5 text-xs font-semibold text-[#F7F1E8]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_26px_rgba(0,0,0,0.24)]">
            <UbhonaLogo size={18} theme="dark" decorative />
            <Box className="h-3.5 w-3.5 text-primary" />
            Ubhona - Visualize
          </div>
          <h1 className="max-w-[13.5ch] text-[2.45rem] font-black leading-[0.97] tracking-[-0.038em] text-[#FBF6EE] sm:text-5xl lg:text-[4.08rem]">
            Visual restaurant menus in <span className="ubhona-landing-highlight">3D and AR</span>
          </h1>
          <p className="mt-7 max-w-[56ch] text-sm leading-7 text-[#E8D8C3]/84 sm:text-base sm:leading-8">
            Ubhona helps restaurants showcase food visually, create digital storefronts, and turn
            menus into interactive experiences.
          </p>
          <HeroActions
            primaryLabel="Get Started"
            primaryOnClick={onGetStarted}
            secondaryLabel="View Demo"
            secondaryHref="/r/demo"
            secondaryOnClick={onViewDemo}
            className="mt-3 max-w-lg"
          />
        </div>

        <HeroMedia overlay={rightPanel} />
      </div>
    </section>
  );
}

