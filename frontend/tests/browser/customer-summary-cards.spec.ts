import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("Customer summary cards match the approved responsive card structure", async ({ page }, testInfo) => {
  await page.goto("/customer?preview=1");

  const summary = page.getByRole("region", { name: "Workspace summary" });
  const cards = summary.locator("article");
  await expect(cards).toHaveCount(4);
  await expect(summary.getByText("Total requests")).toBeVisible();
  await expect(summary.getByText("Draft requests")).toBeVisible();
  await expect(summary.getByText("In progress")).toBeVisible();
  await expect(summary.getByText("Horse profiles")).toBeVisible();
  await expect(summary.locator(".customer-summary-watermark")).toHaveCount(4);

  const boxes = await cards.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { x: box.x, y: box.y, width: box.width, borderRadius: Number.parseFloat(style.borderRadius), overflow: style.overflow };
  }));
  expect(boxes.every((box) => box.borderRadius >= 18 && box.overflow === "hidden")).toBe(true);

  if (testInfo.project.name === "desktop") {
    expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
    expect(Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width))).toBeLessThanOrEqual(2);
  } else {
    expect(Math.round(boxes[0].y)).toBe(Math.round(boxes[1].y));
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

  if (process.env.CAPTURE_CUSTOMER_SUMMARY === "1") {
    const evidenceDirectory = path.resolve(process.cwd(), "../plans/reports/evidence");
    await mkdir(evidenceDirectory, { recursive: true });
    await summary.screenshot({ path: path.join(evidenceDirectory, `customer-summary-cards-${testInfo.project.name}.png`) });
    await page.screenshot({ path: path.join(evidenceDirectory, `customer-dashboard-summary-${testInfo.project.name}.png`), fullPage: true });
  }
});
