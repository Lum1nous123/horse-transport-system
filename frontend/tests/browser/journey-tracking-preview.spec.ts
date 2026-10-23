import { expect, test } from "@playwright/test";

for (const role of ["customer", "logistics"] as const) {
  test(`${role} journey preview shows the same order and safe contact details`, async ({ page }, testInfo) => {
    await page.goto(`/${role}/orders/order-2068/tracking?preview=1`);
    await expect(page.getByRole("heading", { name: "Journey tracking" })).toBeVisible();
    await expect(page.getByText("ORD-2068").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Vehicle TRK-101" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Vehicle TRK-102" })).toBeVisible();
    await expect(page.getByText("Not available").first()).toBeVisible();
    await expect(page.getByText("Air leg welfare check recorded")).toBeVisible();
    await expect(page.getByText("Welfare stop B")).toBeVisible();
    await expect(page.locator("a[href^='mailto:']")).toHaveCount(0);
    await expect(page.getByRole("region", { name: /map/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${role}-journey.png`), fullPage: true });
  });
}

test("Customer sees server-style in-app updates; LM does not", async ({ page }) => {
  await page.goto("/customer/orders/order-2068/tracking?preview=1");
  await expect(page.getByRole("heading", { name: "Latest updates" })).toBeVisible();
  await expect(page.getByText("Remaining balance paid")).toBeVisible();
  await page.goto("/logistics/orders/order-2068/tracking?preview=1");
  await expect(page.getByRole("heading", { name: "Latest updates" })).toHaveCount(0);
});

test("denied and empty preview states never reveal journey details", async ({ page }) => {
  await page.goto("/customer/orders/order-2068/tracking?preview=1&scenario=forbidden");
  await expect(page.getByRole("heading", { name: "You can’t view this journey" })).toBeVisible();
  await expect(page.getByText("+31 6 1234 5678")).toHaveCount(0);
  await page.goto("/customer/orders/order-2068/tracking?preview=1&scenario=empty");
  await expect(page.getByText("No journey progress has been recorded yet.")).toBeVisible();
  await expect(page.getByText("No updates yet.")).toBeVisible();
});

test("delivered and refund previews show their respective server-style events", async ({ page }) => {
  await page.goto("/customer/orders/order-2068/tracking?preview=1&scenario=delivered");
  await expect(page.getByText("Proof of Delivery recorded for BE-210")).toBeVisible();
  await expect(page.getByText("Order delivered")).toBeVisible();
  await page.goto("/customer/orders/order-2068/tracking?preview=1&scenario=refund");
  await expect(page.getByText("Deposit refunded")).toBeVisible();
  await expect(page.getByText("No journey progress has been recorded yet.")).toBeVisible();
});
