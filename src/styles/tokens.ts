export const tokens = {
  colors: {
    primary: "#E4572E",
    primaryHover: "#CC4A24",
    background: "#FBF6EE",
    surface: "#E8D8C3",
    sidebar: "#2B1E17",
    appBg: "#0B0B10",
    appSurface: "rgba(255,255,255,0.04)",
    textPrimary: "#FBF6EE",
    textSecondary: "#E8D8C3",
    border: "rgba(232,216,195,0.24)",
    success: "#34D399",
    warning: "#F59E0B",
    error: "#F87171",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    full: "9999px",
  },
  shadows: {
    subtle: "0 4px 12px rgba(0,0,0,0.15)",
    medium: "0 8px 24px rgba(0,0,0,0.2)",
    elevated: "0 14px 40px rgba(0,0,0,0.28)",
  },
  typography: {
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.65,
    },
  },
} as const;

export type DesignTokens = typeof tokens;
