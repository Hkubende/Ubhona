import * as React from "react";
import { cn } from "../../lib/utils";
import { UbhonaLogo } from "./ubhona-logo";

export interface UbhonaLoaderProps {
  className?: string;
  shellClassName?: string;
  label?: string;
  detail?: string;
  fullScreen?: boolean;
  variant?: "full" | "inline";
}

export function UbhonaLoader({
  className,
  shellClassName,
  label = "Loading",
  detail = "Preparing your workspace",
  fullScreen = false,
  variant = "full",
}: UbhonaLoaderProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-3 rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(38,26,20,0.98),rgba(24,18,15,0.96))] px-4 py-3 text-text-primary shadow-elevated",
          className
        )}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <UbhonaLogo size={26} animated theme="dark" decorative />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary/70">UBHONA</div>
          <div className="text-sm font-semibold text-text-primary">{label}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 py-8",
        fullScreen && "min-h-screen",
        shellClassName
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className={cn(
          "flex w-full max-w-sm flex-col items-center rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,rgba(38,26,20,0.98),rgba(24,18,15,0.96))] px-8 py-8 text-center text-text-primary shadow-elevated",
          className
        )}
      >
        <UbhonaLogo size={64} animated theme="dark" decorative />
        <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary/68">UBHONA</div>
        <div className="mt-2 text-base font-semibold text-text-primary">{label}</div>
        <div className="mt-1 text-sm text-text-secondary/78">{detail}</div>
        <div className="mt-5 h-1.5 w-24 overflow-hidden rounded-full bg-white/8">
          <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
        </div>
      </div>
    </div>
  );
}
