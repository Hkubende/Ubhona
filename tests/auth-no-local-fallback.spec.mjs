import { expect, test } from "playwright/test";

test("signup does not create a local session when API is unreachable and fallback is disabled", async ({ page }) => {
  await page.route("**/health", async (route) => {
    await route.abort();
  });

  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.fill("#signup-name", "Render Honest Owner");
  await page.fill("#signup-email", `honest-${Date.now().toString(36)}@example.com`);
  await page.fill("#signup-password", "demo12345");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.locator("body")).toContainText("API is unreachable. Running in static/demo mode.");

  const token = await page.evaluate(() => localStorage.getItem("mv_auth_token_v1"));
  const user = await page.evaluate(() => localStorage.getItem("mv_auth_user_v1"));

  expect(token).toBeNull();
  expect(user).toBeNull();
});
