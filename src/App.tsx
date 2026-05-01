import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Card } from "./components/ui/Card";
import { Hero } from "./components/landing/Hero";
import { InteractiveImageAccordion, type FeatureItem } from "./components/ui/interactive-image-accordion";
import { MotionButton } from "./components/ui/motion-button";
import { SecondaryButton } from "./components/ui/secondary-button";
import { UbhonaLogo } from "./components/ui/ubhona-logo";
import { useGsapScrollReveal } from "./hooks/use-gsap-scroll-reveal";
import { trackLaunchFunnelEvent } from "./lib/analytics";
import { useSeoMetadata } from "./lib/seo";
import { cn } from "./lib/utils";
import { tokens, typography } from "./design-system";

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
  const featureHighlightsRef = React.useRef<HTMLElement | null>(null);
  const contactSectionRef = React.useRef<HTMLElement | null>(null);
  const landingVisitTrackedRef = React.useRef(false);

  useGsapScrollReveal(featureHighlightsRef, {
    selectors: ["[data-gsap-feature='copy']", "[data-gsap-feature='accordion']"],
    start: "top 76%",
    y: 32,
    duration: 0.82,
    stagger: 0.12,
  });

  useGsapScrollReveal(contactSectionRef, {
    selectors: ["[data-gsap-contact='heading']", "[data-gsap-contact='body']", "[data-gsap-contact='actions']"],
    start: "top 82%",
    y: 24,
    duration: 0.72,
    stagger: 0.1,
  });

  const scrollToSection = React.useCallback((id: string) => {
    if (id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  React.useEffect(() => {
    if (landingVisitTrackedRef.current) return;
    landingVisitTrackedRef.current = true;
    void trackLaunchFunnelEvent("landing_visit", { page: "home" });
  }, []);

  useSeoMetadata({
    title: "AR Menus and Restaurant Storefronts",
    description:
      "Ubhona helps restaurants launch AR menus, branded storefronts, smarter ordering, and operational visibility from one premium platform.",
    path: "/",
  });

  const handleGetStarted = React.useCallback((placement: string) => {
    void trackLaunchFunnelEvent("cta_click", {
      placement,
      target: "signup",
    });
    navigate("/signup");
  }, [navigate]);

  return (
    <div className="ubhona-landing-shell">
      <header className="ubhona-landing-header">
        <div className="mx-auto flex h-[74px] w-full max-w-7xl items-center justify-between gap-4 px-6 sm:px-8 lg:px-10">
          <div className="min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => scrollToSection("home")}
              className="inline-flex items-center"
              aria-label="Go to top"
            >
              <UbhonaLogo
                size={32}
                showWordmark
                theme="dark"
                className="max-w-full translate-y-[0.5px]"
                ariaLabel="Ubhona logo"
              />
            </button>
          </div>
          <nav className="hidden items-center gap-8 lg:flex">
            <button type="button" onClick={() => scrollToSection("home")} className="ubhona-landing-nav-link">
              Home
            </button>
            <button type="button" onClick={() => scrollToSection("feature-highlights")} className="ubhona-landing-nav-link">
              Features
            </button>
            <button type="button" onClick={() => navigate("/pricing")} className="ubhona-landing-nav-link">
              Pricing
            </button>
            <button type="button" onClick={() => navigate("/contact")} className="ubhona-landing-nav-link">
              Support
            </button>
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="hidden min-h-10 rounded-xl px-4 text-sm font-medium text-text-secondary/78 transition-colors duration-200 hover:text-text-primary md:inline-flex md:items-center"
            >
              Sign In
            </button>
            <MotionButton
              onClick={() => handleGetStarted("header")}
              label="Get Started"
              className="ubhona-landing-cta min-h-10 px-4 text-xs sm:px-5 sm:text-sm"
            />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary/78 transition-colors duration-200 hover:text-text-primary lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <main>
          <Hero
            onGetStarted={() => handleGetStarted("hero")}
            onViewDemo={(event) => {
              event.preventDefault();
              navigate("/r/demo");
            }}
          />

          <section
            id="feature-highlights"
            ref={featureHighlightsRef}
            className={cn(tokens.classes.surfaceElevated, "mb-10 p-5 sm:p-6")}
          >
            <div className="mt-1 grid gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-stretch">
              <div
                data-gsap-feature="copy"
                className="min-w-0 p-1 lg:flex lg:h-full lg:flex-col lg:justify-center lg:pr-5"
              >
                <div className={cn("mb-2 text-text-secondary/68", typography.label)}>
                  Feature Highlights
                </div>
                <h2 className={cn("text-text-primary sm:text-[2rem]", typography.sectionTitle)}>Bring restaurant menus to life</h2>
                <p className={cn("mt-2 max-w-md text-text-secondary/84", typography.body)}>
                  Ubhona helps restaurants turn static menus into interactive experiences with AR
                  previews, digital storefronts, smarter ordering, and clear operational insights.
                </p>
              </div>
              <div data-gsap-feature="accordion" className="min-w-0">
                <InteractiveImageAccordion
                  items={FEATURE_HIGHLIGHTS}
                  className="w-full max-w-[656px]"
                />
              </div>
            </div>
          </section>

          <section className="mb-10 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className={cn("text-text-secondary/68", typography.label)}>Problem</div>
              <h2 className={cn("mt-2", typography.sectionTitle)}>Static menus are limiting</h2>
              <p className={cn("mt-3 text-text-secondary/82", typography.body)}>
                Customers decide quickly, and flat menu images do not capture texture, size, or
                presentation. Restaurants lose attention before intent turns into orders.
              </p>
            </Card>
            <div className="ubhona-landing-section p-5">
              <div className={cn("text-primary/78", typography.label)}>Solution</div>
              <h2 className={cn("mt-2 text-text-primary", typography.sectionTitle)}>Ubhona makes menus visual</h2>
              <p className={cn("mt-3 text-text-secondary/84", typography.body)}>
                Give diners a richer way to explore meals with 3D/AR experiences, branded storefronts,
                and a path into smarter ordering and operational insights.
              </p>
            </div>
          </section>

          <section className="ubhona-landing-section mb-10 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className={cn("text-text-secondary/68", typography.label)}>Product Preview</div>
                <p className={cn("mt-1 text-text-secondary/78", typography.body)}>Explore the MVP journey from storefront to checkout.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {PREVIEW_ITEMS.map((item) => (
                <button
                  key={item.title}
                  onClick={() => navigate(item.route)}
                  className="ui-panel-inset rounded-[22px] p-4 text-left transition duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-[linear-gradient(180deg,rgba(18,14,14,0.9),rgba(13,11,11,0.9))]"
                >
                  <div className="text-sm font-semibold text-[#F2BA8E]">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-text-secondary/74">{item.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section
            id="contact"
            ref={contactSectionRef}
            className="ubhona-landing-section bg-[linear-gradient(112deg,rgba(255,106,26,0.2),rgba(13,11,11,0.95)_46%,rgba(8,7,7,0.96)_100%)] p-6 text-center"
          >
            <h2 data-gsap-contact="heading" className={cn("text-[#FBF6EE]", typography.sectionTitle)}>
              Build your next menu experience with Ubhona
            </h2>
            <p data-gsap-contact="body" className={cn("mx-auto mt-3 max-w-2xl text-[#E8D8C3]/84", typography.body)}>
              Show food better, increase confidence before checkout, and move faster from menu to order.
              Need help before launch? Reach support in one click.
            </p>
            <div data-gsap-contact="actions" className="mt-5 flex justify-center gap-3">
              <MotionButton
                onClick={() => handleGetStarted("contact")}
                label="Get Started"
                className="min-h-11 px-6"
              />
              <SecondaryButton
                onClick={() => navigate("/contact")}
                label="Email Support"
                className="min-h-11 px-6"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm text-[#E8D8C3]/78">
              <Link to="/privacy" className="transition-colors hover:text-[#FBF6EE]">
                Privacy Policy
              </Link>
              <Link to="/terms" className="transition-colors hover:text-[#FBF6EE]">
                Terms of Service
              </Link>
              <Link to="/contact" className="transition-colors hover:text-[#FBF6EE]">
                Support
              </Link>
              <a href="mailto:support@ubhona.com?subject=Ubhona%20Support%20Request" className="transition-colors hover:text-[#FBF6EE]">
                support@ubhona.com
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
