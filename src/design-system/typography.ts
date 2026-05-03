export const typographyScale = {
  h1: "text-[2rem] leading-[1.02] sm:text-[2.5rem] font-extrabold tracking-[-0.038em]",
  h2: "text-[1.15rem] leading-[1.08] sm:text-[1.65rem] font-semibold tracking-[-0.03em]",
  h3: "text-[0.98rem] sm:text-[1.08rem] leading-[1.15] font-semibold tracking-[-0.022em]",
  body: "text-sm leading-6 text-text-secondary/78",
  label: "text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-text-secondary/50",
} as const;

export const typography = {
  pageTitle: `${typographyScale.h1} text-text-primary`,
  sectionTitle: `${typographyScale.h2} text-text-primary`,
  subSectionTitle: `${typographyScale.h3} text-text-primary`,
  body: typographyScale.body,
  mutedBody: "text-sm leading-6 text-text-secondary/64",
  helper: "text-xs leading-5 text-text-secondary/54",
  meta: "text-[11px] leading-5 text-text-secondary/48",
  label: typographyScale.label,
} as const;
