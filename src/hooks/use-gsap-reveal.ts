import * as React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

type UseGsapRevealOptions = {
  selectors: string[];
  y?: number;
  duration?: number;
  stagger?: number;
  delay?: number;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function useGsapReveal(
  scope: React.RefObject<HTMLElement | null>,
  { selectors, y = 28, duration = 0.82, stagger = 0.1, delay = 0.08 }: UseGsapRevealOptions
) {
  const reduceMotion = usePrefersReducedMotion();
  const selectorKey = selectors.join("|");

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const targets = selectors.flatMap((selector) => gsap.utils.toArray<HTMLElement>(selector, root));
      if (!targets.length) return;

      gsap.set(targets, { clearProps: "all" });

      if (reduceMotion) {
        gsap.set(targets, { autoAlpha: 1, y: 0, clearProps: "all" });
        return;
      }

      gsap.set(targets, {
        autoAlpha: 0,
        y,
        willChange: "transform,opacity",
      });

      gsap.timeline({
        defaults: {
          duration,
          ease: "power3.out",
        },
      }).to(targets, {
        autoAlpha: 1,
        y: 0,
        stagger,
        delay,
        clearProps: "willChange",
      });
    },
    {
      scope,
      dependencies: [reduceMotion, selectorKey, y, duration, stagger, delay],
    }
  );
}
