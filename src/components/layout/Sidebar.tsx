import * as React from "react";
import { cn } from "../../lib/utils";
import { tokens } from "../../design-system";

type SidebarProps = {
  children: React.ReactNode;
  className?: string;
};

export function Sidebar({ children, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        `hidden shrink-0 rounded-3xl py-5 backdrop-blur-md ${tokens.motion.width} lg:sticky lg:top-6 lg:block lg:h-[calc(100vh-3rem)]`,
        tokens.classes.shellFrame,
        className
      )}
    >
      {children}
    </aside>
  );
}
