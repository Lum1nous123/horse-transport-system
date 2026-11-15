import { expect, test } from "@playwright/test";

test("assignment table is readable at the current viewport and has keyboard tabs", async ({ page }, testInfo) => {
  await page.goto("/logistics/assignments?preview=1");
  const table = page.getByRole("table", { name: "Orders needing staff assignment" });
  await expect(table).toBeVisible();
  await expect(page.getByRole("tab", { name: /Needs assignment/ })).toHaveAttribute("aria-selected", "true");
  await expect(table.getByRole("columnheader")).toHaveCount(5);
  await expect(table.getByRole("link", { name: /Assign staff/ }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Logistics workspaces" }).getByRole("link")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("assignment.png"), fullPage: true });
  const firstTab = page.getByRole("tab", { name: /Needs assignment/ });
  await firstTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /^Assigned/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /View assignment for/ }).first()).toBeVisible();
});

test("orders preserve the compact workflow and explicit quotation editing", async ({ page }, testInfo) => {
  await page.goto("/logistics?preview=1");
  await expect(page.getByRole("heading", { name: "Select an order" })).toHaveCount(testInfo.project.name === "mobile" ? 0 : 1);
  await page.getByRole("button", { name: /ORD-DEMO-2048/ }).click();
  await page.getByRole("button", { name: "Prepare quotation" }).click();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  await page.getByRole("textbox", { name: /Notes/ }).fill("Keep my draft");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: /Back to submitted orders/ }).click();
    await expect(page.getByRole("button", { name: /ORD-DEMO-2048/ })).toBeFocused();
    await page.getByRole("combobox", { name: "Mode", exact: true }).selectOption("ROAD");
    await expect(page.getByRole("button", { name: /ORD-DEMO-2048/ })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Mode", exact: true }).selectOption("ALL");
    await page.getByRole("button", { name: /ORD-DEMO-2048/ }).click();
  } else {
    await page.getByRole("combobox", { name: "Mode", exact: true }).selectOption("ROAD");
    await expect(page.getByText(/The open order is outside your current filters/)).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
  }
  await expect(page.getByRole("textbox", { name: /Notes/ })).toHaveValue("Keep my draft");
  await page.getByRole("button", { name: "Hide editor" }).click();
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("orders.png"), fullPage: true });
  await page.getByRole("button", { name: "Edit quotation" }).click();
  await expect(page.getByRole("button", { name: "Send quotation" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("journey tabs use API response statuses with no production preview data", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("horse-transport-token", "browser-test-token"));
  const base = {
    originAddress: "Test origin", originCountry: "VN", destinationAddress: "Test destination", destinationCountry: "VN",
    requestedDeliveryDate: "2026-11-10", horseCount: 2, transportMode: "ROAD", createdAt: "2026-11-01T09:00:00Z", deliveredAt: null,
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: {
      "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Accept", "Access-Control-Allow-Methods": "GET",
    } });
    const body = path === "/api/v1/auth/me"
      ? { id: "lm-test", fullName: "Test LM", role: "LOGISTICS_MANAGER", status: "ACTIVE" }
      : path === "/api/v1/lm/tracking-orders"
        ? ["READY_TO_SHIP", "IN_PROGRESS", "DELIVERED", "APPROVED"].map((status, index) => ({ ...base, orderId: "test-" + index, orderCode: "ORD-TEST-" + index, status }))
        : null;
    await route.fulfill({ status: body ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
  });
  await page.goto("/logistics/tracking");
  await expect(page.getByRole("tab", { name: "Active 2", exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
  await page.getByRole("tab", { name: "Delivered 1", exact: true }).click();
  await expect(page.getByText("ORD-TEST-2")).toBeVisible();
  await page.getByRole("tab", { name: "Other trackable 1", exact: true }).click();
  await expect(page.getByText("ORD-TEST-3")).toBeVisible();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("journeys.png"), fullPage: true });
});
