import * as React from "react";
import { cn } from "../../lib/utils";
import { typography } from "../../design-system";

type SectionContainerProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SectionContainer({
  title,
  description,
  actions,
  children,
  className,
}: SectionContainerProps) {
  return (
    <section className={cn("ui-surface p-4 sm:p-5 lg:p-6", className)}>
      {title || description || actions ? (
        <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
          <div>
            {title ? <h2 className={typography.subSectionTitle}>{title}</h2> : null}
            {description ? <p className={cn("mt-1.5", typography.mutedBody)}>{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
