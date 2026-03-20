import * as React from "react";
import { Button, type ButtonProps } from "./Button";
import { cn } from "../../lib/utils";

type IconButtonProps = Omit<ButtonProps, "size"> & {
  label: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "h-8 w-8 rounded-xl p-0",
  md: "h-10 w-10 rounded-xl p-0",
  lg: "h-12 w-12 rounded-2xl p-0",
} as const;

export function IconButton({
  label,
  className,
  size = "md",
  variant = "secondary",
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size="icon"
      className={cn(sizeMap[size], className)}
      {...props}
    />
  );
}
