import * as React from "react";
import { cn } from "../../lib/utils";

type ContentGridProps = {
  children: React.ReactNode;
  className?: string;
  columns?: "one" | "two" | "three" | "four" | "metrics";
};

export function ContentGrid({ children, className, columns = "one" }: ContentGridProps) {
  const map = {
    one: "grid-cols-1",
    two: "grid-cols-1 xl:grid-cols-2",
    three: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    four: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
    metrics: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  } as const;
  return <div className={cn("grid gap-4", map[columns], className)}>{children}</div>;
}
