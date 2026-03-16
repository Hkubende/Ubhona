import { api } from "./api";

export type PlatformTrackerStatus = "backlog" | "planned" | "in_progress" | "done" | "blocked";

export type PlatformTrackerItem = {
  id: string;
  label: string;
  status: PlatformTrackerStatus;
  notes: string;
  updatedAt: string;
};

export type PlatformTrackerSection = {
  id: string;
  title: string;
  description: string;
  items: PlatformTrackerItem[];
};

export type PlatformTrackerBoard = {
  updatedAt: string;
  sections: PlatformTrackerSection[];
};

function nowIso() {
  return new Date().toISOString();
}

function makeItem(id: string, label: string): PlatformTrackerItem {
  return {
    id,
    label,
    status: "backlog",
    notes: "",
    updatedAt: nowIso(),
  };
}

export function getDefaultPlatformTracker(): PlatformTrackerBoard {
  return {
    updatedAt: nowIso(),
    sections: [
      {
        id: "customer-platform",
        title: "Customer Platform",
        description: "Customer-facing menu, AR, cart, checkout, and tracking flows.",
        items: [
          makeItem("restaurant-menu", "Restaurant Menu"),
          makeItem("ar-food-preview", "AR Food Preview"),
          makeItem("cart", "Cart"),
          makeItem("checkout", "Checkout"),
          makeItem("order-tracking", "Order Tracking"),
        ],
      },
      {
        id: "restaurant-dashboard",
        title: "Restaurant Dashboard",
        description: "Merchant onboarding and daily operations tooling.",
        items: [
          makeItem("onboarding", "Onboarding"),
          makeItem("menu-builder", "Menu Builder"),
          makeItem("order-management", "Order Management"),
          makeItem("analytics", "Analytics"),
          makeItem("branding", "Branding"),
        ],
      },
      {
        id: "payments-system",
        title: "Payments System",
        description: "STK, payment records, and callback reliability.",
        items: [
          makeItem("stk-push", "STK Push"),
          makeItem("payment-records", "Payment Records"),
          makeItem("callback-handling", "Callback Handling"),
        ],
      },
      {
        id: "platform-admin",
        title: "Platform Admin",
        description: "Admin tools for restaurants, billing, support, and usage.",
        items: [
          makeItem("restaurant-management", "Restaurant Management"),
          makeItem("subscription-plans", "Subscription Plans"),
          makeItem("support-tools", "Support Tools"),
          makeItem("usage-analytics", "Usage Analytics"),
        ],
      },
    ],
  };
}

export async function loadPlatformTracker(): Promise<PlatformTrackerBoard> {
  try {
    return await api.get<PlatformTrackerBoard>("/admin/platform-tracker");
  } catch {
    return getDefaultPlatformTracker();
  }
}

export async function savePlatformTracker(board: PlatformTrackerBoard): Promise<PlatformTrackerBoard> {
  return api.put<PlatformTrackerBoard>("/admin/platform-tracker", board);
}

export async function resetPlatformTracker(): Promise<PlatformTrackerBoard> {
  return api.post<PlatformTrackerBoard>("/admin/platform-tracker/reset");
}

export function updatePlatformTrackerItem(
  board: PlatformTrackerBoard,
  sectionId: string,
  itemId: string,
  updates: Partial<Pick<PlatformTrackerItem, "status" | "notes">>
) {
  return {
    updatedAt: nowIso(),
    sections: board.sections.map((section) =>
      section.id !== sectionId
        ? section
        : {
            ...section,
            items: section.items.map((item) =>
              item.id !== itemId
                ? item
                : {
                    ...item,
                    ...updates,
                    updatedAt: nowIso(),
                  }
            ),
          }
    ),
  } satisfies PlatformTrackerBoard;
}

export function getPlatformTrackerProgress(section: PlatformTrackerSection) {
  if (!section.items.length) return 0;
  const completed = section.items.filter((item) => item.status === "done").length;
  return Math.round((completed / section.items.length) * 100);
}
