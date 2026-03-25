import * as React from "react";

type UseHeaderScrollBehaviorOptions = {
  enabled?: boolean;
};

type HeaderScrollBehaviorState = {
  isVisible: boolean;
  isAtTop: boolean;
};

export function useHeaderScrollBehavior(
  options: UseHeaderScrollBehaviorOptions = {}
): HeaderScrollBehaviorState {
  const { enabled = true } = options;
  const [isVisible, setIsVisible] = React.useState(true);
  const [isAtTop, setIsAtTop] = React.useState(true);
  const previousYRef = React.useRef(0);
  const downDeltaRef = React.useRef(0);
  const upDeltaRef = React.useRef(0);
  const tickingRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setIsVisible(true);
      setIsAtTop(true);
      return;
    }

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const noiseThreshold = isMobile ? 5 : 3;
    const hideThreshold = isMobile ? 56 : 42;
    const showThreshold = isMobile ? 28 : 20;
    const hideStart = isMobile ? 92 : 72;
    const topRevealZone = 20;

    previousYRef.current = window.scrollY;

    const apply = () => {
      tickingRef.current = false;
      const currentY = Math.max(window.scrollY, 0);
      const previousY = previousYRef.current;
      const delta = currentY - previousY;

      setIsAtTop(currentY <= topRevealZone);
      if (currentY <= topRevealZone) {
        downDeltaRef.current = 0;
        upDeltaRef.current = 0;
        setIsVisible(true);
        previousYRef.current = currentY;
        return;
      }

      if (Math.abs(delta) < noiseThreshold) {
        previousYRef.current = currentY;
        return;
      }

      if (delta > 0) {
        downDeltaRef.current += delta;
        upDeltaRef.current = 0;
        if (currentY > hideStart && downDeltaRef.current >= hideThreshold) {
          setIsVisible(false);
          downDeltaRef.current = 0;
        }
      } else {
        upDeltaRef.current += Math.abs(delta);
        downDeltaRef.current = 0;
        if (upDeltaRef.current >= showThreshold) {
          setIsVisible(true);
          upDeltaRef.current = 0;
        }
      }

      previousYRef.current = currentY;
    };

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  return { isVisible, isAtTop };
}

