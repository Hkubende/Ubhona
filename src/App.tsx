import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "./components/ui/Card";
import { Hero } from "./components/landing/Hero";
import { InteractiveImageAccordion, type FeatureItem } from "./components/ui/interactive-image-accordion";
import { MotionButton } from "./components/ui/motion-button";
import { SecondaryButton } from "./components/ui/secondary-button";

const LOGO_SRC = `${import.meta.env.BASE_URL}ubhona-logo.jpeg`;

const PREVIEW_ITEMS = [
  {
    title: "Storefront Preview",
    description: "Explore a live branded restaurant page powered by Ubhona.",
    route: "/r/demo",
  },
  {
    title: "AR Viewer",
    description: "See how dishes are visualized in 3D and AR before ordering.",
    route: "/r/demo/ar",
  },
  {
    title: "Checkout Preview",
    description: "Walk through a streamlined cart and checkout customer flow.",
    route: "/r/demo/checkout",
  },
] as const;

const FEATURE_HIGHLIGHTS: FeatureItem[] = [
  {
    id: "storefronts",
    title: "Restaurant Storefronts",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
    description:
      "Launch branded restaurant pages where guests can browse your menu, discover signature dishes, and experience your brand in a modern digital storefront.",
  },
  {
    id: "ar-menu-preview",
    title: "AR Menu Preview",
    imageUrl:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1400&q=80",
    description:
      "Let customers preview meals in augmented reality before ordering, helping them understand portion, presentation, and appeal more clearly.",
  },
  {
    id: "smart-ordering",
    title: "Smart Ordering",
    imageUrl:
      "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1400&q=80",
    description:
      "Turn static menus into a smoother ordering flow with interactive browsing, faster selection, and a more intuitive checkout experience.",
  },
  {
    id: "menu-builder",
    title: "Menu Builder",
    imageUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80",
    description:
      "Easily create, organize, and update categories, dishes, pricing, and visual content from one simple restaurant dashboard.",
  },
  {
    id: "analytics-dashboard",
    title: "Analytics Dashboard",
    imageUrl:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80",
    description:
      "Track what customers view, what they open in AR, and what they order so restaurants can make better menu and sales decisions.",
  },
] as const;

export default function App() {
  const navigate = useNavigate();

  return (
    <div className="ubhona-landing-shell">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="ubhona-landing-header mb-8 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="Ubhona" className="h-10 w-10 rounded-2xl object-cover" />
            <div>
              <div className="text-lg font-black">
                <span className="text-primary">Ubhona</span>
              </div>
              <div className="text-xs text-text-secondary/90">Visualize</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton
              onClick={() => navigate("/login")}
              label="Sign In"
              className="min-h-10 px-4 text-xs sm:text-sm"
            />
            <MotionButton
              onClick={() => navigate("/signup")}
              label="Sign Up"
              className="min-h-10 px-4 text-xs sm:text-sm"
            />
          </div>
        </header>

        <main>
          <Hero
            onGetStarted={() => navigate("/signup")}
            onViewDemo={(event) => {
              event.preventDefault();
              navigate("/r/demo");
            }}
          />

          <section
            id="feature-highlights"
            className="mb-10 rounded-3xl border border-[#E4572E]/20 bg-gradient-to-br from-[#2B1E17]/55 via-black/70 to-[#2B1E17]/35 p-5 sm:p-6"
          >
            <div className="mt-1 grid gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-stretch">
              <div className="min-w-0 p-1 lg:flex lg:h-full lg:flex-col lg:justify-center lg:pr-5">
                <div className="mb-2 text-sm font-black uppercase tracking-wide text-[#E8D8C3]/90">
                  Feature Highlights
                </div>
                <h2 className="text-2xl font-black text-[#FBF6EE] sm:text-[2rem]">Bring restaurant menus to life</h2>
                <p className="mt-2 max-w-md text-sm leading-7 text-[#E8D8C3]/92">
                  Ubhona helps restaurants turn static menus into interactive experiences with AR
                  previews, digital storefronts, smarter ordering, and clear operational insights.
                </p>
              </div>
              <div className="min-w-0">
                <InteractiveImageAccordion
                  items={FEATURE_HIGHLIGHTS}
                  className="w-full max-w-[656px]"
                />
              </div>
            </div>
          </section>

          <section className="mb-10 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-wide text-text-secondary/85">Problem</div>
              <h2 className="mt-2 text-2xl font-black text-text-primary">Static menus are limiting</h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary/90">
                Customers decide quickly, and flat menu images do not capture texture, size, or
                presentation. Restaurants lose attention before intent turns into orders.
              </p>
            </Card>
            <div className="ubhona-landing-section p-5">
              <div className="text-xs font-black uppercase tracking-wide text-[#F2BA8E]">Solution</div>
              <h2 className="mt-2 text-2xl font-black text-[#FBF6EE]">Ubhona makes menus visual</h2>
              <p className="mt-3 text-sm leading-7 text-[#E8D8C3]/92">
                Give diners a richer way to explore meals with 3D/AR experiences, branded storefronts,
                and a path into smarter ordering and operational insights.
              </p>
            </div>
          </section>

          <section className="ubhona-landing-section mb-10 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-text-secondary/86">Product Preview</div>
                <p className="mt-1 text-sm text-text-secondary/88">Explore the MVP journey from storefront to checkout.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {PREVIEW_ITEMS.map((item) => (
                <button
                  key={item.title}
                  onClick={() => navigate(item.route)}
                  className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(16,13,13,0.84),rgba(11,10,10,0.84))] p-4 text-left transition duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-[linear-gradient(180deg,rgba(18,14,14,0.9),rgba(13,11,11,0.9))]"
                >
                  <div className="text-sm font-bold text-[#F2BA8E]">{item.title}</div>
                  <div className="mt-2 text-xs text-text-secondary/85">{item.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="ubhona-landing-section bg-[linear-gradient(112deg,rgba(228,87,46,0.2),rgba(13,11,11,0.95)_46%,rgba(8,7,7,0.96)_100%)] p-6 text-center">
            <h2 className="text-2xl font-black text-[#FBF6EE]">Build your next menu experience with Ubhona</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[#E8D8C3]/88">
              Show food better, increase confidence before checkout, and move faster from menu to order.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <MotionButton
                onClick={() => navigate("/signup")}
                label="Get Started"
                className="min-h-11 px-6"
              />
              <SecondaryButton
                onClick={() => navigate("/r/demo")}
                label="View Demo"
                className="min-h-11 px-6"
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
