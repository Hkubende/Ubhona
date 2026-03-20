import * as React from "react";
import { cn } from "../../lib/utils";

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
    <section className={cn("ui-surface p-4 sm:p-5", className)}>
      {title || description || actions ? (
        <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
          <div>
            {title ? <h2 className="text-lg font-black tracking-tight text-text-primary">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-text-secondary/80">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
