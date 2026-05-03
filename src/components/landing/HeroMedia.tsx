import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

type HeroMediaProps = {
  className?: string;
  overlay?: React.ReactNode;
};

const HERO_IMAGE_SRC = "/images/hero-premium-ar-menu.png";

export function HeroMedia({ className, overlay }: HeroMediaProps) {
  const reduceMotion = useReducedMotion();
  const [imageLoaded, setImageLoaded] = React.useState(false);

  return (
    <div
      className={cn(
        "relative z-10 flex min-h-[340px] items-center justify-center overflow-visible sm:min-h-[390px] lg:min-h-[470px]",
        className
      )}
    >
      <motion.div
        className="pointer-events-none absolute z-0 h-[430px] w-[430px] rounded-full bg-[#FF7A1A]/18 blur-[138px] sm:h-[520px] sm:w-[520px] lg:h-[600px] lg:w-[600px]"
        animate={reduceMotion ? { opacity: 0.66, scale: 1 } : { opacity: [0.56, 0.72, 0.56], scale: [0.992, 1.02, 0.992] }}
        transition={{ duration: 10.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 h-[320px] w-full max-w-[560px] overflow-visible sm:h-[360px] lg:h-[430px]"
        animate={reduceMotion ? { y: 0, rotate: 0 } : { y: [0, -8, 0], rotate: [-0.4, 0.4, -0.4] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="ubhona-landing-hero-media-shell h-full w-full">
          <div className="ubhona-landing-hero-media-atmosphere" />
          <div className="pointer-events-none absolute inset-x-[8%] bottom-[7%] h-[20%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,174,87,0.26)_0%,rgba(255,174,87,0.12)_44%,rgba(255,174,87,0)_74%)] blur-2xl" />
          <div className={cn("ubhona-landing-hero-media-frame", imageLoaded && "is-loaded")}>
            <div className="ubhona-landing-hero-media-placeholder" />
            <img
              src={HERO_IMAGE_SRC}
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              className="ubhona-landing-hero-media-image-blur"
            />
            <img
              src={HERO_IMAGE_SRC}
              alt="Ubhona AR menu experience"
              loading="eager"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              className="ubhona-landing-hero-media-image"
            />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,132,42,0.06)_0%,rgba(255,132,42,0.015)_34%,rgba(0,0,0,0)_66%)]" />
        <div className="pointer-events-none absolute bottom-5 left-1/2 h-16 w-[64%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,162,92,0.24)_0%,rgba(255,162,92,0.1)_44%,rgba(255,162,92,0)_74%)] blur-xl" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-[2px] w-[40%] -translate-x-1/2 bg-white/14 blur-[1px]" />
      </motion.div>

      {overlay ? <div className="relative z-20 h-full">{overlay}</div> : null}
    </div>
  );
}
