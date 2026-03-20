import * as React from "react";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        tokens.classes.input,
        "shadow-[inset_0_1px_0_rgba(255,248,241,0.05)]",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
