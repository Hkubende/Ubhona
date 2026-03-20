import * as React from "react";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          `${tokens.classes.input} min-h-28 resize-y`,
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
