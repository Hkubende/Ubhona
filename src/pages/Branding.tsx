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
import { saveRestaurantProfile, type RestaurantProfile } from "../lib/restaurant";
import { useRestaurantDashboard } from "../hooks/use-restaurant-dashboard";
import { cn } from "../lib/utils";
import { spacing, tokens, typography } from "../design-system";

export default function Branding() {
  const { data, loading, error: dataError, refresh } = useRestaurantDashboard();
  const [profile, setProfile] = React.useState<RestaurantProfile | null>(null);
  const [logo, setLogo] = React.useState("");
  const [coverImage, setCoverImage] = React.useState("");
  const [themePrimary, setThemePrimary] = React.useState("#E4572E");
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
      themePrimary: data.brandingSettings.primaryColor || data.restaurant.primaryColor || "#E4572E",
      themeSecondary: "#E8D8C3",
      shortDescription: data.brandingSettings.description || data.restaurant.description || "",
      subscriptionPlan: "starter",
      subscriptionStatus: "active",
      trialEndsAt: null,
      renewalDate: null,
      createdAt: new Date().toISOString(),
    };
    setProfile(mapped);
    setLogo(mapped.logo || "");
    setCoverImage(mapped.coverImage || "");
    setThemePrimary(mapped.themePrimary || "#E4572E");
    setShortDescription(mapped.shortDescription || "");
  }, [data]);

  const preview = React.useMemo(
    () => ({
      logoUrl: logo || `${import.meta.env.BASE_URL}ubhona-logo.jpeg`,
      coverImageUrl: coverImage || "",
      primary: themePrimary || "#E4572E",
      secondary: "#E8D8C3",
      shortDescription: shortDescription || "Visualize",
    }),
    [coverImage, logo, shortDescription, themePrimary]
  );

  const saveBranding = async (event: React.FormEvent) => {
    event.preventDefault();
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
            />
            <UploadField
              label="Upload Logo"
              assetType="logo"
              accept="image/png,image/jpeg,image/webp"
              value={logo}
              onUploaded={setLogo}
              className="mt-2"
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
            />
            <UploadField
              label="Upload Cover"
              assetType="cover"
              accept="image/png,image/jpeg,image/webp"
              value={coverImage}
              onUploaded={setCoverImage}
              className="mt-2"
            />
          </div>
          <div>
            <div className={cn("mb-1", typography.label)}>Primary Color</div>
            <Input
              id="branding-primary-color"
              name="primaryColor"
              value={themePrimary}
              onChange={(event) => setThemePrimary(event.target.value)}
              placeholder="#E4572E"
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
      </PageContainer>
    </DashboardLayout>
  );
}
