import * as React from "react";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        `${tokens.classes.surfaceElevated} ${tokens.motion.gentle}`,
        className
      )}
      {...props}
    />
  );
}
