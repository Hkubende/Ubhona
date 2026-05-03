import * as React from "react";
import { cn } from "../../lib/utils";
import { useHeaderScrollBehavior } from "../../hooks/use-header-scroll-behavior";

type TopbarProps = {
  children: React.ReactNode;
  className?: string;
  retractOnScroll?: boolean;
};

export function Topbar({ children, className, retractOnScroll = false }: TopbarProps) {
  const { isVisible, isAtTop } = useHeaderScrollBehavior({ enabled: retractOnScroll });

  return (
    <div className={cn(retractOnScroll && !isVisible && "pointer-events-none")}>
      <header
        className={cn(
          "sticky top-3 z-30 ui-topbar-surface p-4 backdrop-blur-xl transition-[transform,opacity,box-shadow,border-color] duration-300 ease-out",
          retractOnScroll && !isVisible && "-translate-y-[120%] opacity-0",
          retractOnScroll && isVisible && "translate-y-0 opacity-100",
          retractOnScroll && isVisible && !isAtTop && "shadow-[0_16px_28px_rgba(0,0,0,0.32)]",
          className
        )}
      >
        {children}
      </header>
    </div>
  );
}
