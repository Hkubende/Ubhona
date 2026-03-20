import * as React from "react";
import { cn } from "../../lib/utils";
import { radius, spacing, tokens, typography } from "../../design-system";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn(spacing.stackXl, className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(`flex flex-wrap items-start justify-between ${spacing.gapMd}`, className)}>
      <div>
        <h2 className={typography.sectionTitle}>{title}</h2>
        {subtitle ? <p className={cn("mt-1", typography.body)}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="inline-flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageSection({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(`grid grid-cols-1 ${spacing.gapLg} md:grid-cols-2 xl:[grid-template-columns:repeat(24,minmax(0,1fr))]`, className)}
    >
      {children}
    </section>
  );
}

export function ContentGrid({
  className,
  children,
  columns = "auto",
}: {
  className?: string;
  children: React.ReactNode;
  columns?: "auto" | "metrics" | "two" | "three" | "four";
}) {
  const columnClasses =
    columns === "metrics"
      ? "grid-cols-2 xl:grid-cols-4"
      : columns === "two"
        ? "grid-cols-1 xl:grid-cols-2"
        : columns === "three"
          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          : columns === "four"
            ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
            : "grid-cols-1";
  return <div className={cn(`grid ${spacing.gapLg}`, columnClasses, className)}>{children}</div>;
}

export function ContentCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        `${tokens.classes.panel} transition duration-300 ease-out hover:border-border/90`,
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function DashboardPanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return <ContentCard className={className} {...props}>{children}</ContentCard>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between", spacing.gapMd)}>
      <div>
        <h2 className={cn("text-text-primary", typography.subSectionTitle)}>{title}</h2>
        {subtitle ? <p className={cn("mt-1", typography.mutedBody)}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(`flex flex-wrap items-center justify-between ${spacing.gapMd}`, className)}>
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "orange" | "emerald" | "sand";
}) {
  const toneMap = {
    default: "text-text-primary",
    orange: "text-primary",
    emerald: "text-success",
    sand: "text-text-secondary",
  } as const;
  return (
    <div className={cn("ui-surface-soft p-3 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/20", radius.panel)}>
      <div className={typography.label}>{label}</div>
      <div className={cn("mt-1 text-[1.25rem] font-semibold tracking-[-0.03em]", toneMap[tone])}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant =
    normalized === "completed"
      ? "success"
      : normalized === "ready"
        ? "accent"
        : normalized === "preparing"
          ? "warning"
          : normalized === "confirmed"
            ? "neutral"
            : "neutral";
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}

export function EmptyStateCard({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className={cn(
        `${radius.panel} border border-dashed border-border bg-background/30 p-4 text-sm leading-6 text-text-secondary/75`
      )}
    >
      <div>{message}</div>
      {actionLabel && onAction ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DataTable({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn(`overflow-x-auto ${tokens.classes.tableShell}`, className)}>{children}</div>;
}
