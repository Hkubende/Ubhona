export const radiusScale = {
  sm: "rounded-[12px]",
  md: "rounded-[16px]",
  lg: "rounded-[20px]",
  xl: "rounded-[26px]",
  "2xl": "rounded-[30px]",
} as const;

export const radius = {
  sm: radiusScale.sm,
  md: radiusScale.md,
  lg: radiusScale.lg,
  xl: radiusScale.xl,
  panel: radiusScale.xl,
  control: radiusScale.lg,
  chip: radiusScale.lg,
  table: radiusScale.xl,
} as const;
