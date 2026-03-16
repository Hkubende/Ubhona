import * as React from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../lib/auth";
import { getRestaurantProfile, saveRestaurantProfile, syncRestaurantProfile } from "../lib/restaurant";
import UploadField from "../components/uploads/UploadField";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.png`;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Onboarding() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState(user?.email || "");
  const [location, setLocation] = React.useState("");
  const [logo, setLogo] = React.useState("");
  const [coverImage, setCoverImage] = React.useState("");
  const [themePrimary, setThemePrimary] = React.useState("#f97316");
  const [themeSecondary, setThemeSecondary] = React.useState("#34d399");
  const [shortDescription, setShortDescription] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    const hydrate = async () => {
      const remote = await syncRestaurantProfile();
      const existing = remote || getRestaurantProfile();
      if (!existing) return;
      setName(existing.restaurantName);
      setSlug(existing.slug);
      setPhone(existing.phone);
      setEmail(existing.email);
      setLocation(existing.location);
      setLogo(existing.logo || "");
      setCoverImage(existing.coverImage || "");
      setThemePrimary(existing.themePrimary || "#f97316");
      setThemeSecondary(existing.themeSecondary || "#34d399");
      setShortDescription(existing.shortDescription || "");
    };
    void hydrate();
  }, [navigate, user]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError("");
    const normalizedSlug = slugify(slug || name);
    if (!name.trim() || !normalizedSlug || !phone.trim() || !email.trim() || !location.trim()) {
      setError("Please fill all fields.");
      return;
    }
    try {
      await saveRestaurantProfile({
        restaurantName: name,
        slug: normalizedSlug,
        phone,
        email,
        location,
        logo,
        coverImage,
        themePrimary,
        themeSecondary,
        shortDescription,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save restaurant profile.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <img src={LOGO_SRC} alt="Ubhona" className="h-10 w-10 rounded-2xl object-cover" />
          <div>
            <div className="text-xl font-black">
              <span className="text-orange-400">Restaurant</span> Onboarding
            </div>
            <div className="text-xs text-white/60">Set up your profile to access dashboard</div>
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-white/60">Restaurant Name</div>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slug.trim()) setSlug(slugify(event.target.value));
              }}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Slug</div>
            <input
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Phone</div>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Email</div>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Location</div>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div className="md:col-span-2 border-t border-white/10 pt-3 text-xs font-bold uppercase tracking-wide text-white/50">
            Optional Branding
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Logo URL</div>
            <input
              value={logo}
              onChange={(event) => setLogo(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="https://.../ubhona-logo.png"
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
            <div className="mb-1 text-xs text-white/60">Cover Image URL</div>
            <input
              value={coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="https://.../cover.jpg"
            />
            <UploadField
              label="Upload Cover Image"
              assetType="cover"
              accept="image/png,image/jpeg,image/webp"
              value={coverImage}
              onUploaded={setCoverImage}
              className="mt-2"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Primary Theme Color</div>
            <input
              value={themePrimary}
              onChange={(event) => setThemePrimary(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="#f97316"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Secondary Theme Color</div>
            <input
              value={themeSecondary}
              onChange={(event) => setThemeSecondary(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="#34d399"
            />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-white/60">Short Description</div>
            <textarea
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="Tell customers what makes your restaurant special..."
            />
          </div>
          {error ? (
            <div className="md:col-span-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="md:col-span-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-black transition hover:bg-emerald-300"
          >
            Save Restaurant Profile
          </button>
        </form>
      </div>
    </div>
  );
}
