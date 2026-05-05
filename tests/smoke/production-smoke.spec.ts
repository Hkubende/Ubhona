import { expect, test, type Page } from "playwright/test";

const frontendUrl = normalizeUrl(process.env.UBHONA_FRONTEND_URL);
const backendUrl = normalizeUrl(process.env.UBHONA_BACKEND_URL);

test.setTimeout(60_000);

function normalizeUrl(value: string | undefined) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function requireSmokeEnv() {
  const missing = [
    !frontendUrl ? "UBHONA_FRONTEND_URL" : "",
    !backendUrl ? "UBHONA_BACKEND_URL" : "",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production smoke env var(s): ${missing.join(", ")}`,
    );
  }
}

function isSevereConsoleError(message: string) {
  return /uncaught|referenceerror|typeerror|is not defined|minified react error|failed to fetch dynamically imported module/i.test(
    message,
  );
}

function watchForRuntimeCrashes(page: Page) {
  const severe: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isSevereConsoleError(text)) severe.push(text);
  });
  page.on("pageerror", (error) => {
    severe.push(error.message);
  });
  return severe;
}

async function expectNoBlankOrCrash(
  page: Page,
  severeErrors: string[],
  label: string,
) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
    // Smoke checks should tolerate long-polling or slow analytics calls; visible content is asserted below.
  });
  expect(severeErrors, `${label} severe console/page errors`).toEqual([]);
  await expect
    .poll(async () => (await page.locator("body").innerText()).trim().length, {
      message: `${label} should not render a blank page`,
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  const bodyText = (await page.locator("body").innerText()).trim();
  expect(
    bodyText.length,
    `${label} should not render a blank page`,
  ).toBeGreaterThan(0);
  await expect(page.locator("body")).not.toContainText(
    /ReferenceError|TypeError|Application error/i,
  );
}

test.beforeAll(() => {
  requireSmokeEnv();
});

test("homepage loads the deployed Ubhona frontend", async ({ page }) => {
  const severeErrors = watchForRuntimeCrashes(page);
  const response = await page.goto(frontendUrl, {
    waitUntil: "domcontentloaded",
  });

  expect(response, "homepage response").not.toBeNull();
  expect(response?.ok(), `homepage HTTP status ${response?.status()}`).toBe(
    true,
  );
  await expectNoBlankOrCrash(page, severeErrors, "homepage");

  const title = await page.title();
  const bodyText = await page.locator("body").innerText();
  expect(`${title}\n${bodyText}`).toMatch(
    /Ubhona|menu|restaurant|AR|storefront|Visualize/i,
  );
});

test("backend health responds successfully", async ({ request }) => {
  const response = await request.get(`${backendUrl}/health`, {
    timeout: 60_000,
  });
  expect(response.ok(), `backend /health status ${response.status()}`).toBe(
    true,
  );

  const payload = await response.json();
  expect(payload).toMatchObject({ ok: true });
});

const dashboardRoutes = [
  "/dashboard",
  "/dashboard/menu",
  "/dashboard/orders",
  "/dashboard/kitchen",
  "/dashboard/payments",
  "/dashboard/settings",
];

for (const route of dashboardRoutes) {
  test(`dashboard route ${route} does not hard crash when unauthenticated`, async ({
    page,
  }) => {
    const severeErrors = watchForRuntimeCrashes(page);
    const response = await page.goto(`${frontendUrl}${route}`, {
      waitUntil: "domcontentloaded",
    });

    expect(response, `${route} response`).not.toBeNull();
    expect(response?.ok(), `${route} HTTP status ${response?.status()}`).toBe(
      true,
    );
    await expectNoBlankOrCrash(page, severeErrors, route);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(
      /sign in|login|dashboard|overview|orders|menu|kitchen|payments|settings|Ubhona/i,
    );
  });
}
