import * as React from "react";
import { cn } from "../../lib/utils";

type LogoTheme = "light" | "dark";

type DirectionProps = {
  size?: number;
  theme?: LogoTheme;
  className?: string;
  ariaLabel?: string;
};

const PALETTE: Record<LogoTheme, { portal: string; ring: string; cube: string; cubeSide: string; bg: string }> = {
  dark: {
    portal: "#F7F1E8",
    ring: "rgba(255, 106, 26, 0.32)",
    cube: "#FF6A1A",
    cubeSide: "#E85C14",
    bg: "rgba(255,255,255,0.04)",
  },
  light: {
    portal: "#111111",
    ring: "rgba(232, 92, 20, 0.24)",
    cube: "#FF6A1A",
    cubeSide: "#E85C14",
    bg: "rgba(0,0,0,0.04)",
  },
};

function IconShell({
  size,
  theme,
  className,
  ariaLabel,
  children,
}: DirectionProps & { size: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      focusable="false"
    >
      <rect x="8" y="8" width="84" height="84" rx="20" fill={PALETTE[theme ?? "dark"].bg} />
      {children}
    </svg>
  );
}

export function PortalULogoDirection({ size = 48, theme = "dark", className, ariaLabel }: DirectionProps) {
  const colors = PALETTE[theme];
  return (
    <IconShell size={size} theme={theme} className={className} ariaLabel={ariaLabel}>
      <ellipse cx="50" cy="38" rx="16" ry="10" fill={colors.ring} />
      <circle cx="50" cy="38" r="9" fill="none" stroke={colors.ring} strokeWidth="1.8" />
      <path
        d="M24 20V58C24 72.359 35.641 84 50 84C64.359 84 76 72.359 76 58V20"
        fill="none"
        stroke={colors.portal}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="50,43 60,49 50,55 40,49" fill="#FF9B63" />
      <polygon points="40,49 50,55 50,67 40,61" fill={colors.cubeSide} />
      <polygon points="60,49 50,55 50,67 60,61" fill={colors.cube} />
    </IconShell>
  );
}

export function CubeIntegratedULogoDirection({ size = 48, theme = "dark", className, ariaLabel }: DirectionProps) {
  const colors = PALETTE[theme];
  return (
    <IconShell size={size} theme={theme} className={className} ariaLabel={ariaLabel}>
      <path
        d="M24 20V58C24 72.359 35.641 84 50 84C64.359 84 76 72.359 76 58V20"
        fill="none"
        stroke={colors.portal}
        strokeWidth="13.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M38 57L50 50L62 57L50 64L38 57Z" fill={colors.cube} />
      <path d="M38 57L50 64V74L38 67V57Z" fill={colors.cubeSide} />
      <path d="M62 57L50 64V74L62 67V57Z" fill="#FF8A43" />
      <path d="M50 50V64" stroke={theme === "dark" ? "#2A1B14" : "#7A2E12"} strokeWidth="2" strokeLinecap="round" />
      <path d="M50 64V74" stroke={theme === "dark" ? "#2A1B14" : "#7A2E12"} strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="39" r="8.5" fill="none" stroke={colors.ring} strokeWidth="1.6" />
    </IconShell>
  );
}

export function MonogramUPortalFrameLogoDirection({
  size = 48,
  theme = "dark",
  className,
  ariaLabel,
}: DirectionProps) {
  const colors = PALETTE[theme];
  return (
    <IconShell size={size} theme={theme} className={className} ariaLabel={ariaLabel}>
      <rect x="24" y="18" width="52" height="64" rx="22" fill="none" stroke={colors.portal} strokeWidth="10" />
      <path d="M39 18H61" stroke={theme === "dark" ? "#0D0B0B" : "#ffffff"} strokeWidth="12" strokeLinecap="round" />
      <path d="M38 35V56C38 62.627 43.373 68 50 68C56.627 68 62 62.627 62 56V35" fill="none" stroke={colors.portal} strokeWidth="8" strokeLinecap="round" />
      <rect x="45" y="46" width="10" height="10" rx="2.5" fill={colors.cube} />
      <circle cx="50" cy="36" r="7" fill="none" stroke={colors.ring} strokeWidth="1.4" />
    </IconShell>
  );
}

type DirectionCard = {
  id: string;
  title: string;
  note: string;
  render: (size: number) => React.ReactNode;
};

export function UbhonaLogoDirectionsDemo({ theme = "dark" }: { theme?: LogoTheme }) {
  const cards: DirectionCard[] = [
    {
      id: "portal-u",
      title: "Portal U",
      note: "Clearest gateway symbol. Strongest immediate recognition.",
      render: (size) => <PortalULogoDirection size={size} theme={theme} ariaLabel="Portal U direction" />,
    },
    {
      id: "cube-integrated-u",
      title: "Cube-Integrated U",
      note: "Most product-system feel. Cube is structurally embedded.",
      render: (size) => <CubeIntegratedULogoDirection size={size} theme={theme} ariaLabel="Cube-integrated U direction" />,
    },
    {
      id: "monogram-frame",
      title: "Monogram U Portal Frame",
      note: "Most mature and premium. Framed spatial monogram style.",
      render: (size) => <MonogramUPortalFrameLogoDirection size={size} theme={theme} ariaLabel="Monogram portal frame direction" />,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-text-primary">{card.title}</h3>
            <p className="mt-1 text-xs text-text-secondary/80">{card.note}</p>
          </div>
          <div className="flex items-end gap-3">
            {card.render(24)}
            {card.render(32)}
            {card.render(48)}
          </div>
          <div className="mt-3">{card.render(96)}</div>
        </div>
      ))}
    </div>
  );
}
