import { expect, test } from "playwright/test";

const AUTH_USER = {
  id: "animated_modal_owner",
  name: "Animated Modal Owner",
  email: "animated-modal@ubhona.com",
  role: "owner",
  createdAt: "2026-05-02T00:00:00.000Z",
};

const RESTAURANT_PROFILE = {
  id: "local_default_restaurant",
  restaurantName: "Ubhona Demo Kitchen",
  slug: "ubhona-demo",
  phone: "+254700000000",
  email: AUTH_USER.email,
  location: "Nairobi",
  subscriptionPlan: "growth",
  subscriptionStatus: "active",
  onboardingCompleted: true,
  createdAt: AUTH_USER.createdAt,
};

async function openDashboard(page) {
  await page.addInitScript(
    ({ user, restaurant }) => {
      const dishes = [
        {
          id: "dish-signature-burger",
          restaurantId: restaurant.id,
          categoryId: "cat-burgers",
          name: "Signature Burger",
          desc: "House sauce, pickled onion, double patty.",
          price: 1200,
          thumb: "",
          model: "",
          isAvailable: true,
          createdAt: "2026-05-02T00:00:00.000Z",
        },
      ];
      const orders = [
        {
          id: "animated-modal-order-001",
          restaurantId: restaurant.id,
          createdAt: "2026-05-02T00:10:00.000Z",
          items: [
            {
              dishId: "dish-signature-burger",
              name: "Signature Burger",
              quantity: 2,
              unitPrice: 1200,
              subtotal: 2400,
            },
          ],
          subtotal: 2400,
          total: 2400,
          customerName: "QA Guest",
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: "manual_mpesa",
          paymentReference: "QA-001",
          source: "customer",
        },
      ];

      localStorage.setItem("mv_auth_user_v1", JSON.stringify(user));
      localStorage.setItem("mv_auth_token_v1", "local:animated_modal_owner");
      localStorage.setItem("mv_restaurant_profile_v1", JSON.stringify(restaurant));
      localStorage.setItem("mv_restaurant_dishes_v1", JSON.stringify({ [restaurant.id]: dishes }));
      localStorage.setItem("mv_orders_v1", JSON.stringify(orders));
      localStorage.setItem(
        "mv_analytics_events_v1",
        JSON.stringify([
          {
            id: "animated-modal-analytics-001",
            createdAt: "2026-05-02T00:11:00.000Z",
            restaurantId: restaurant.id,
            eventType: "order_placed",
            orderId: "animated-modal-order-001",
            source: "playwright",
            metadata: {
              items: [
                {
                  dishId: "dish-signature-burger",
                  name: "Signature Burger",
                  quantity: 2,
                  unitPrice: 1200,
                  subtotal: 2400,
                },
              ],
            },
          },
        ])
      );
    },
    { user: AUTH_USER, restaurant: RESTAURANT_PROFILE }
  );

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Popular Dishes" })).toBeVisible();
}

function signatureBurgerTrigger(page) {
  return page.locator(
    'button[data-layout-id="ubhona-layout-modal-popular-dish-dish-signature-burger"]'
  );
}

test.describe("animated layout modal card", () => {
  test("opens from a dashboard card, closes on Escape, and restores focus", async ({ page }) => {
    await openDashboard(page);

    const trigger = signatureBurgerTrigger(page);
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Signature Burger" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("data-state", "open");
    await expect(trigger).toHaveClass(/is-open/);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute("data-state", "closed");
    await expect(trigger).not.toHaveClass(/is-open/);
    await expect(trigger).toBeFocused();
  });

  test("closes on backdrop click without closing from inside modal content", async ({ page }) => {
    await openDashboard(page);

    const trigger = signatureBurgerTrigger(page);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Signature Burger" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("heading", { name: "Signature Burger" }).click();
    await expect(dialog).toBeVisible();

    await page.locator("dialog.ubhona-layout-modal-dialog").click({ position: { x: 8, y: 8 } });
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("reduced motion keeps behavior intact", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query) => ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    });
    await openDashboard(page);

    const trigger = signatureBurgerTrigger(page);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Signature Burger" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
