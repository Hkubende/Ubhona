import * as React from "react";
import { cn } from "../../lib/utils";
import { radius, typography } from "../../design-system";

type StatCardProps = {
  label: string;
  value: string;
  tone?: "default" | "orange" | "emerald" | "sand";
  className?: string;
};

const toneMap = {
  default: "text-text-primary",
  orange: "text-primary",
  emerald: "text-success",
  sand: "text-text-secondary",
} as const;

export function StatCard({ label, value, tone = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "ui-surface-soft p-4 sm:p-5 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[color:var(--color-border-strong)]",
        radius.panel,
        className
      )}
    >
      <div className={typography.label}>{label}</div>
      <div className={cn("mt-2.5 text-[1.35rem] font-semibold tracking-[-0.035em]", toneMap[tone])}>{value}</div>
    </div>
  );
}
