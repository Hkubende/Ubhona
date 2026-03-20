import * as React from "react";
import { cn } from "../../lib/utils";
import { spacing, tokens } from "../../design-system";

type AppShellProps = {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function AppShell({ sidebar, topbar, children, className }: AppShellProps) {
  return (
    <div className={cn(tokens.classes.appShell, className)}>
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
