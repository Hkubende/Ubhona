import * as React from "react";
import { cn } from "../../lib/utils";
import { spacing, tokens } from "../../design-system";

type AppLayoutProps = {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function AppLayout({ sidebar, topbar, children, className }: AppLayoutProps) {
  return (
    <div className={cn(tokens.classes.appShell, "overscroll-y-contain", className)}>
      <div className={cn(tokens.classes.pageShell, spacing.gapLg)}>
        {sidebar}
        <main className={cn("min-w-0 flex-1", spacing.stackLg)}>
          {topbar}
          {children}
        </main>
      </div>
    </div>
  );
}
