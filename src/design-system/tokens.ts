import { colors } from "./colors";
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
  "Use vibrant orange only for primary emphasis, active state, and meaningful highlights.",
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
      `ui-input-control w-full min-h-11 ${radius.control} px-4 py-2.5 text-sm text-text-primary outline-none ${motion.standard} placeholder:text-text-secondary/46 focus-visible:ring-2 focus-visible:ring-primary/16 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] focus-visible:border-primary/18`,
    inputLight:
      `ui-input-control w-full min-h-10 ${radius.control} px-4 py-2.5 text-sm text-text-primary outline-none ${motion.standard} placeholder:text-text-secondary/46 focus-visible:ring-2 focus-visible:ring-primary/16 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--focus-ring-offset)] focus-visible:border-primary/18`,
    metricChip: `ui-panel-inset ${radius.chip} px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary/62`,
    inlineChip: `ui-inline-chip ${radius.chip} px-3 py-1.5 text-[11px] font-medium text-text-secondary/66`,
    tableShell: `ui-table-shell ${radius.panel}`,
    tableHeader: "ui-table-header text-left text-text-secondary/78",
    tableRow: `ui-table-row cursor-pointer align-top ${motion.standard}`,
    activeRow: "ui-table-row-active",
    categoryChipActive: "ui-category-chip-active text-text-primary",
    categoryChipIdle: `ui-category-chip-idle text-text-secondary/62 ${motion.standard} hover:text-text-primary`,
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
