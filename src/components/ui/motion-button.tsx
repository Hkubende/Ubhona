import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

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

const baseClass =
  "group relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-full border border-[#E8D8C3]/75 bg-[#F7F1E8] px-6 py-3 text-sm font-bold text-[#2B1E17] shadow-[0_14px_30px_rgba(78,33,18,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[#E4572E]/75 hover:bg-[#E4572E] hover:text-[#FBF6EE] hover:shadow-[0_20px_36px_rgba(88,37,20,0.34),0_0_0_1px_rgba(228,87,46,0.18)] focus-visible:border-[#E4572E]/75 focus-visible:bg-[#E4572E] focus-visible:text-[#FBF6EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E4572E]/70 disabled:cursor-not-allowed disabled:opacity-50";

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
