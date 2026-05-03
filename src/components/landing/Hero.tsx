import * as React from "react";
import { motion } from "framer-motion";
import { Box } from "lucide-react";
import { useGsapReveal } from "../../hooks/use-gsap-reveal";
import { HeroActions } from "../ui/hero-actions";
import { UbhonaLogo } from "../ui/ubhona-logo";
import { cn } from "../../lib/utils";
import { typography } from "../../design-system";

const HeroMedia = React.lazy(async () => {
  const module = await import("./HeroMedia");
  return { default: module.HeroMedia };
});

type HeroProps = {
  onGetStarted: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  onViewDemo: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  rightPanel?: React.ReactNode;
};

export function Hero({ onGetStarted, onViewDemo, rightPanel }: HeroProps) {
  const heroRef = React.useRef<HTMLElement | null>(null);
  const mediaRef = React.useRef<HTMLDivElement | null>(null);
  const [shouldLoadMedia, setShouldLoadMedia] = React.useState(false);

  useGsapReveal(heroRef, {
    selectors: [
      "[data-gsap-hero='eyebrow']",
      "[data-gsap-hero='headline']",
      "[data-gsap-hero='body']",
      "[data-gsap-hero='actions']",
      "[data-gsap-hero='media']",
    ],
    y: 30,
    duration: 0.86,
    stagger: 0.11,
    delay: 0.04,
  });

  React.useEffect(() => {
    if (shouldLoadMedia) return;
    const node = mediaRef.current;
    if (!node) return;

    let cancelled = false;
    let idleHandle: number | null = null;

    const trigger = () => {
      if (cancelled) return;
      React.startTransition(() => {
        setShouldLoadMedia(true);
      });
    };

    const schedule = () => {
      const idleApi = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };

      if (typeof idleApi.requestIdleCallback === "function") {
        idleHandle = idleApi.requestIdleCallback(() => trigger(), { timeout: 800 });
        return;
      }

      idleHandle = window.setTimeout(trigger, 220);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        schedule();
      },
      { rootMargin: "180px 0px" }
    );

    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
      const idleApi = window as Window & {
        cancelIdleCallback?: (id: number) => void;
      };
      if (idleHandle == null) return;
      if (typeof idleApi.cancelIdleCallback === "function") {
        idleApi.cancelIdleCallback(idleHandle);
        return;
      }
      window.clearTimeout(idleHandle);
    };
  }, [shouldLoadMedia]);

  const mediaFallback = (
    <div className="relative flex min-h-[340px] items-center justify-center overflow-visible sm:min-h-[390px] lg:min-h-[470px]">
      <div className="pointer-events-none absolute z-0 h-[430px] w-[430px] rounded-full bg-[#FF7A1A]/18 blur-[138px] sm:h-[520px] sm:w-[520px] lg:h-[600px] lg:w-[600px]" />
      <div className="relative z-10 h-[320px] w-full max-w-[560px] overflow-hidden sm:h-[360px] lg:h-[430px]">
        <div className="relative h-full w-full overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF7A1A]/24 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F7F1E8]/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.14),rgba(255,255,255,0.02)_65%)]" />
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium tracking-[0.02em] text-[#E8D8C3]/72">
            Loading 3D preview
          </p>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,132,42,0.07)_0%,rgba(255,132,42,0.02)_34%,rgba(0,0,0,0)_66%)]" />
        <div className="pointer-events-none absolute bottom-5 left-1/2 h-16 w-[64%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,162,92,0.22)_0%,rgba(255,162,92,0.1)_44%,rgba(255,162,92,0)_74%)] blur-xl" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-[2px] w-[40%] -translate-x-1/2 bg-white/14 blur-[1px]" />
      </div>
    </div>
  );

  return (
    <section ref={heroRef} className="ubhona-landing-hero mb-12 mt-3 sm:mt-5">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-center lg:gap-14">
        <div className="relative z-10 flex min-w-0 flex-col justify-center">
          <div
            data-gsap-hero="eyebrow"
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,240,233,0.88))] px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_26px_rgba(102,78,59,0.08)]"
          >
            <UbhonaLogo size={18} theme="dark" decorative />
            <Box className="h-3.5 w-3.5 text-primary" />
            Ubhona - Visualize
          </div>
          <h1
            data-gsap-hero="headline"
            className={cn("max-w-[13.5ch] text-[2.45rem] leading-[0.97] text-neutral-900 sm:text-[3.2rem] lg:text-[4.08rem]", typography.pageTitle)}
          >
            Visual restaurant menus in <span className="ubhona-landing-highlight">3D and AR</span>
          </h1>
          <p
            data-gsap-hero="body"
            className={cn("mt-7 max-w-xl text-neutral-600 sm:text-base sm:leading-8", typography.body)}
          >
            Ubhona helps restaurants showcase food visually, create digital storefronts, and turn
            menus into interactive experiences.
          </p>
          <div data-gsap-hero="actions">
            <HeroActions
              primaryLabel="Get Started"
              primaryOnClick={onGetStarted}
              secondaryLabel="View Demo"
              secondaryHref="/r/demo"
              secondaryOnClick={onViewDemo}
              className="mt-3 max-w-lg"
            />
          </div>
        </div>

        <motion.div
          ref={mediaRef}
          data-gsap-hero="media"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex w-full max-w-[500px] items-center justify-center lg:justify-end"
        >
          <div className="pointer-events-none absolute right-[2%] top-[16%] h-56 w-56 rounded-full bg-orange-400/20 opacity-55 blur-3xl" />
          <div className="pointer-events-none absolute left-[12%] bottom-[10%] h-44 w-44 rounded-full bg-[#bff36f]/14 opacity-50 blur-3xl" />
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.02 }}
            className="group relative w-full max-w-[462px] -translate-y-2 rounded-[30px] border border-white/12 bg-[linear-gradient(145deg,rgba(255,248,239,0.94),rgba(255,118,33,0.12)_42%,rgba(22,14,10,0.72))] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.28),0_0_42px_rgba(255,106,26,0.16)] backdrop-blur-xl transition duration-500 ease-out"
          >
            <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(180deg,rgba(13,10,8,0.9),rgba(4,4,4,0.96))]">
              <React.Suspense fallback={mediaFallback}>
                {shouldLoadMedia ? <HeroMedia className="mx-auto w-full max-w-[400px]" overlay={rightPanel} /> : mediaFallback}
              </React.Suspense>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,238,0.13),transparent_18%,transparent_70%,rgba(0,0,0,0.24))]" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

