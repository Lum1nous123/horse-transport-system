import { expect, test } from "@playwright/test";

test.use({ timezoneId: "America/Los_Angeles" });

test("Customer enters a date only and legacy departure never fills the new field", async ({ page }) => {
  let saved: Record<string, unknown> | undefined;
  await page.addInitScript(() => {
    sessionStorage.setItem("horse-transport-token", "date-browser-test");
    localStorage.setItem("hideCustomerTermsOnLogin", "true");
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/api/v1/orders" && request.method() === "POST") {
      saved = request.postDataJSON();
      return route.fulfill({ status: 201, headers, json: { id: "created", status: "DRAFT" } });
    }
    const json = path === "/api/v1/auth/me"
      ? { id: "customer", fullName: "Demo Customer", email: "customer1@demo.local", role: "CUSTOMER", status: "ACTIVE" }
      : path === "/api/v1/horses" ? []
        : path === "/api/v1/orders" ? [{ id: "legacy", orderCode: "ORD-legacy", status: "DRAFT", horseIds: [], originCountry: "France", destinationCountry: "Belgium", requestedDepartureAt: "2026-11-20T10:00:00", requestedDeliveryDate: null }]
          : null;
    return route.fulfill({ status: 200, headers, json });
  });
  await page.goto("/customer/requests");
  await page.getByRole("button", { name: "Drafts 1" }).click();
  const legacy = page.getByRole("heading", { name: "ORD-legacy" }).locator("xpath=ancestor::article");
  await expect(legacy.getByText("Not provided", { exact: true })).toBeVisible();
  await legacy.getByRole("button", { name: "Edit draft" }).click();
  await expect(page.getByLabel("Desired delivery date *")).toHaveValue("");
  await page.getByRole("button", { name: "Close form" }).click();
  await page.getByRole("button", { name: "New transport request" }).click();
  const date = page.getByLabel("Desired delivery date *");
  await expect(date).toHaveAttribute("type", "date");
  await date.fill("2026-11-25");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => saved?.requestedDeliveryDate).toBe("2026-11-25");
  expect(saved).not.toHaveProperty("requestedDepartureAt");
});

test("FRC queue shows desired calendar dates without departure times", async ({ page }) => {
  await page.goto("/fleet-route-coordinator?preview=1");
  await expect(page.getByRole("columnheader", { name: "Desired delivery date" })).toBeVisible();
  const dates = page.locator('td[data-label="Desired delivery date"]');
  await expect(dates.first()).toBeVisible();
  for (const text of await dates.allTextContents()) expect(text).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
});

test("LM upcoming desired deliveries includes today at the end of the local day", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-15T07:59:00Z") });
  await page.goto("/logistics/dashboard?preview=1");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Upcoming desired deliveries", exact: true }) });
  await expect(panel.locator("li")).toHaveCount(1);
  await expect(panel.locator("time")).toHaveText("14 Nov 2026");
});
