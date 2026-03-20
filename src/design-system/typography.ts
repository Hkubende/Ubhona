export const typographyScale = {
  h1: "text-3xl font-extrabold tracking-[-0.03em]",
  h2: "text-2xl font-semibold tracking-[-0.02em]",
  h3: "text-lg font-semibold tracking-[-0.015em]",
  body: "text-sm leading-6 text-text-secondary/86",
  label: "text-xs uppercase tracking-[0.16em] text-text-secondary/70",
} as const;

export const typography = {
  pageTitle: `${typographyScale.h1} text-text-primary`,
  sectionTitle: `${typographyScale.h2} text-text-primary`,
  subSectionTitle: `${typographyScale.h3} text-text-primary`,
  body: typographyScale.body,
  mutedBody: "text-sm leading-5 text-text-secondary/76",
  label: typographyScale.label,
} as const;
