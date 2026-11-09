import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const horses = [
  { id: "horse-1", name: "Willow", microchipId: "MC-001", breed: "Warmblood", sex: "MARE", passportNumber: "P-001", dateOfBirth: "2018-03-14" },
  { id: "horse-2", name: "Apollo", microchipId: "MC-002", breed: "Thoroughbred", sex: "GELDING", passportNumber: "P-002", dateOfBirth: "2017-06-02" },
];

const orders = [
  { id: "order-1", orderCode: "ORD-REAL-001", originCountry: "France", destinationCountry: "Belgium", requestedDepartureAt: "2026-11-10T09:00:00", transportMode: "ROAD", recipientName: "Taylor", recipientPhone: "+32 1", horseIds: ["horse-1"], status: "DRAFT" },
  { id: "order-2", orderCode: "ORD-REAL-002", originCountry: "Germany", destinationCountry: "Netherlands", requestedDepartureAt: "2026-12-01T10:00:00", transportMode: "AIR", recipientName: "Morgan", recipientPhone: "+31 2", horseIds: ["horse-2"], status: "SUBMITTED" },
  { id: "order-3", orderCode: "ORD-REAL-003", originCountry: "Ireland", destinationCountry: "France", requestedDepartureAt: "2026-12-15T08:00:00", transportMode: "ROAD", recipientName: "Alex", recipientPhone: "+33 3", horseIds: ["horse-1"], status: "REJECTED", rejectionReason: "The delivery contact details are incomplete." },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("horse-transport-token", "browser-customer-token");
    window.localStorage.setItem("hideCustomerTermsOnLogin", "true");
  });
  await page.route("**/api/v1/**", async (route) => {
    const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === "/api/v1/auth/me"
      ? { id: "customer-1", fullName: "Customer One", email: "customer@example.com", phone: null, role: "CUSTOMER", status: "ACTIVE" }
      : pathname === "/api/v1/horses" ? horses
        : pathname === "/api/v1/orders" ? orders
          : null;
    await route.fulfill({ headers: corsHeaders, status: body === null ? 204 : 200, contentType: "application/json", body: body === null ? "" : JSON.stringify(body) });
  });
});

test("Customer dashboard keeps the minimal header and searchable horse summary", async ({ page }) => {
  await page.goto("/customer");

  const header = page.locator("header.customer-topbar");
  await expect(header.getByText("Horse Transport System")).toBeVisible();
  await expect(header.getByText("Customer", { exact: true })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Transport requests" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Horse profiles" })).toHaveCount(0);

  const panel = page.getByRole("region", { name: "Horse profiles" });
  await panel.getByRole("button", { name: "Add horse" }).click();
  await expect(page).toHaveURL(/\/customer$/);
  await expect(panel.getByRole("heading", { name: "New horse profile" })).toBeVisible();
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel.locator(".customer-horse-gender.is-female")).toContainText("Female");
  await expect(panel.locator(".customer-horse-gender.is-male")).toContainText("Male");
  await panel.getByRole("searchbox", { name: "Search horse profiles" }).fill("Will");
  await expect(panel.getByText("Willow", { exact: true })).toBeVisible();
  await expect(panel.getByText("Apollo", { exact: true })).toBeHidden();
  await panel.getByRole("searchbox", { name: "Search horse profiles" }).clear();
  await panel.getByRole("button", { name: "Delete Apollo" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete Apollo?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep profile" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Customer opens official request and horse pages using current API data", async ({ page }, testInfo) => {
  await page.goto("/customer/requests");

  await expect(page.getByRole("heading", { name: "Transport requests", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Transport requests" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Horse profiles" })).toHaveCount(0);
  await page.getByRole("button", { name: "All 3", exact: true }).click();
  await expect(page.getByText("ORD-REAL-001", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search transport requests" }).fill("Germany");
  await expect(page.getByText("ORD-REAL-001", { exact: true })).toBeHidden();
  await expect(page.getByText("ORD-REAL-002")).toBeVisible();

  if (process.env.CAPTURE_CUSTOMER_NAV === "1") {
    const evidenceDirectory = path.resolve(process.cwd(), "../plans/reports/evidence");
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDirectory, `customer-requests-${testInfo.project.name}.png`), fullPage: true });
  }

  await page.screenshot({ path: testInfo.outputPath("customer-requests.png"), fullPage: true });
  await page.goto("/customer/horses");
  await expect(page).toHaveURL(/\/customer\/horses$/);
  await expect(page.getByRole("link", { name: "Horse profiles" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Horse profiles", level: 1 })).toBeVisible();
  await expect(page.getByText("Apollo", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Filter horse profiles by sex" }).selectOption("MARE");
  await expect(page.getByText("Willow", { exact: true })).toBeVisible();
  await expect(page.getByText("Apollo", { exact: true })).toBeHidden();

  await expect(page.getByText("Navigation prototype")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("PREVIEW-");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  if (process.env.CAPTURE_CUSTOMER_NAV === "1") {
    const evidenceDirectory = path.resolve(process.cwd(), "../plans/reports/evidence");
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDirectory, `customer-horses-${testInfo.project.name}.png`), fullPage: true });
  }
});

test("Customer sees why a transport request was rejected and starts a separate new request", async ({ page }) => {
  await page.goto("/customer");

  await page.getByRole("button", { name: "History 1", exact: true }).click();
  const rejectedOrder = page.locator(".customer-order-row").filter({ hasText: "ORD-REAL-003" });
  await expect(rejectedOrder.getByText("REJECTED", { exact: true })).toBeVisible();
  await expect(rejectedOrder.getByRole("heading", { name: "Transport request rejected" })).toBeVisible();
  await expect(rejectedOrder.getByRole("region", { name: "Transport request rejection details" })).toContainText("Reason: The delivery contact details are incomplete.");
  await expect(rejectedOrder.getByText(/cannot be edited or resubmitted/)).toBeVisible();
  await expect(rejectedOrder.getByRole("button", { name: "Edit draft" })).toHaveCount(0);
  await expect(rejectedOrder.getByRole("button", { name: "New transport request" })).toHaveCount(0);

  await page.getByRole("button", { name: "New transport request" }).click();
  await expect(page.getByRole("dialog", { name: "Plan a transport" })).toBeVisible();
  await expect(page).toHaveURL(/\/customer$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});
