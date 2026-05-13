import { expect, test } from "playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const AUTH_USER = {
  id: "mobile_qa_user",
  name: "Mobile QA Owner",
  email: "mobile-qa@ubhona.com",
  role: "owner",
  createdAt: "2026-04-24T00:00:00.000Z",
};

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(metrics.scrollWidth, `document width overflowed mobile viewport: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(
    metrics.innerWidth + 1
  );
  expect(metrics.bodyScrollWidth, `body width overflowed mobile viewport: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(
    metrics.innerWidth + 1
  );
}

test.describe("mobile launch QA", () => {
  test.use({
    viewport: MOBILE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });

  test("landing page stays usable on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Get Started" }).first()).toBeVisible();

    await page.locator("#feature-highlights").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Bring restaurant menus to life" })).toBeVisible();
    await expect(page.getByText("AR Menu Preview")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("pricing page stays usable on mobile", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Billing Overview", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage Subscription" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("signup page stays usable on mobile", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
    await expect(page.getByText("Google Sign-In is not configured for this environment.")).toBeVisible();
    await expect(page.locator("#signup-confirm-password")).toHaveCount(0);
    await expect(page.getByText("Terms of Service")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("login page stays usable on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Google Sign-In is not configured for this environment.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enter Demo Mode" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("onboarding page stays usable on mobile", async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("mv_auth_user_v1", JSON.stringify(user));
      localStorage.setItem("mv_auth_token_v1", "local:mobile_qa_user");
      localStorage.removeItem("mv_restaurant_profile_v1");
      localStorage.removeItem("mv_onboarding_draft_v2:mobile_qa_user");
    }, AUTH_USER);

    await page.goto("/onboarding?previewOnboarding=1");
    await expect(page.getByText("Fast Onboarding", { exact: true })).toBeVisible();
    await expect(page.locator("#onboarding-restaurant-name")).toBeVisible();
    await expect(page.locator("#onboarding-phone")).toBeVisible();
    await expect(page.locator("#onboarding-slug")).not.toBeVisible();
    await expect(page.getByText("Optional profile details")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await expect(page.getByText("1. Restaurant setup")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
