import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const jwt = require("../backend/node_modules/jsonwebtoken");

const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:4000";
const FRONTEND_URL = process.env.PLAYWRIGHT_FRONTEND_URL || "http://127.0.0.1:5173";
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
  slug: "mamaboi",
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

async function preparePaidInvoice(request, authHeaders) {
  const reset = await request.post(`${BACKEND_URL}/billing/dev/reset`, {
    headers: authHeaders,
    data: {
      planId: "starter",
      status: "trialing",
      resetUsage: true,
      resetInvoices: true,
    },
  });
  expect(reset.ok()).toBeTruthy();

  const upgrade = await request.post(`${BACKEND_URL}/billing/upgrade`, {
    headers: authHeaders,
    data: {
      planId: "growth",
      billingCycle: "monthly",
      provider: "mpesa",
    },
  });
  expect(upgrade.ok()).toBeTruthy();

  const snapshotResponse = await request.get(`${BACKEND_URL}/billing/me`, {
    headers: authHeaders,
  });
  expect(snapshotResponse.ok()).toBeTruthy();
  const snapshot = await snapshotResponse.json();
  const invoice = snapshot.invoices[0];
  expect(invoice, "Expected an upgrade invoice for billing regression").toBeTruthy();
  expect(snapshot.subscription.status).toBe("past_due");
  expect(invoice.status).toBe("pending");
  return invoice.id;
}

async function simulateBillingEvent(request, authHeaders, eventType, invoiceId) {
  const response = await request.post(`${BACKEND_URL}/billing/dev/simulate`, {
    headers: authHeaders,
    data: { eventType, invoiceId },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function waitForBillingState(request, authHeaders, expectedInvoiceStatus) {
  await expect
    .poll(async () => {
      const response = await request.get(`${BACKEND_URL}/billing/me`, {
        headers: authHeaders,
      });
      expect(response.ok()).toBeTruthy();
      const payload = await response.json();
      return {
        subscriptionStatus: payload.subscription.status,
        invoiceStatus: payload.invoices[0]?.status || "missing",
      };
    })
    .toEqual({
      subscriptionStatus: "past_due",
      invoiceStatus: expectedInvoiceStatus,
    });
}

async function assertBillingPage(browser, token) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ authToken, user, restaurant }) => {
      localStorage.setItem("mv_auth_token_v1", authToken);
      localStorage.setItem("mv_auth_user_v1", JSON.stringify(user));
      localStorage.setItem("mv_restaurant_profile_v1", JSON.stringify(restaurant));
    },
    { authToken: token, user: OWNER_USER, restaurant: RESTAURANT_PROFILE }
  );
  const page = await context.newPage();
  const billingResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/billing/me") && response.request().method() === "GET"
  );

  await page.goto(`${FRONTEND_URL}/dashboard/billing`, { waitUntil: "networkidle" });
  const billingResponse = await billingResponsePromise;
  const snapshot = await billingResponse.json();
  const body = await page.locator("body").innerText();

  expect(snapshot.subscription.status).toBe("past_due");
  expect(snapshot.invoices[0]?.status).toBe("failed");
  await expect(page.getByText("Action Required", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("A live invoice is overdue or a payment failed. Review billing to avoid interruption.")).toBeVisible();
  await expect(page.getByText("Payment Failed", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Resolve Billing Issue" })).toBeVisible();
  expect(body.includes("No open invoices. The current paid billing state is settled.")).toBe(false);
  await context.close();
}

test.describe("billing failed timeout truthfulness", () => {
  test("billing page stays truthful for failed and timeout invoice states", async ({ browser, request }) => {
    const token = createOwnerToken();
    const authHeaders = { Authorization: `Bearer ${token}` };
    const invoiceId = await preparePaidInvoice(request, authHeaders);

    const failedPayload = await simulateBillingEvent(request, authHeaders, "payment_failed", invoiceId);
    expect(failedPayload.subscription.status).toBe("past_due");
    expect(failedPayload.invoices[0]?.status).toBe("failed");
    await waitForBillingState(request, authHeaders, "failed");
    await assertBillingPage(browser, token);

    const timeoutPayload = await simulateBillingEvent(request, authHeaders, "payment_timeout", invoiceId);
    expect(timeoutPayload.subscription.status).toBe("past_due");
    expect(timeoutPayload.invoices[0]?.status).toBe("failed");
    await waitForBillingState(request, authHeaders, "failed");
    await assertBillingPage(browser, token);
  });
});
