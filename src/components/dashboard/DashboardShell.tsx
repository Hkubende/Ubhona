import * as React from "react";
import { LayoutDashboard, MenuSquare, Package, Settings, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { getRestaurantBranding, type RestaurantProfile } from "../../lib/restaurant";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

export type DashboardShellSection = {
  id: string;
  title: string;
  description: string;
};

const SIDEBAR_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "menu", label: "Menu", icon: MenuSquare },
  { id: "orders", label: "Orders", icon: Package },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

function ProfileSummary({ profile }: { profile: RestaurantProfile | null }) {
  const branding = getRestaurantBranding(profile);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-3">
        <img
          src={branding.logoUrl || LOGO_SRC}
          alt={profile?.restaurantName || "Ubhona"}
          className="h-12 w-12 rounded-2xl object-cover"
        />
        <div>
          <div className="text-sm text-white/60">Restaurant Profile</div>
          <div className="text-lg font-black" style={{ color: branding.primary }}>
            {profile?.restaurantName || "Your Restaurant"}
          </div>
          <div className="text-xs text-white/55">{branding.shortDescription}</div>
        </div>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-white/80">
          <span className="text-white/50">Slug:</span> {profile?.slug || "not-set"}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-white/80">
          <span className="text-white/50">Email:</span> {profile?.email || "not-set"}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-white/80">
          <span className="text-white/50">Phone:</span> {profile?.phone || "not-set"}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-white/80">
          <span className="text-white/50">Location:</span> {profile?.location || "not-set"}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: DashboardShellSection }) {
  return (
    <section id={section.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-black text-orange-300">{section.title}</h2>
      <p className="mt-2 text-sm text-white/65">{section.description}</p>
      <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/55">
        Placeholder content for {section.title}.
      </div>
    </section>
  );
}

export function DashboardShell({
  profile,
  sections,
}: {
  profile: RestaurantProfile | null;
  sections: DashboardShellSection[];
}) {
  const branding = getRestaurantBranding(profile);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="rounded-3xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl lg:w-72 lg:shrink-0">
          <div className="mb-4 flex items-center gap-3">
            <img src={LOGO_SRC} alt="Ubhona" className="h-10 w-10 rounded-2xl object-cover" />
            <div>
              <div className="text-lg font-black">
                <span className="text-orange-400">Ubhona</span> Dashboard
              </div>
              <div className="text-xs text-white/55">Restaurant Console</div>
            </div>
          </div>

          <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
                >
                  <Icon className="h-4 w-4 text-orange-300" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <header className="rounded-3xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-white/60">Welcome back</div>
                <div className="text-2xl font-black" style={{ color: branding.primary }}>
                  {profile?.restaurantName || "Restaurant Team"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200">
                  <Store className="h-3.5 w-3.5" />
                  Protected Restaurant Area
                </div>
                <Link
                  to="/app/menu"
                  className="rounded-full border border-orange-400/30 bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-100 hover:bg-orange-500/30"
                >
                  Open Menu Manager
                </Link>
                <Link
                  to="/app/orders"
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80 hover:bg-white/15"
                >
                  View Orders
                </Link>
              </div>
            </div>
          </header>

          <ProfileSummary profile={profile} />

          <div className="grid gap-4">
            {sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
