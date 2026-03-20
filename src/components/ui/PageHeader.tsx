import * as React from "react";
import { cn } from "../../lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        <h1 className="ui-title">{title}</h1>
        {subtitle ? <p className="ui-subtitle mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="inline-flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
