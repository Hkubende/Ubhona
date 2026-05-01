import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./Button";

type MotionButtonProps = {
  label: string;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  ariaLabel?: string;
};

function MotionButtonContent({
  label,
  iconClassName,
}: {
  label: string;
  iconClassName?: string;
}) {
  return (
    <>
      <span className="pointer-events-none absolute -left-6 top-1/2 h-20 w-20 -translate-y-1/2 scale-0 rounded-full bg-[#FBF6EE]/20 transition-transform duration-500 ease-out group-hover:scale-125 group-focus-visible:scale-125" />
      <span className="relative z-10 inline-flex items-center gap-2 transition-colors duration-300 ease-out">
        <span>{label}</span>
        <ArrowRight
          className={cn(
            "h-4 w-4 transition-all duration-300 ease-out group-hover:translate-x-0.5",
            iconClassName
          )}
        />
      </span>
    </>
  );
}

const baseClass = cn(
  buttonVariants({ variant: "primary", size: "lg" }),
  "group relative overflow-hidden rounded-[20px] font-semibold"
);

export function MotionButton({
  label,
  href,
  onClick,
  className,
  iconClassName,
  disabled = false,
  type = "button",
  fullWidth = false,
  ariaLabel,
}: MotionButtonProps) {
  const classes = cn(baseClass, fullWidth && "w-full", className);

  if (href) {
    return (
      <a
        href={href}
        onClick={disabled ? undefined : onClick}
        aria-label={ariaLabel || label}
        aria-disabled={disabled || undefined}
        className={classes}
      >
        <MotionButtonContent label={label} iconClassName={iconClassName} />
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      className={classes}
    >
      <MotionButtonContent label={label} iconClassName={iconClassName} />
    </button>
  );
}
