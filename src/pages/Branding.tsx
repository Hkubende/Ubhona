import * as React from "react";
import UploadField from "../components/uploads/UploadField";
import { DashboardLayout } from "../components/dashboard/dashboard-layout";
import {
  DashboardPanel,
  EmptyStateCard,
  PageContainer,
  SectionHeader,
} from "../components/dashboard/dashboard-primitives";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { UbhonaLogoDemo } from "../components/ui/UbhonaLogo";
import { UbhonaLogoDirectionsDemo } from "../components/ui/UbhonaLogoDirections";
import { getFeatureGate, saveRestaurantProfile, type RestaurantProfile } from "../lib/restaurant";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import { cn } from "../lib/utils";
import { spacing, tokens, typography } from "../design-system";
import { Link } from "react-router-dom";
import { getQrCodeImageUrl, getStorefrontMenuUrl } from "../lib/qr";

export default function Branding() {
  const { data, loading, error: dataError, refresh } = useRestaurantDashboard();
  const [profile, setProfile] = React.useState<RestaurantProfile | null>(null);
  const [logo, setLogo] = React.useState("");
  const [coverImage, setCoverImage] = React.useState("");
  const [themePrimary, setThemePrimary] = React.useState("#FF6A1A");
  const [shortDescription, setShortDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    const mapped: RestaurantProfile = {
      id: data.restaurant.id,
      restaurantName: data.restaurant.name,
      slug: data.restaurant.slug,
      phone: data.restaurant.phone,
      email: data.restaurant.email,
      location: data.restaurant.location,
      logo: data.brandingSettings.logoUrl || data.restaurant.logoUrl || "",
      coverImage: data.brandingSettings.coverImageUrl || data.restaurant.coverImageUrl || "",
      themePrimary: data.brandingSettings.primaryColor || data.restaurant.primaryColor || "#FF6A1A",
      themeSecondary: "#E8D8C3",
      shortDescription: data.brandingSettings.description || data.restaurant.description || "",
      subscriptionPlan: data.restaurant.subscriptionPlan || "starter",
      subscriptionStatus: data.restaurant.subscriptionStatus || "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
    setProfile(mapped);
    setLogo(mapped.logo || "");
    setCoverImage(mapped.coverImage || "");
    setThemePrimary(mapped.themePrimary || "#FF6A1A");
    setShortDescription(mapped.shortDescription || "");
  }, [data]);

  const preview = React.useMemo(
    () => ({
      logoUrl: logo || `${import.meta.env.BASE_URL}ubhona-logo.jpeg`,
      coverImageUrl: coverImage || "",
      primary: themePrimary || "#FF6A1A",
      secondary: "#E8D8C3",
      shortDescription: shortDescription || "Visualize",
    }),
    [coverImage, logo, shortDescription, themePrimary]
  );
  const customBrandingGate = React.useMemo(() => getFeatureGate("customBranding", profile), [profile]);
  const storefrontUrl = React.useMemo(
    () => (profile?.slug ? getStorefrontMenuUrl(profile.slug) : ""),
    [profile?.slug]
  );
  const qrCodeUrl = React.useMemo(
    () => (storefrontUrl ? getQrCodeImageUrl(storefrontUrl, 220) : ""),
    [storefrontUrl]
  );
  const copyStorefrontUrl = async () => {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setNotice("Storefront link copied.");
    } catch {
      setError("Could not copy link. You can copy it manually below.");
    }
  };
  const printQrCard = React.useCallback(() => {
    if (!qrCodeUrl || !profile) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=720,height=840");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${profile.restaurantName} Menu QR</title>
          <style>
            body { margin: 0; font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif; background: #0b0909; color: #f7f1e8; }
            .wrap { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
            .card { width: min(420px, 100%); border: 1px solid rgba(255,255,255,.12); border-radius: 20px; background: #141010; text-align: center; padding: 24px; }
            h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.02em; }
            p { margin: 0 0 16px; color: #b8aea3; font-size: 14px; }
            img { width: 260px; height: 260px; border-radius: 16px; border: 1px solid rgba(255,255,255,.1); background: #fff; }
            .link { margin-top: 14px; font-size: 12px; word-break: break-all; color: #d8d0c7; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="card">
              <h1>${profile.restaurantName}</h1>
              <p>Scan to open the live menu</p>
              <img src="${qrCodeUrl}" alt="Menu QR" />
              <div class="link">${storefrontUrl}</div>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [profile, qrCodeUrl, storefrontUrl]);

  const saveBranding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customBrandingGate.enabled) {
      setError(customBrandingGate.message);
      return;
    }
    if (!profile) {
      setError("Restaurant profile not found.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const next = await saveRestaurantProfile({
        restaurantName: profile.restaurantName,
        slug: profile.slug,
        phone: profile.phone,
        email: profile.email,
        location: profile.location,
        logo,
        coverImage,
        themePrimary,
        themeSecondary: profile.themeSecondary,
        shortDescription,
        subscriptionPlan: profile.subscriptionPlan,
        subscriptionStatus: profile.subscriptionStatus,
      });
      setProfile(next);
      setNotice("Branding saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      profile={profile}
      title="Branding"
      subtitle="Manage your restaurant identity, colors, and storefront visuals."
    >
      <PageContainer>
      <DashboardPanel>
        <SectionHeader title="Live Brand Preview" subtitle="Preview how your storefront branding will appear." />
        <div
          className={cn(tokens.classes.previewFrame, "p-5")}
          style={{
            background: preview.coverImageUrl
              ? `linear-gradient(135deg, ${preview.primary}66 0%, rgba(8,8,12,0.8) 45%, ${preview.secondary}55 100%), url(${preview.coverImageUrl}) center/cover no-repeat`
              : `linear-gradient(135deg, ${preview.primary}33 0%, rgba(255,255,255,0.03) 45%, ${preview.secondary}24 100%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <img src={preview.logoUrl} alt="Brand logo" className="h-12 w-12 rounded-2xl object-cover" />
            <div>
              <div className="text-xl font-semibold" style={{ color: preview.primary }}>
                {profile?.restaurantName || "Your Restaurant"}
              </div>
              <div className={typography.body}>{preview.shortDescription}</div>
            </div>
          </div>
        </div>
      </DashboardPanel>

      <DashboardPanel>
        <SectionHeader title="Brand Controls" subtitle="Update logo, cover image, color, and description." />
        {!customBrandingGate.enabled ? (
          <div className="mb-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {customBrandingGate.message}{" "}
            <Link to="/pricing" className="font-semibold text-orange-300 underline-offset-2 hover:underline">
              Upgrade plan
            </Link>
          </div>
        ) : null}
        {loading ? (
          <div className={spacing.stackSm}>
            <div className="h-3 w-44 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-72 animate-pulse rounded bg-white/10" />
          </div>
        ) : null}
        {dataError ? <EmptyStateCard message={dataError} /> : null}
        <form onSubmit={saveBranding} className="grid gap-4 md:grid-cols-2">
          <div>
            <div className={cn("mb-1", typography.label)}>Logo URL</div>
            <Input
              id="branding-logo-url"
              name="logoUrl"
              value={logo}
              onChange={(event) => setLogo(event.target.value)}
              placeholder="https://.../logo.jpg"
              disabled={!customBrandingGate.enabled}
            />
            <UploadField
              label="Upload Logo"
              assetType="logo"
              accept="image/png,image/jpeg,image/webp"
              value={logo}
              onUploaded={setLogo}
              className="mt-2"
              disabled={!customBrandingGate.enabled}
            />
          </div>
          <div>
            <div className={cn("mb-1", typography.label)}>Cover Image URL</div>
            <Input
              id="branding-cover-url"
              name="coverImageUrl"
              value={coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              placeholder="https://.../cover.jpg"
              disabled={!customBrandingGate.enabled}
            />
            <UploadField
              label="Upload Cover"
              assetType="cover"
              accept="image/png,image/jpeg,image/webp"
              value={coverImage}
              onUploaded={setCoverImage}
              className="mt-2"
              disabled={!customBrandingGate.enabled}
            />
          </div>
          <div>
            <div className={cn("mb-1", typography.label)}>Primary Color</div>
            <Input
              id="branding-primary-color"
              name="primaryColor"
              value={themePrimary}
              onChange={(event) => setThemePrimary(event.target.value)}
              placeholder="#FF6A1A"
              disabled={!customBrandingGate.enabled}
            />
          </div>
          <div className="md:col-span-2">
            <div className={cn("mb-1", typography.label)}>Restaurant Description</div>
            <Textarea
              id="branding-description"
              name="description"
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value)}
              rows={3}
              disabled={!customBrandingGate.enabled}
            />
          </div>
          {notice ? (
            <div className="md:col-span-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="md:col-span-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          <Button
            type="submit"
            disabled={saving || !profile}
            variant="primary"
            size="lg"
            className="md:col-span-2"
          >
            {saving ? "Saving..." : "Save Branding"}
          </Button>
        </form>
      </DashboardPanel>
      <DashboardPanel className="space-y-4">
        <SectionHeader title="Menu QR Distribution" subtitle="Generate polished QR assets for tables, counters, and printed promos." />
        {!storefrontUrl ? (
          <EmptyStateCard message="Storefront URL will appear after restaurant profile is configured." />
        ) : (
          <div className="grid gap-5 md:grid-cols-[250px_minmax(0,1fr)] md:items-start">
            <div className={cn(tokens.classes.previewFrame, "bg-gradient-to-b from-[#1c1512] to-[#120f0e] p-3.5")}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-text-secondary/78">Menu QR</div>
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Restaurant menu QR code" className="h-[220px] w-[220px] rounded-xl border border-white/14 bg-white p-1.5 shadow-[0_10px_26px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.05)]" />
              ) : null}
            </div>
            <div className={cn(spacing.stackSm, "pt-0.5 text-sm")}>
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">Ready to share</h3>
                <p className="mt-1 text-sm text-text-secondary/80">
                  Use this code to send guests straight to your live menu without extra steps.
                </p>
              </div>
              <div className={cn("rounded-xl border border-white/14 bg-black/35 px-3 py-2.5 font-medium text-xs break-all text-text-primary/88", typography.body)}>
                {storefrontUrl}
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Button variant="secondary" size="sm" className="border-white/20 bg-white/[0.06] hover:bg-white/[0.09]" onClick={() => void copyStorefrontUrl()}>
                  Copy Menu Link
                </Button>
                <a href={storefrontUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">Open Menu</Button>
                </a>
                {qrCodeUrl ? (
                  <a href={qrCodeUrl} download={`${profile?.slug || "ubhona"}-menu-qr.png`}>
                    <Button variant="outline" size="sm">Download QR</Button>
                  </a>
                ) : null}
                <Button variant="ghost" size="sm" className="text-text-secondary hover:text-text-primary" onClick={printQrCard}>
                  Print QR
                </Button>
              </div>
              <p className="text-xs text-text-secondary/74">
                Built for practical distribution: print on table cards, place at the counter, and use in social promos.
              </p>
            </div>
          </div>
        )}
      </DashboardPanel>
      <DashboardPanel>
        <SectionHeader
          title="Logo System Preview"
          subtitle="Reusable Ubhona logo variants for navbar, hero, and product headers."
        />
        <UbhonaLogoDemo />
      </DashboardPanel>
      <DashboardPanel>
        <SectionHeader
          title="Logo Geometry Directions"
          subtitle="Three premium SVG geometry directions compared at 24, 32, 48, and 96."
        />
        <UbhonaLogoDirectionsDemo theme="dark" />
      </DashboardPanel>
      </PageContainer>
    </DashboardLayout>
  );
}
