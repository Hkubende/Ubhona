export const colors = {
  background: "#050505",
  surface: "#0D0B0B",
  elevatedSurface: "#141010",
  sidebar: "#0D0B0B",
  primary: "#FF6A1A",
  primaryHover: "#FF7F33",
  secondaryAccent: "#1BC47D",
  mintPrimary: "#2EE6A6",
  mintSecondary: "#1BC47D",
  muted: "#B8AEA3",
  textPrimary: "#F7F1E8",
  textSecondary: "#B8AEA3",
  success: "#2EE6A6",
  successStrong: "#1BC47D",
  warning: "#FF6A1A",
  error: "#D36A59",
} as const;

export const colorClasses = {
  surface: "bg-app-surface text-text-primary",
  mutedSurface: "bg-black/20 text-text-secondary/78",
  accentSurface: "bg-primary/12 text-text-primary",
  border: "border border-border",
  subtleBorder: "border border-white/10",
} as const;
