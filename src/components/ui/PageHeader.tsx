import * as React from "react";
import { cn } from "../../lib/utils";
import { spacing, typography } from "../../design-system";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn(`flex flex-wrap items-start justify-between ${spacing.gapMd}`, className)}>
      <div>
        <h1 className={typography.pageTitle}>{title}</h1>
        {subtitle ? <p className={cn("mt-2", typography.body)}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={cn("inline-flex items-center", spacing.gapSm)}>{actions}</div> : null}
    </header>
  );
}
