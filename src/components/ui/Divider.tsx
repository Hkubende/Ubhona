import * as React from "react";
import { cn } from "../../lib/utils";

type DividerProps = {
  className?: string;
  orientation?: "horizontal" | "vertical";
};

export function Divider({ className, orientation = "horizontal" }: DividerProps) {
  return (
    <div
      className={cn(
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        "bg-border/80",
        className
      )}
      role="separator"
      aria-orientation={orientation}
    />
  );
}
