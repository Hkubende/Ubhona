export const colors = {
  background: "#F4EFE8",
  surface: "#FFFFFF",
  elevatedSurface: "#FFFAF5",
  interactiveSurface: "#F7F1EA",
  sidebar: "#F6EFE7",
  primary: "#FF6A1A",
  primaryHover: "#F06F1F",
  secondaryAccent: "#1BC47D",
  mintPrimary: "#2EE6A6",
  mintSecondary: "#1BC47D",
  muted: "#5F5044",
  textPrimary: "#231A14",
  textSecondary: "#5F5044",
  success: "#1A9F71",
  successStrong: "#0F7B55",
  warning: "#FF6A1A",
  error: "#BF5848",
  borderSubtle: "rgba(35,26,20,0.12)",
  borderStrong: "rgba(35,26,20,0.18)",
} as const;

export const colorClasses = {
  surface: "bg-app-surface text-text-primary",
  mutedSurface: "bg-[color:var(--ui-note-icon-bg)] text-text-secondary/82",
  accentSurface: "bg-primary/16 text-text-primary",
  border: "border border-border",
  subtleBorder: "border border-[color:var(--color-border)]",
} as const;
