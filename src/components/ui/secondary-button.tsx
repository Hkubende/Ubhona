import * as React from "react";
import { cn } from "../../lib/utils";

type SecondaryButtonProps = {
  label: string;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  ariaLabel?: string;
};

const baseClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[rgba(232,216,195,0.38)] bg-[linear-gradient(180deg,rgba(23,18,17,0.95),rgba(12,10,10,0.92))] px-6 py-3 text-sm font-semibold text-[#F7F1E8] shadow-[inset_0_1px_0_rgba(255,248,241,0.08),0_12px_26px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-primary/55 hover:bg-[linear-gradient(180deg,rgba(31,24,22,0.95),rgba(15,12,12,0.94))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55 disabled:cursor-not-allowed disabled:opacity-50";

export function SecondaryButton({
  label,
  href,
  onClick,
  className,
  disabled = false,
  type = "button",
  fullWidth = false,
  ariaLabel,
}: SecondaryButtonProps) {
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
        {label}
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
      {label}
    </button>
  );
}
