import * as React from "react";
import { cn } from "../../lib/utils";
import { spacing, typography } from "../../design-system";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn(`flex items-start justify-between ${spacing.gapMd}`, className)}>
      <div>
        <h2 className={cn("text-text-primary", typography.subSectionTitle)}>{title}</h2>
        {subtitle ? <p className={cn("mt-1", typography.mutedBody)}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
