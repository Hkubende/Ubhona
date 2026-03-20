import * as React from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../lib/auth";
import {
  getRestaurantProfile,
  saveRestaurantProfile,
  syncRestaurantProfile,
  validateRestaurantSlug,
} from "../lib/restaurant";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;
const ONBOARDING_DRAFT_KEY = "mv_onboarding_draft_v1";

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
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState("");
  const [isHydrating, setIsHydrating] = React.useState(true);

  const loadDraft = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      setName(String(draft.name || ""));
      setSlug(String(draft.slug || ""));
      setPhone(String(draft.phone || ""));
      setEmail(String(draft.email || user?.email || ""));
      setLocation(String(draft.location || ""));
      setLogo(String(draft.logo || ""));
      setDescription(String(draft.description || ""));
    } catch {
      // ignore malformed local draft
    }
  }, [user?.email]);

  React.useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    const hydrate = async () => {
      const remote = await syncRestaurantProfile();
      const existing = remote || getRestaurantProfile();
      if (!existing) {
        loadDraft();
        setIsHydrating(false);
        return;
      }
      navigate("/dashboard", { replace: true });
      setIsHydrating(false);
      return;
    };
    void hydrate();
  }, [loadDraft, navigate, user]);

  React.useEffect(() => {
    if (!user || isHydrating) return;
    const payload = {
      name,
      slug,
      phone,
      email,
      location,
      logo,
      description,
    };
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(payload));
  }, [
    email,
    isHydrating,
    location,
    logo,
    description,
    name,
    phone,
    slug,
    user,
  ]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError("");
    const normalizedSlug = slugify(slug || name);
    if (!name.trim() || !normalizedSlug || !phone.trim() || !email.trim() || !location.trim()) {
      setError("Please fill all fields.");
      return;
    }
    const slugError = validateRestaurantSlug(normalizedSlug);
    if (slugError) {
      setError(slugError);
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
        shortDescription: description,
      });
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
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
              id="onboarding-restaurant-name"
              name="restaurantName"
              autoComplete="organization"
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
              id="onboarding-slug"
              name="slug"
              autoComplete="off"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Phone</div>
            <input
              id="onboarding-phone"
              name="phone"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-white/60">Email</div>
            <input
              id="onboarding-email"
              name="email"
              autoComplete="email"
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
              id="onboarding-location"
              name="location"
              autoComplete="street-address"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div className="md:col-span-2 border-t border-white/10 pt-3 text-xs font-bold uppercase tracking-wide text-white/50">
            Optional Branding
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-white/60">Logo URL</div>
            <input
              id="onboarding-logo"
              name="logo"
              autoComplete="off"
              value={logo}
              onChange={(event) => setLogo(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="https://.../ubhona-logo.jpeg"
            />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-white/60">Description</div>
            <textarea
              id="onboarding-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="Tell guests what makes your restaurant unique..."
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
