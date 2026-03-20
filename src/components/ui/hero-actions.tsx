import * as React from "react";
import { cn } from "../../lib/utils";
import { MotionButton } from "./motion-button";
import { SecondaryButton } from "./secondary-button";

type HeroActionsProps = {
  primaryLabel: string;
  primaryHref?: string;
  primaryOnClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  secondaryLabel: string;
  secondaryHref?: string;
  secondaryOnClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  className?: string;
  stackedOnMobile?: boolean;
};

export function HeroActions({
  primaryLabel,
  primaryHref,
  primaryOnClick,
  secondaryLabel,
  secondaryHref,
  secondaryOnClick,
  className,
  stackedOnMobile = true,
}: HeroActionsProps) {
  return (
    <div
      className={cn(
        "mt-6 flex gap-3",
        stackedOnMobile ? "flex-col sm:flex-row sm:flex-wrap" : "flex-row flex-wrap",
        className
      )}
    >
      <MotionButton
        label={primaryLabel}
        href={primaryHref}
        onClick={primaryOnClick}
        fullWidth={stackedOnMobile}
        className={cn(stackedOnMobile && "sm:w-auto")}
      />
      <SecondaryButton
        label={secondaryLabel}
        href={secondaryHref}
        onClick={secondaryOnClick}
        fullWidth={stackedOnMobile}
        className={cn(stackedOnMobile && "sm:w-auto")}
      />
    </div>
  );
}

