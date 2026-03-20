export const radiusScale = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
} as const;

export const radius = {
  panel: radiusScale.xl,
  control: radiusScale.lg,
  chip: radiusScale.xl,
  table: radiusScale.xl,
} as const;
