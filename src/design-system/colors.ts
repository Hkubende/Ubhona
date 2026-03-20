export const colors = {
  background: "#050505",
  surface: "#0D0B0B",
  elevatedSurface: "#141010",
  sidebar: "#0D0B0B",
  primary: "#E4572E",
  primaryHover: "#C54520",
  secondaryAccent: "#F58A1F",
  muted: "#B8AEA3",
  textPrimary: "#F7F1E8",
  textSecondary: "#B8AEA3",
  success: "#F58A1F",
  warning: "#F58A1F",
  error: "#D36A59",
} as const;

export const colorClasses = {
  surface: "bg-app-surface text-text-primary",
  mutedSurface: "bg-black/20 text-text-secondary/78",
  accentSurface: "bg-primary/12 text-text-primary",
  border: "border border-border",
  subtleBorder: "border border-white/10",
} as const;
