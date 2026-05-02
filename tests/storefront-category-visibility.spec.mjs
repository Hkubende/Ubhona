import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const jwt = require("../backend/node_modules/jsonwebtoken");

const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:4000";
const FRONTEND_URL = process.env.PLAYWRIGHT_FRONTEND_URL || "http://127.0.0.1:5173";
const STORE_SLUG = "mamaboi";
const BRANCH_ID = "main";
const CATEGORY_NAME = "Main";
const DISH_NAME = "Chapati + Meat";
const OWNER_USER = {
  id: "5002366c-a2d2-4b62-968d-ecc025ac3f2d",
  name: "Mama Boi Owner",
  email: "mamaboi.owner.20260330@example.com",
  role: "restaurant_owner",
  createdAt: "2026-03-30T10:15:10.552Z",
};
const RESTAURANT_PROFILE = {
  id: "d4b391ac-472b-4b7a-aa34-7fcfc43c343d",
  restaurantName: "Mamaboi",
  slug: STORE_SLUG,
  phone: "+254700000001",
  email: OWNER_USER.email,
  location: "Nairobi, Kenya",
  subscriptionPlan: "starter",
  subscriptionStatus: "trialing",
  createdAt: OWNER_USER.createdAt,
};

function readEnvValue(key) {
  const envPath = resolve(process.cwd(), "backend/.env");
  const source = readFileSync(envPath, "utf8");
  const line = source
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) {
    throw new Error(`Missing ${key} in backend/.env`);
  }
  return line.slice(key.length + 1).trim();
}

function createOwnerToken() {
  const secret = readEnvValue("JWT_SECRET");
  return jwt.sign(
    {
      sub: OWNER_USER.id,
      email: OWNER_USER.email,
      role: OWNER_USER.role,
    },
    secret,
    { expiresIn: "8h" }
  );
}

async function getOwnerCategoryAndDish(request, authHeaders) {
  const [categoriesResponse, dishesResponse] = await Promise.all([
    request.get(`${BACKEND_URL}/categories`, { headers: authHeaders }),
    request.get(`${BACKEND_URL}/dishes?branchId=${BRANCH_ID}`, { headers: authHeaders }),
  ]);
  expect(categoriesResponse.ok()).toBeTruthy();
  expect(dishesResponse.ok()).toBeTruthy();

  const categories = await categoriesResponse.json();
  const dishes = await dishesResponse.json();

  const category = categories.find((entry) => entry.name === CATEGORY_NAME);
  const dish = dishes.find((entry) => entry.name === DISH_NAME);

  expect(category, `Missing category ${CATEGORY_NAME}`).toBeTruthy();
  expect(dish, `Missing dish ${DISH_NAME}`).toBeTruthy();
  expect(dish.categoryId).toBe(category.id);

  return { category, dish };
}

async function setCategoryVisibility(request, authHeaders, category, isActive) {
  const response = await request.patch(`${BACKEND_URL}/categories/${category.id}`, {
    headers: authHeaders,
    data: {
      name: category.name,
      sortOrder: category.sortOrder,
      isActive,
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.menuControl?.isActive).toBe(isActive);
}

async function waitForStorefrontState(request, expectedVisible) {
  await expect
    .poll(async () => {
      const response = await request.get(`${BACKEND_URL}/restaurants/${STORE_SLUG}/storefront?branchId=${BRANCH_ID}`);
      expect(response.ok()).toBeTruthy();
      const payload = await response.json();
      return {
        categories: payload.categories.map((entry) => entry.name),
        dishes: payload.dishes.map((entry) => entry.name),
      };
    })
    .toEqual(
      expectedVisible
        ? { categories: [CATEGORY_NAME], dishes: [DISH_NAME] }
        : { categories: [], dishes: [] }
    );
}

async function assertPublicStorefront(browser, expectedVisible) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let storefrontPayload = null;

  const storefrontResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/restaurants/${STORE_SLUG}/storefront?branchId=${BRANCH_ID}`) &&
      response.request().method() === "GET"
  );

  await page.goto(`${FRONTEND_URL}/r/${STORE_SLUG}/menu`, { waitUntil: "networkidle" });
  const storefrontResponse = await storefrontResponsePromise;
  storefrontPayload = await storefrontResponse.json();

  const body = await page.locator("body").innerText();

  if (expectedVisible) {
    expect(storefrontPayload.categories.map((entry) => entry.name)).toEqual([CATEGORY_NAME]);
    expect(storefrontPayload.dishes.map((entry) => entry.name)).toEqual([DISH_NAME]);
    await expect(page.getByText("1 CATEGORIES")).toBeVisible();
    await expect(page.getByText("1 VISIBLE DISHES")).toBeVisible();
    await expect(page.getByRole("heading", { name: CATEGORY_NAME, exact: true })).toBeVisible();
    await expect(page.getByText(DISH_NAME, { exact: true })).toBeVisible();
  } else {
    expect(storefrontPayload.categories).toEqual([]);
    expect(storefrontPayload.dishes).toEqual([]);
    await expect(page.getByText("0 CATEGORIES")).toBeVisible();
    await expect(page.getByText("0 VISIBLE DISHES")).toBeVisible();
    await expect(page.getByText("No dishes match your current search/filter.")).toBeVisible();
    expect(body.includes(DISH_NAME)).toBe(false);
  }

  await context.close();
}

test.describe("storefront category visibility", () => {
  test("owner hide/show updates the public storefront", async ({ browser, request }) => {
    const token = createOwnerToken();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const { category } = await getOwnerCategoryAndDish(request, authHeaders);

    await setCategoryVisibility(request, authHeaders, category, true);
    await waitForStorefrontState(request, true);
    await assertPublicStorefront(browser, true);

    const ownerContext = await browser.newContext();
    await ownerContext.addInitScript(
      ({ authToken, user, restaurant }) => {
        localStorage.setItem("mv_auth_token_v1", authToken);
        localStorage.setItem("mv_auth_user_v1", JSON.stringify(user));
        localStorage.setItem("mv_restaurant_profile_v1", JSON.stringify(restaurant));
      },
      { authToken: token, user: OWNER_USER, restaurant: RESTAURANT_PROFILE }
    );
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`${FRONTEND_URL}/dashboard/menu`, { waitUntil: "networkidle" });

    const categoryToolsButton = ownerPage.getByRole("button", {
      name: /Quick category tools|Hide category tools/,
    });
    if ((await categoryToolsButton.innerText()) === "Quick category tools") {
      await categoryToolsButton.click();
    }

    const hidePatchPromise = ownerPage.waitForResponse(
      (response) =>
        response.url().includes(`/categories/${category.id}`) &&
        response.request().method() === "PATCH"
    );
    await ownerPage.getByRole("button", { name: "Hide", exact: true }).click();
    const hidePatch = await hidePatchPromise;
    expect(hidePatch.ok()).toBeTruthy();
    expect(hidePatch.request().postDataJSON()).toMatchObject({ isActive: false });
    await expect(ownerPage.getByText("Hidden on storefront")).toBeVisible();
    await waitForStorefrontState(request, false);
    await assertPublicStorefront(browser, false);

    const showPatchPromise = ownerPage.waitForResponse(
      (response) =>
        response.url().includes(`/categories/${category.id}`) &&
        response.request().method() === "PATCH"
    );
    await ownerPage.getByRole("button", { name: "Show", exact: true }).click();
    const showPatch = await showPatchPromise;
    expect(showPatch.ok()).toBeTruthy();
    expect(showPatch.request().postDataJSON()).toMatchObject({ isActive: true });
    await expect(ownerPage.getByText("Visible on storefront")).toBeVisible();
    await waitForStorefrontState(request, true);
    await assertPublicStorefront(browser, true);

    await ownerContext.close();
  });
});
