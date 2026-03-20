import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] leading-none shadow-[inset_0_1px_0_rgba(255,248,241,0.05)]",
  {
    variants: {
      variant: {
        neutral: "border-border/80 bg-[linear-gradient(180deg,rgba(255,248,241,0.06),rgba(255,255,255,0.03))] text-text-primary/85",
        accent: "border-primary/40 bg-[linear-gradient(180deg,rgba(228,87,46,0.22),rgba(121,48,25,0.18))] text-text-primary",
        success: "border-secondary-accent/35 bg-[linear-gradient(180deg,rgba(245,138,31,0.2),rgba(128,70,16,0.18))] text-text-primary",
        warning: "border-secondary-accent/35 bg-[linear-gradient(180deg,rgba(245,138,31,0.2),rgba(128,70,16,0.16))] text-text-primary",
        danger: "border-error/35 bg-[linear-gradient(180deg,rgba(211,106,89,0.2),rgba(102,43,37,0.16))] text-red-100",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
