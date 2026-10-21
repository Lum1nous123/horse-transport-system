import { expect, test } from "@playwright/test";

test("before Start has no map; confirmed Start opens the first checkpoint", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/driver?preview=1");
  await expect(page.getByRole("heading", { name: "My ROAD work" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start my vehicle" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Planned route schematic" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("before-start.png"), fullPage: true });
  await page.getByRole("button", { name: "Start my vehicle" }).click();
  await expect(page).toHaveURL(/\/driver\/executions\/demo-execution-204/);
  await expect(page.getByRole("region", { name: "Planned route schematic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pathum Thani rest stop" })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    const map = await page.getByRole("region", { name: "Planned route schematic" }).boundingBox();
    const sheet = await page.getByRole("region", { name: "Pathum Thani rest stop", exact: true }).boundingBox();
    expect(map).not.toBeNull();
    expect(sheet).not.toBeNull();
    expect(sheet!.y).toBeGreaterThanOrEqual(map!.y + map!.height - 8);
  }
  await page.screenshot({ path: testInfo.outputPath("after-start.png"), fullPage: true });
  await expect(page.getByRole("button", { name: "Confirm checkpoint arrival" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start my vehicle" })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm checkpoint arrival" }).click();
  await expect(page.getByRole("heading", { name: "Bang Pa-in checkpoint" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm checkpoint arrival" }).click();
  await expect(page.getByRole("button", { name: "Confirm destination arrival" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm destination arrival" }).click();
  await expect(page.getByText("Your destination arrival is recorded.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm.*arrival|Complete leg/ })).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("a foreign direct assignment is denied", async ({ page }) => {
  await page.goto("/driver/executions/demo-execution-205?preview=1");
  await expect(page.getByRole("alert").filter({ hasText: "not assigned to you" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start my vehicle" })).toHaveCount(0);
});

test("a later leg cannot Start", async ({ page }) => {
  await page.goto("/driver?preview=1&scenario=locked");
  await expect(page.getByText("This leg is not current.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start my vehicle" })).toHaveCount(0);
});

test("an additional Driver can Start their own vehicle", async ({ page }) => {
  await page.goto("/driver?preview=1&scenario=additional-driver");
  await page.getByRole("button", { name: "Start my vehicle" }).click();
  await expect(page.getByRole("button", { name: "Confirm checkpoint arrival" })).toBeVisible();
});

test("a route with no checkpoints proceeds to destination arrival", async ({ page }) => {
  await page.goto("/driver?preview=1&scenario=no-checkpoints");
  await page.getByRole("button", { name: "Start my vehicle" }).click();
  await expect(page.getByRole("button", { name: "Confirm destination arrival" })).toBeVisible();
});
