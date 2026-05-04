import { expect, test } from "playwright/test";

const ADMIN_USER = {
  id: "local_platform_admin",
  name: "Local Platform Admin",
  email: "admin@ubhona.demo",
  role: "platform_admin",
  createdAt: "2026-05-03T00:00:00.000Z",
};

const RESTAURANT_PROFILE = {
  id: "admin_demo_restaurant",
  restaurantName: "Ubhona Admin Demo Kitchen",
  slug: "admin-demo",
  phone: "+254700000000",
  email: "owner@ubhona.demo",
  location: "Nairobi",
  subscriptionPlan: "growth",
  subscriptionStatus: "past_due",
  createdAt: "2026-05-03T00:00:00.000Z",
};

test.describe("admin dashboard", () => {
  test("renders the platform admin control center with local fallback data", async ({ page }) => {
    await page.addInitScript(
      ({ user, restaurant }) => {
        localStorage.setItem("mv_auth_user_v1", JSON.stringify(user));
        localStorage.setItem("mv_auth_token_v1", "local:local_platform_admin");
        localStorage.setItem("mv_restaurant_profile_v1", JSON.stringify(restaurant));
        localStorage.setItem("mv_restaurant_profiles_registry_v1", JSON.stringify([restaurant]));
        localStorage.setItem(
          "mv_restaurant_dishes_v1",
          JSON.stringify({
            [restaurant.id]: [
              {
                id: "admin-demo-dish",
                restaurantId: restaurant.id,
                categoryId: "admin-demo-category",
                name: "Admin Demo Dish",
                price: 1200,
                isAvailable: true,
              },
            ],
          })
        );
        localStorage.setItem(
          "mv_orders_v1",
          JSON.stringify([
            {
              id: "admin-demo-order",
              restaurantId: restaurant.id,
              createdAt: "2026-05-03T00:30:00.000Z",
              total: 2400,
              paymentStatus: "failed",
            },
          ])
        );
      },
      { user: ADMIN_USER, restaurant: RESTAURANT_PROFILE }
    );

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Ubhona Control Center" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Restaurant Network" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Billing Watchlist" })).toBeVisible();
    await expect(page.getByRole("table").getByText("Ubhona Admin Demo Kitchen")).toBeVisible();
    await expect(page.getByRole("button", { name: /Review Restaurants/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Tenant operations Restaurants/i })).toBeVisible();
  });
});
