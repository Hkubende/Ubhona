export const shadowScale = {
  soft: "shadow-subtle",
  raised: "shadow-soft",
  ambient: "shadow-medium",
  glow: "shadow-elevated",
} as const;

export const shadows = {
  panel: shadowScale.raised,
  control: shadowScale.soft,
  ambient: shadowScale.ambient,
  glow: shadowScale.glow,
} as const;
