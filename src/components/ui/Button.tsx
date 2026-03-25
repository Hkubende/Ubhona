import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { motion, radius } from "../../design-system";

// eslint-disable-next-line react-refresh/only-export-components
export const buttonVariants = cva(
  `inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap border text-sm font-semibold tracking-[-0.01em] shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a120f] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985] ${motion.standard} ${radius.panel}`,
  {
    variants: {
      variant: {
        primary:
          "border-primary/75 bg-[linear-gradient(180deg,#FF6A1A,#E85C14)] text-[#F7F1E8] shadow-[0_14px_28px_rgba(96,39,13,0.3),inset_0_1px_0_rgba(255,226,205,0.22)] hover:-translate-y-0.5 hover:border-primary-hover hover:bg-[linear-gradient(180deg,#FF7F33,#FF6A1A)] hover:shadow-[0_18px_36px_rgba(96,39,13,0.34),0_0_0_1px_rgba(255,106,26,0.22)] active:border-[#E85C14] active:bg-[linear-gradient(180deg,#E85C14,#CC4E0F)]",
        secondary:
          "border-border bg-[linear-gradient(180deg,rgba(20,16,16,0.96),rgba(13,11,11,0.95))] text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-[linear-gradient(180deg,rgba(23,18,18,0.97),rgba(15,12,12,0.96))]",
        outline:
          "border-border/80 bg-transparent text-text-secondary hover:border-primary/45 hover:bg-primary/10 hover:text-text-primary",
        ghost: "border-transparent bg-transparent text-text-secondary hover:bg-white/[0.07] hover:text-text-primary",
        success: "border-success/45 bg-[linear-gradient(180deg,rgba(46,230,166,0.22),rgba(27,196,125,0.2))] text-[#F7F1E8] hover:bg-success/24",
        danger: "border-error/45 bg-[linear-gradient(180deg,rgba(211,106,89,0.18),rgba(102,44,37,0.18))] text-red-100 hover:bg-error/25",
        warning: "border-primary/45 bg-[linear-gradient(180deg,rgba(255,106,26,0.2),rgba(127,50,17,0.18))] text-[#F7F1E8] hover:bg-primary/25",
      },
      size: {
        sm: `min-h-9 px-3 text-xs ${radius.lg}`,
        md: "min-h-10 px-4",
        lg: "min-h-11 px-5 text-sm",
        icon: `h-10 w-10 p-0 ${radius.lg}`,
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);

Button.displayName = "Button";
