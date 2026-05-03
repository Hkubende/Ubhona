import * as React from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../lib/auth";
import {
  getRestaurantProfile,
  saveRestaurantProfile,
  syncRestaurantProfile,
  validateRestaurantSlug,
} from "../lib/restaurant";
import { trackLaunchFunnelEvent } from "../lib/analytics";
import { getQrCodeImageUrl, getStorefrontMenuUrl } from "../lib/qr";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;
const ONBOARDING_DEFAULT_DISH_THUMB = `${import.meta.env.BASE_URL}thumbs/burger.png`;
const ONBOARDING_DRAFT_KEY = "mv_onboarding_draft_v2";

type OnboardingStep = 1 | 2 | 3 | 4;
type MenuInputMode = "simple" | "manual";
type DraftDish = { name: string; price: number };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseManualDishes(raw: string): DraftDish[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)[\s\-:]+(\d+(?:\.\d{1,2})?)$/);
      if (!match) return null;
      const name = match[1].trim();
      const price = Number(match[2]);
      if (!name || !Number.isFinite(price) || price <= 0) return null;
      return { name, price };
    })
    .filter((dish): dish is DraftDish => !!dish);
}

export default function Onboarding() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const allowPreviewMode =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("previewOnboarding") === "1";
  const [step, setStep] = React.useState<OnboardingStep>(1);

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [logo, setLogo] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState(user?.email || "");
  const [location, setLocation] = React.useState("");

  const [menuMode, setMenuMode] = React.useState<MenuInputMode>("simple");
  const [categoryName, setCategoryName] = React.useState("Main");
  const [simpleDishName, setSimpleDishName] = React.useState("");
  const [simpleDishPrice, setSimpleDishPrice] = React.useState("1200");
  const [simpleDishes, setSimpleDishes] = React.useState<DraftDish[]>([]);
  const [manualMenuText, setManualMenuText] = React.useState("");
  const [simulateFirstOrder, setSimulateFirstOrder] = React.useState(true);

  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [isHydrating, setIsHydrating] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const onboardingStartTrackedRef = React.useRef(false);

  const draftStorageKey = React.useMemo(() => {
    const normalizedUserId = userId.trim();
    return normalizedUserId ? `${ONBOARDING_DRAFT_KEY}:${normalizedUserId}` : ONBOARDING_DRAFT_KEY;
  }, [userId]);

  const normalizedSlug = React.useMemo(() => slugify(slug || name), [slug, name]);
  const manualDishes = React.useMemo(() => parseManualDishes(manualMenuText), [manualMenuText]);
  const draftDishes = React.useMemo(
    () => (menuMode === "simple" ? simpleDishes : manualDishes),
    [manualDishes, menuMode, simpleDishes]
  );
  const storefrontUrl = React.useMemo(
    () => (normalizedSlug ? getStorefrontMenuUrl(normalizedSlug) : ""),
    [normalizedSlug]
  );
  const qrUrl = React.useMemo(
    () => (storefrontUrl ? getQrCodeImageUrl(storefrontUrl, 220) : ""),
    [storefrontUrl]
  );

  const loadDraft = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      const rawStep = Number(draft.step || 1);
      const safeStep = Number.isFinite(rawStep) ? Math.max(1, Math.min(4, rawStep)) : 1;
      setStep(safeStep as OnboardingStep);
      setName(String(draft.name || ""));
      setSlug(String(draft.slug || ""));
      setLogo(String(draft.logo || ""));
      setDescription(String(draft.description || ""));
      setPhone(String(draft.phone || ""));
      setEmail(String(draft.email || userEmail || ""));
      setLocation(String(draft.location || ""));
      setMenuMode((String(draft.menuMode || "simple") as MenuInputMode) || "simple");
      setCategoryName(String(draft.categoryName || "Main"));
      setSimpleDishName(String(draft.simpleDishName || ""));
      setSimpleDishPrice(String(draft.simpleDishPrice || "1200"));
      setSimpleDishes(
        Array.isArray(draft.simpleDishes)
          ? draft.simpleDishes
              .map((dish) => {
                const row = dish as Record<string, unknown>;
                const dishName = String(row.name || "").trim();
                const dishPrice = Number(row.price || 0);
                if (!dishName || !Number.isFinite(dishPrice) || dishPrice <= 0) return null;
                return { name: dishName, price: dishPrice };
              })
              .filter((dish): dish is DraftDish => !!dish)
          : []
      );
      setManualMenuText(String(draft.manualMenuText || ""));
      setSimulateFirstOrder(Boolean(draft.simulateFirstOrder ?? true));
    } catch {
      // Ignore malformed draft.
    }
  }, [draftStorageKey, userEmail]);

  React.useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }
    const hydrate = async () => {
      const remote = await syncRestaurantProfile();
      const existing = remote || getRestaurantProfile();
      if (!existing || allowPreviewMode) {
        if (!onboardingStartTrackedRef.current) {
          onboardingStartTrackedRef.current = true;
          void trackLaunchFunnelEvent("onboarding_start", {
            step: 1,
            previewMode: allowPreviewMode,
          });
        }
        loadDraft();
        setIsHydrating(false);
        return;
      }
      navigate("/dashboard", { replace: true });
      setIsHydrating(false);
    };
    void hydrate();
  }, [allowPreviewMode, loadDraft, navigate, userId]);

  React.useEffect(() => {
    if (!userId || isHydrating) return;
    const handle = window.setTimeout(() => {
      const payload = {
        step,
        name,
        slug,
        logo,
        description,
        phone,
        email,
        location,
        menuMode,
        categoryName,
        simpleDishName,
        simpleDishPrice,
        simpleDishes,
        manualMenuText,
        simulateFirstOrder,
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [
    userId,
    isHydrating,
    step,
    name,
    slug,
    logo,
    description,
    phone,
    email,
    location,
    menuMode,
    categoryName,
    simpleDishName,
    simpleDishPrice,
    simpleDishes,
    manualMenuText,
    simulateFirstOrder,
    draftStorageKey,
  ]);

  const addSimpleDish = () => {
    const dishName = simpleDishName.trim();
    const dishPrice = Number(simpleDishPrice);
    if (!dishName || !Number.isFinite(dishPrice) || dishPrice <= 0) {
      setError("Enter a valid dish name and price.");
      return;
    }
    setSimpleDishes((current) => [...current, { name: dishName, price: dishPrice }]);
    setSimpleDishName("");
    setSimpleDishPrice("1200");
    setError("");
  };

  const validateCurrentStep = () => {
    if (step === 1) {
      if (!name.trim()) return "Restaurant name is required.";
      const slugError = validateRestaurantSlug(normalizedSlug);
      if (slugError) return slugError;
    }
    if (step === 2) {
      if (!draftDishes.length) return "Add at least one dish or use manual upload lines.";
    }
    if (step === 3) {
      if (!normalizedSlug) return "Slug is required before generating QR.";
    }
    return "";
  };

  const goNext = () => {
    const nextError = validateCurrentStep();
    if (nextError) {
      setError(nextError);
      return;
    }
    setError("");
    setStep((current) => Math.min(4, (current + 1) as OnboardingStep) as OnboardingStep);
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(1, (current - 1) as OnboardingStep) as OnboardingStep);
  };

  const copyStorefrontLink = async () => {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setNotice("Storefront link copied.");
    } catch {
      setNotice("Could not copy link automatically. Copy it manually below.");
    }
  };

  const launchRestaurant = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const profile = await saveRestaurantProfile({
        restaurantName: name.trim(),
        slug: normalizedSlug,
        phone: phone.trim() || "Not set",
        email: email.trim() || userEmail || "owner@ubhona.com",
        location: location.trim() || "Not set",
        logo: logo.trim(),
        shortDescription: description.trim(),
      });

      const [{ addCategory, getCategories }, { addRestaurantDish }] = await Promise.all([
        import("../lib/categories"),
        import("../lib/restaurant-dishes"),
      ]);
      const existingCategories = await getCategories();
      const selectedCategoryName = categoryName.trim() || "Main";
      let categoryId =
        existingCategories.find((category) => category.name.toLowerCase() === selectedCategoryName.toLowerCase())?.id || "";
      if (!categoryId) {
        const createdCategory = await addCategory({
          name: selectedCategoryName,
          sortOrder: existingCategories.length,
        });
        categoryId = createdCategory.id;
      }

      const createdDishes: Array<{ id: string; name: string; price: number }> = [];
      for (const dish of draftDishes) {
        const created = await addRestaurantDish({
          categoryId,
          name: dish.name,
          desc: "Added during onboarding.",
          price: dish.price,
          thumb: ONBOARDING_DEFAULT_DISH_THUMB,
          model: "",
          isAvailable: true,
        });
        createdDishes.push({ id: created.id, name: created.name, price: created.price });
      }

      if (simulateFirstOrder && createdDishes.length) {
        const { createStorefrontOrder } = await import("../lib/orders");
        const first = createdDishes[0];
        await createStorefrontOrder({
          restaurantId: profile.id,
          restaurantSlug: profile.slug,
          items: [{ dishId: first.id, quantity: 1 }],
          itemSnapshots: [
            {
              dishId: first.id,
              name: first.name,
              quantity: 1,
              unitPrice: first.price,
              subtotal: first.price,
            },
          ],
          customerName: "Demo Guest",
          customerPhone: "+254700000000",
          paymentMethod: "manual_mpesa",
          paymentStatus: "paid",
          paymentReference: "ONBOARDING-DEMO",
          source: "admin",
          subtotalAmount: first.price,
          totalAmount: first.price,
          status: "completed",
        });
      }

      localStorage.removeItem(draftStorageKey);
      void trackLaunchFunnelEvent("onboarding_complete", {
        step: 4,
        slug: normalizedSlug,
        dishCount: createdDishes.length,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding.");
    } finally {
      setSaving(false);
    }
  };

  const stepClass = (target: OnboardingStep) =>
    `rounded-full px-3 py-1 text-xs font-bold ${
      step >= target
        ? "bg-primary text-[color:var(--color-primary-foreground)]"
        : "border border-border bg-[color:var(--ui-note-icon-bg)] text-text-secondary/68"
    }`;

  return (
    <div className="min-h-screen bg-app-bg px-4 py-8 text-text-primary">
      <div className="ui-surface mx-auto max-w-5xl rounded-3xl p-6 backdrop-blur-xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo.trim() || LOGO_SRC} alt="Ubhona" className="h-11 w-11 rounded-2xl object-cover" />
            <div>
              <div className="text-xl font-black">
                <span className="text-primary">Fast</span> Onboarding
              </div>
              <div className="text-xs text-text-secondary/68">Operational in under 10 minutes</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={stepClass(1)}>1. Setup</span>
            <span className={stepClass(2)}>2. Menu</span>
            <span className={stepClass(3)}>3. QR</span>
            <span className={stepClass(4)}>4. Preview</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(290px,0.85fr)]">
          <div className="ui-panel-inset rounded-2xl p-4">
            {step === 1 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="onboarding-restaurant-name" className="mb-1 block text-xs text-text-secondary/68">Restaurant Name</label>
                  <input
                    id="onboarding-restaurant-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (!slug.trim()) setSlug(slugify(event.target.value));
                    }}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="Ubhona Bistro"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-slug" className="mb-1 block text-xs text-text-secondary/68">Slug</label>
                  <input
                    id="onboarding-slug"
                    value={slug}
                    onChange={(event) => setSlug(slugify(event.target.value))}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="ubhona-bistro"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-logo" className="mb-1 block text-xs text-text-secondary/68">Logo URL</label>
                  <input
                    id="onboarding-logo"
                    value={logo}
                    onChange={(event) => setLogo(event.target.value)}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="https://.../logo.jpg"
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-phone" className="mb-1 block text-xs text-text-secondary/68">Phone (optional)</label>
                  <input
                    id="onboarding-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="+254..."
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-email" className="mb-1 block text-xs text-text-secondary/68">Email</label>
                  <input
                    id="onboarding-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="owner@restaurant.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="onboarding-location" className="mb-1 block text-xs text-text-secondary/68">Location (optional)</label>
                  <input
                    id="onboarding-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="Nairobi"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="onboarding-description" className="mb-1 block text-xs text-text-secondary/68">Short Description</label>
                  <textarea
                    id="onboarding-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="Bold flavors, fast service."
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMenuMode("simple")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      menuMode === "simple"
                        ? "bg-primary text-[color:var(--color-primary-foreground)]"
                        : "border border-border bg-[color:var(--ui-note-icon-bg)] text-text-secondary/80"
                    }`}
                  >
                    Simple Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuMode("manual")}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      menuMode === "manual"
                        ? "bg-primary text-[color:var(--color-primary-foreground)]"
                        : "border border-border bg-[color:var(--ui-note-icon-bg)] text-text-secondary/80"
                    }`}
                  >
                    Manual Upload
                  </button>
                </div>

                <div>
                  <label htmlFor="onboarding-category-name" className="mb-1 block text-xs text-text-secondary/68">Category</label>
                  <input
                    id="onboarding-category-name"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="Main"
                  />
                </div>

                {menuMode === "simple" ? (
                  <div className="space-y-2 rounded-xl border border-border bg-[color:var(--ui-note-icon-bg)] p-3">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                      <input
                        value={simpleDishName}
                        onChange={(event) => setSimpleDishName(event.target.value)}
                        className="ui-input-control rounded-xl px-3 py-2 text-sm outline-none"
                        placeholder="Dish name"
                      />
                      <input
                        value={simpleDishPrice}
                        onChange={(event) => setSimpleDishPrice(event.target.value)}
                        className="ui-input-control rounded-xl px-3 py-2 text-sm outline-none"
                        placeholder="Price"
                      />
                      <button
                        type="button"
                        onClick={addSimpleDish}
                        className="ui-button-primary rounded-xl px-3 py-2 text-sm font-bold"
                      >
                        Add
                      </button>
                    </div>
                    {simpleDishes.length ? (
                      <div className="space-y-1 text-sm text-text-primary">
                        {simpleDishes.map((dish, index) => (
                          <div key={`${dish.name}-${index}`} className="flex items-center justify-between rounded-lg border border-border bg-surface px-2 py-1.5">
                            <span>{dish.name}</span>
                            <span>KSh {dish.price.toLocaleString("en-KE")}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-text-secondary/68">No dishes added yet.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label htmlFor="onboarding-manual-menu" className="mb-1 block text-xs text-text-secondary/68">
                      One dish per line, format: `Name - Price`
                    </label>
                    <textarea
                      id="onboarding-manual-menu"
                      value={manualMenuText}
                      onChange={(event) => setManualMenuText(event.target.value)}
                      rows={8}
                      className="ui-input-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                      placeholder={"Burger & Fries - 950\nRoxie Rootbeer - 320"}
                    />
                    <div className="mt-2 text-xs text-text-secondary/68">
                      Parsed dishes: {manualDishes.length}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-3">
                <div className="text-sm text-text-secondary/78">Scan to open your live menu instantly.</div>
                {qrUrl ? (
                  <img src={qrUrl} alt="Restaurant QR code" className="h-52 w-52 rounded-2xl border border-border bg-white p-2" />
                ) : null}
                <div className="rounded-xl border border-border bg-[color:var(--ui-note-icon-bg)] px-3 py-2 text-xs text-text-primary break-all">
                  {storefrontUrl || "Enter restaurant name first."}
                </div>
                <button
                  type="button"
                  onClick={() => void copyStorefrontLink()}
                  className="ui-button-secondary rounded-xl px-3 py-2 text-sm font-semibold"
                  disabled={!storefrontUrl}
                >
                  Copy Link
                </button>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-[color:var(--ui-note-icon-bg)] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <img src={logo.trim() || LOGO_SRC} alt={name || "Restaurant"} className="h-9 w-9 rounded-xl object-cover" />
                    <div>
                      <div className="font-semibold text-text-primary">{name || "Your Restaurant"}</div>
                      <div className="text-xs text-text-secondary/68">@{normalizedSlug || "restaurant-slug"}</div>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary/78">{description || "Your storefront is ready to receive orders."}</p>
                  <div className="mt-3 space-y-1">
                    {draftDishes.slice(0, 4).map((dish, index) => (
                      <div key={`${dish.name}-${index}`} className="flex items-center justify-between text-sm text-text-primary">
                        <span>{dish.name}</span>
                        <span>KSh {dish.price.toLocaleString("en-KE")}</span>
                      </div>
                    ))}
                    {!draftDishes.length ? <div className="text-xs text-text-secondary/68">No dishes yet.</div> : null}
                  </div>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-border bg-[color:var(--ui-note-icon-bg)] px-3 py-2 text-xs text-text-secondary/78">
                  <input
                    type="checkbox"
                    checked={simulateFirstOrder}
                    onChange={(event) => setSimulateFirstOrder(event.target.checked)}
                  />
                  Simulate first order (recommended for quick dashboard data)
                </label>
                <a
                  href={storefrontUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-block rounded-xl px-3 py-2 text-sm font-semibold ${
                    storefrontUrl
                      ? "ui-button-secondary"
                      : "pointer-events-none border border-border bg-[color:var(--ui-note-icon-bg)] opacity-50"
                  }`}
                >
                  Open Live Preview
                </a>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
                {notice}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={goBack}
                className="ui-button-secondary rounded-xl px-3 py-2 text-sm font-semibold"
                disabled={step === 1 || saving}
              >
                Back
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="ui-button-primary rounded-xl px-4 py-2 text-sm font-black"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void launchRestaurant()}
                  disabled={saving}
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-black disabled:opacity-60"
                >
                  {saving ? "Launching..." : "Launch Restaurant"}
                </button>
              )}
            </div>
          </div>

          <div className="ui-panel-inset rounded-2xl p-4">
            <div className="text-xs font-bold uppercase tracking-[0.15em] text-text-secondary/58">Progress</div>
            <div className="mt-2 space-y-2 text-sm text-text-secondary/80">
              <div className={step >= 1 ? "text-text-primary" : "text-text-secondary/45"}>1. Restaurant setup</div>
              <div className={step >= 2 ? "text-text-primary" : "text-text-secondary/45"}>2. Menu upload</div>
              <div className={step >= 3 ? "text-text-primary" : "text-text-secondary/45"}>3. QR generation</div>
              <div className={step >= 4 ? "text-text-primary" : "text-text-secondary/45"}>4. Live preview</div>
            </div>
            <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-text-primary">
              Time target: under 10 minutes.
            </div>
            <div className="mt-4 text-xs text-text-secondary/68">
              Dishes prepared: <span className="font-semibold text-text-primary">{draftDishes.length}</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary/68">
              Storefront link: <span className="font-semibold text-text-primary">{normalizedSlug ? "Ready" : "Pending"}</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary/68">
              Preview status: <span className="font-semibold text-text-primary">{step >= 4 ? "Ready" : "Pending"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
