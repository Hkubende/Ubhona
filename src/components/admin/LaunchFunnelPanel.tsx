import * as React from "react";
import { DashboardPanel, MetricCard } from "../dashboard/dashboard-primitives";
import { getLaunchSignupFunnel, type LaunchSignupFunnel } from "../../lib/analytics";

export function LaunchFunnelPanel() {
  const [launchFunnel, setLaunchFunnel] = React.useState<LaunchSignupFunnel | null>(null);

  React.useEffect(() => {
    setLaunchFunnel(getLaunchSignupFunnel(30));
  }, []);

  if (!launchFunnel || !Object.values(launchFunnel.totals).some((value) => value > 0)) {
    return null;
  }

  return (
    <DashboardPanel className="mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-text-primary">Launch Funnel</div>
          <div className="mt-1 text-sm text-text-secondary/72">
            Marketing-to-signup flow from the last {launchFunnel.periodDays} days.
          </div>
        </div>
        <div className="rounded-full border border-border bg-white/[0.04] px-3 py-1 text-xs text-text-secondary/72">
          Platform admin readout
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Landing Visits" value={String(launchFunnel.totals.landingVisits)} />
        <MetricCard label="CTA Clicks" value={String(launchFunnel.totals.ctaClicks)} tone="sand" />
        <MetricCard label="Signup Starts" value={String(launchFunnel.totals.signupStarts)} tone="orange" />
        <MetricCard label="Signups" value={String(launchFunnel.totals.signupCompletions)} tone="emerald" />
        <MetricCard label="Onboarding Starts" value={String(launchFunnel.totals.onboardingStarts)} tone="sand" />
        <MetricCard label="Onboarding Complete" value={String(launchFunnel.totals.onboardingCompletions)} tone="emerald" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/72">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
          Visit to CTA: {Math.round(launchFunnel.rates.ctaClickRate)}%
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
          CTA to signup start: {Math.round(launchFunnel.rates.signupStartRate)}%
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
          Signup completion: {Math.round(launchFunnel.rates.signupCompletionRate)}%
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
          Onboarding completion: {Math.round(launchFunnel.rates.onboardingCompletionRate)}%
        </span>
      </div>
    </DashboardPanel>
  );
}
