import * as React from "react";
import { cn } from "../../lib/utils";

type LayoutPageContainerProps = {
  className?: string;
  children: React.ReactNode;
};

export function PageContainer({ className, children }: LayoutPageContainerProps) {
  return <section className={cn("space-y-5 lg:space-y-6", className)}>{children}</section>;
}
