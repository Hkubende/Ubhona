import * as React from "react";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { spacing, tokens } from "../../design-system";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { SectionHeader } from "./dashboard-primitives";

export type OnboardingChecklistItem = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  to?: string;
  ctaLabel?: string;
};

export function OnboardingChecklist({
  items,
}: {
  items: OnboardingChecklistItem[];
}) {
  const completed = items.filter((item) => item.complete).length;
  const remaining = items.length - completed;

  return (
    <div className={spacing.stackMd}>
      <SectionHeader
        title="Getting Started"
        subtitle={
          remaining > 0
            ? `${remaining} setup step${remaining === 1 ? "" : "s"} remaining before service is fully ready.`
            : "Core setup is complete. Your restaurant is ready for daily operations."
        }
      />
      <div className="grid gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(tokens.classes.panelInset, "flex flex-wrap items-start justify-between gap-3 px-4 py-3")}
          >
            <div className="flex min-w-0 items-start gap-3">
              {item.complete ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary/60" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">{item.title}</div>
                <div className="mt-1 text-sm text-text-secondary/78">{item.description}</div>
              </div>
            </div>
            {item.to && item.ctaLabel ? (
              <Link to={item.to} className="shrink-0">
                <Button size="sm" variant={item.complete ? "ghost" : "secondary"} className="gap-1.5">
                  {item.ctaLabel}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
          </div>
        ))}
      </div>
      <div className="text-xs text-text-secondary/66">
        Completed {completed} of {items.length} core setup steps.
      </div>
    </div>
  );
}
