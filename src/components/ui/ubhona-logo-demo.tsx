import * as React from "react";
import { UbhonaLogo } from "./ubhona-logo";

export function UbhonaLogoDemo() {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/35 p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-[-0.01em] text-text-primary">Ubhona Logo Demo</h3>
        <p className="mt-1 text-xs text-text-secondary/80">SVG logo system previews across core product placements.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Header</p>
          <div className="mt-3">
            <UbhonaLogo size={32} showWordmark />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Icon</p>
          <div className="mt-3">
            <UbhonaLogo size={40} />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Hero</p>
          <div className="mt-3">
            <UbhonaLogo size={64} showWordmark />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Animated</p>
          <div className="mt-3">
            <UbhonaLogo size={48} animated />
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary/80">Size Check</p>
        <div className="mt-3 flex items-end gap-4">
          <UbhonaLogo size={24} decorative />
          <UbhonaLogo size={32} decorative />
          <UbhonaLogo size={48} decorative />
          <UbhonaLogo size={64} decorative />
        </div>
      </div>
    </section>
  );
}

