import * as React from "react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./Button";

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

const baseClass = cn(
  buttonVariants({ variant: "secondary", size: "lg" }),
  "rounded-[20px] font-semibold"
);

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
