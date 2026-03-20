import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";

export type FeatureItem = {
  id: string | number;
  title: string;
  description: string;
  imageUrl: string;
};

const DEFAULT_ITEMS: FeatureItem[] = [
  {
    id: "storefronts",
    title: "Restaurant Storefronts",
    description:
      "Launch branded restaurant pages where guests can browse your menu, discover signature dishes, and experience your brand in a modern digital storefront.",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "ar-menu-preview",
    title: "AR Menu Preview",
    description:
      "Let customers preview meals in augmented reality before ordering, helping them understand portion, presentation, and appeal more clearly.",
    imageUrl:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "smart-ordering",
    title: "Smart Ordering",
    description:
      "Turn static menus into a smoother ordering flow with interactive browsing, faster selection, and a more intuitive checkout experience.",
    imageUrl:
      "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "menu-builder",
    title: "Menu Builder",
    description:
      "Easily create, organize, and update categories, dishes, pricing, and visual content from one simple restaurant dashboard.",
    imageUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "analytics-dashboard",
    title: "Analytics Dashboard",
    description:
      "Track what customers view, what they open in AR, and what they order so restaurants can make better menu and sales decisions.",
    imageUrl:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80",
  },
];

type InteractiveImageAccordionProps = {
  items?: FeatureItem[];
  className?: string;
};

export function InteractiveImageAccordion({
  items = DEFAULT_ITEMS,
  className,
}: InteractiveImageAccordionProps) {
  const [supportsHover, setSupportsHover] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | number | "">(() =>
    items.find((item) => item.id === "ar-menu-preview")?.id ?? items[0]?.id ?? ""
  );
  const [failedImages, setFailedImages] = React.useState<Record<string, boolean>>({});
  const hasItems = items.length > 0;

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setSupportsHover(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    if (!hasItems) {
      setActiveId("");
      return;
    }
    if (supportsHover && activeId === "") return;
    const exists = items.some((item) => String(item.id) === String(activeId));
    if (!exists) {
      setActiveId(items.find((item) => item.id === "ar-menu-preview")?.id ?? items[0].id);
    }
  }, [activeId, hasItems, items, supportsHover]);

  React.useEffect(() => {
    if (!hasItems) return;
    setActiveId((current) => {
      const exists = items.some((item) => String(item.id) === String(current));
      if (exists) return current;
      return items.find((item) => item.id === "ar-menu-preview")?.id ?? items[0].id;
    });
  }, [hasItems, items]);

  if (!hasItems) {
    return (
      <div
        className={cn(
          "rounded-3xl border border-[#E8D8C3]/20 bg-[#2B1E17]/70 p-6 text-sm text-[#E8D8C3]",
          className
        )}
      >
        Feature highlights are not available.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full max-w-full overflow-hidden rounded-[1.5rem] border border-[#E4572E]/35 bg-[#2B1E17]/84 p-2 shadow-[0_20px_48px_rgba(0,0,0,0.34)] sm:p-3",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 top-10 h-44 w-44 rounded-full bg-[#E4572E]/14 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-4 h-36 w-36 rounded-full bg-[#E8D8C3]/8 blur-3xl" />

      <div
        className="relative z-10 flex w-full flex-col gap-3 md:h-[360px] md:flex-row lg:h-[380px]"
      >
        {items.map((item) => {
          const itemKey = String(item.id);
          const active = itemKey === String(activeId);
          const imageFailed = failedImages[itemKey];

          return (
            <button
              key={itemKey}
              type="button"
              onMouseEnter={() => setActiveId(item.id)}
              onFocus={() => setActiveId(item.id)}
              onClick={() => setActiveId(item.id)}
              className={cn(
                "group relative overflow-hidden border text-left transition-[width,height,border-color,box-shadow,filter] duration-300 ease-out",
                "w-full rounded-2xl md:h-full md:flex-none md:rounded-[1.15rem]",
                active
                  ? "h-[176px] border-transparent shadow-[0_0_0_1px_rgba(228,87,46,0.45)_inset,0_18px_42px_rgba(228,87,46,0.22)] md:w-[260px] lg:w-[260px] xl:w-[300px] 2xl:w-[320px]"
                  : "h-[88px] border-transparent bg-[#2B1E17]/45 shadow-[0_8px_18px_rgba(0,0,0,0.18)] md:w-[64px] lg:w-[64px] xl:w-[72px]"
              )}
              aria-pressed={active}
              aria-label={item.title}
            >
              {!imageFailed ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover transition duration-500",
                    active ? "scale-100 brightness-110 saturate-110" : "scale-[1.08] brightness-55 saturate-65"
                  )}
                  onError={() => setFailedImages((prev) => ({ ...prev, [itemKey]: true }))}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#E4572E]/30 via-[#2B1E17] to-[#2B1E17]" />
              )}
              <div
                className={cn(
                  "absolute inset-0",
                  active
                    ? "bg-gradient-to-t from-[#2B1E17]/96 via-[#2B1E17]/55 to-[#E4572E]/28"
                    : "bg-gradient-to-t from-[#2B1E17]/96 via-black/65 to-[#2B1E17]/45"
                )}
              />

              {active ? (
                <div className="relative z-10 flex h-full flex-col justify-end p-4 sm:p-5">
                  <div className="mb-2 inline-flex w-fit rounded-full border border-[#E8D8C3]/35 bg-[#FBF6EE]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FBF6EE]">
                    Feature Highlights
                  </div>
                  <h3 className="text-lg font-black leading-tight text-[#FBF6EE] drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] sm:text-[1.28rem]">
                    {item.title}
                  </h3>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`${itemKey}-desc`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 2 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="mt-2 max-w-[34ch] text-xs leading-5 text-[#FBF6EE]/92"
                    >
                      {item.description}
                    </motion.p>
                  </AnimatePresence>
                  <div className="mt-3 h-1.5 w-20 rounded-full bg-gradient-to-r from-[#E4572E] to-[#FBF6EE]/85" />
                  <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E4572E]/70 to-transparent" />
                </div>
              ) : (
                <div className="relative z-10 flex h-full w-full items-center justify-center p-2">
                  <span className="text-xs font-semibold text-[#FBF6EE] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] md:hidden">
                    {item.title}
                  </span>
                  <span className="hidden select-none whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.11em] text-[#FBF6EE] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] md:block [writing-mode:vertical-rl] [text-orientation:mixed]">
                    <span className="block">{item.title}</span>
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
