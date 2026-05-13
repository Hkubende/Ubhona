import { UbhonaLogo } from "./ubhona-logo";

type LogoTheme = "light" | "dark";

type DirectionProps = {
  size?: number;
  theme?: LogoTheme;
  className?: string;
  ariaLabel?: string;
};

function ApprovedLogoDirection({ size = 48, theme = "dark", className, ariaLabel }: DirectionProps) {
  return <UbhonaLogo size={size} theme={theme} className={className} ariaLabel={ariaLabel ?? "Approved Ubhona logo"} />;
}

export function PortalULogoDirection(props: DirectionProps) {
  return <ApprovedLogoDirection {...props} ariaLabel={props.ariaLabel ?? "Approved Ubhona logo"} />;
}

export function CubeIntegratedULogoDirection(props: DirectionProps) {
  return <ApprovedLogoDirection {...props} ariaLabel={props.ariaLabel ?? "Approved Ubhona logo"} />;
}

export function MonogramUPortalFrameLogoDirection(props: DirectionProps) {
  return <ApprovedLogoDirection {...props} ariaLabel={props.ariaLabel ?? "Approved Ubhona logo"} />;
}

export function UbhonaLogoDirectionsDemo({ theme = "dark" }: { theme?: LogoTheme }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-text-primary">Approved Ubhona mark</h3>
        <p className="mt-1 text-xs text-text-secondary/80">
          Legacy geometry explorations have been replaced with the production logo used in the favicon, app header,
          onboarding, and customer-facing surfaces.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <UbhonaLogo size={24} theme={theme} decorative />
        <UbhonaLogo size={32} theme={theme} decorative />
        <UbhonaLogo size={48} theme={theme} decorative />
        <UbhonaLogo size={96} theme={theme} decorative />
      </div>
    </div>
  );
}
