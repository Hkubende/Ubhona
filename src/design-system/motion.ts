export const motion = {
  standard: "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-240 ease-[cubic-bezier(0.22,1,0.36,1)]",
  gentle: "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)]",
  panel: "transition-transform transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
  hoverLift: "transition-transform duration-240 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5",
  width: "transition-[width,padding,margin,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
} as const;
