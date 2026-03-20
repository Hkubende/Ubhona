import { colorClasses, colors } from "./colors";
import { motion } from "./motion";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { spacing } from "./spacing";
import { typography } from "./typography";

export const designSystemRules = [
  "Use one primary action per surface and avoid duplicate controls.",
  "Keep sections single-purpose and prefer horizontal workspace layouts.",
  "Use defined spacing tokens instead of ad hoc spacing.",
  "Prefer subtle contrast, soft elevation, and minimal redundant labels.",
  "Keep edit flows in-place; avoid navigation for routine CRUD edits.",
  "Use burnt orange only for primary emphasis, active state, and meaningful highlights.",
  "Keep dark coffee for framing surfaces and use ivory-sand tones to improve readability.",
  "Motion should feel restrained, warm, and intentional rather than decorative.",
] as const;

export const tokens = {
  colors,
  motion,
  spacing,
  typography,
  radius,
  shadows,
  classes: {
    appShell: `min-h-screen bg-app-bg text-text-primary`,
    pageShell: `mx-auto flex w-full flex-col ${spacing.gapLg} ${spacing.pagePadding} lg:flex-row`,
    shellFrame: `ui-shell-frame ${radius.panel} ${shadows.ambient}`,
    surface: `ui-surface ${radius.panel} ${shadows.panel}`,
    surfaceSoft: `ui-surface-soft ${radius.panel}`,
    surfaceElevated: `ui-surface-elevated ${radius.panel} ${shadows.glow}`,
    panel: `ui-surface ${radius.panel} ${spacing.panelPadding} ${shadows.panel}`,
    panelInset: `ui-panel-inset ${radius.panel} p-4`,
    actionSurface: `ui-action-surface ${radius.panel}`,
    input:
      `w-full min-h-11 ${radius.control} border border-border bg-[linear-gradient(180deg,rgba(20,16,16,0.98),rgba(13,11,11,0.97))] px-3 py-2.5 text-sm text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none ${motion.standard} placeholder:text-text-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d0b0b] focus-visible:border-primary/45`,
    inputLight:
      `w-full min-h-10 ${radius.control} border border-border bg-[linear-gradient(180deg,rgba(20,16,16,0.98),rgba(13,11,11,0.97))] px-3 py-2.5 text-sm text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none ${motion.standard} placeholder:text-text-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d0b0b] focus-visible:border-primary/45`,
    metricChip: `ui-panel-inset ${radius.panel} px-3 py-2 text-xs text-text-secondary/72`,
    inlineChip: `${radius.panel} border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`,
    tableShell: `ui-table-shell ${radius.panel}`,
    tableHeader: "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-left text-text-secondary/78",
    tableRow: `cursor-pointer border-t border-white/10 align-top ${motion.standard} hover:bg-white/[0.04]`,
    activeRow: "bg-primary/[0.09] shadow-[inset_0_1px_0_rgba(228,87,46,0.18)]",
    categoryChipActive: "border-primary/45 bg-primary/14 text-text-primary shadow-[0_0_0_1px_rgba(228,87,46,0.08),0_10px_24px_rgba(113,47,24,0.16)]",
    categoryChipIdle: `border-white/10 bg-white/[0.03] text-text-secondary/70 ${motion.standard} hover:bg-white/[0.06] hover:text-text-primary`,
    mutedPanelRow: `ui-panel-inset ${radius.panel} flex flex-wrap items-center justify-between px-3 py-2`,
    availabilityControl: `ui-panel-inset ${radius.panel} inline-flex items-center gap-2 px-3 py-2 text-sm text-text-primary/88`,
    previewFrame: `ui-panel-inset ${radius.panel} overflow-hidden`,
    storefrontShell: "ubhona-storefront-shell",
    storefrontHero: "ubhona-storefront-hero",
    storefrontPanel: "ubhona-storefront-panel",
    storefrontFloating: "ubhona-storefront-floating",
    accentRail: "ubhona-accent-rail",
    label: typography.label,
  },
} as const;
