import { UbhonaLogo as ApprovedUbhonaLogo, type UbhonaLogoProps } from "./ubhona-logo";

type BaseLogoProps = Omit<UbhonaLogoProps, "decorative" | "variant">;

export function UbhonaLogo(props: BaseLogoProps) {
  return <ApprovedUbhonaLogo {...props} />;
}

export function AnimatedUbhonaLogo(props: BaseLogoProps) {
  return <ApprovedUbhonaLogo {...props} animated />;
}

export function UbhonaLogoDemo() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Approved icon</p>
        <div className="flex items-end gap-3">
          <ApprovedUbhonaLogo size={24} decorative />
          <ApprovedUbhonaLogo size={32} decorative />
          <ApprovedUbhonaLogo size={48} decorative />
          <ApprovedUbhonaLogo size={64} decorative />
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Wordmark lockup</p>
        <ApprovedUbhonaLogo size={40} showWordmark />
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Motion-ready</p>
        <ApprovedUbhonaLogo size={48} animated />
      </div>
    </div>
  );
}
