import * as React from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type UseGsapScrollRevealOptions = {
  selectors: string[];
  start?: string;
  y?: number;
  duration?: number;
  stagger?: number;
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(media.matches);

    handleChange();
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

export function useGsapScrollReveal(
  scope: React.RefObject<HTMLElement | null>,
  {
    selectors,
    start = "top 74%",
    y = 28,
    duration = 0.8,
    stagger = 0.1,
  }: UseGsapScrollRevealOptions,
) {
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const elements = selectors
        .map((selector) => Array.from(root.querySelectorAll<HTMLElement>(selector)))
        .flat();

      if (!elements.length) return;

      if (prefersReducedMotion) {
        gsap.set(elements, { clearProps: "all", opacity: 1, y: 0 });
        return;
      }

      gsap.set(elements, { opacity: 0, y });

      gsap.to(elements, {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease: "power2.out",
        overwrite: "auto",
        scrollTrigger: {
          trigger: root,
          start,
          once: true,
        },
      });
    },
    { scope, dependencies: [prefersReducedMotion, duration, selectors, stagger, start, y] },
  );
}
