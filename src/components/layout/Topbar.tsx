import * as React from "react";
import { cn } from "../../lib/utils";

type TopbarProps = {
  children: React.ReactNode;
  className?: string;
};

export function Topbar({ children, className }: TopbarProps) {
  return (
    <header className={cn("sticky top-3 z-30 ui-topbar-surface p-4 backdrop-blur-xl", className)}>
      {children}
    </header>
  );
}
