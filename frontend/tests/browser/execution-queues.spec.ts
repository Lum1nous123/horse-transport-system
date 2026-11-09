import { expect, test, type Page } from "@playwright/test";

const driverId = "50000000-0000-0000-0000-000000000001";
const escortId = "50000000-0000-0000-0000-000000000002";
const uuid = (prefix: string, index: number) => prefix + "0000000-0000-0000-0000-" + String(index).padStart(12, "0");
const roadRows = [
  { executionId: uuid("1", 1), roadLegVehicleId: uuid("2", 1), routeLegId: uuid("3", 1),
    orderId: uuid("4", 1), orderCode: "ORD-QUEUE-10", orderStatus: "IN_PROGRESS", routeLegSequenceNo: 1,
    routeLegStatus: "READY", isFinalLeg: false, origin: "Paris", destination: "Brussels",
    plannedDepartureAt: "2026-11-12T08:00:00", vehiclePlateNumber: "TRK-READY", vehicleName: "Horse van",
    horseCount: 2, status: "NOT_STARTED", reachedCheckpointCount: 0, pendingCheckpointWelfareCount: 0,
    destinationArrivedAt: null, finalWelfareRecorded: false, proofOfDeliveryRecorded: false, proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "READY", orderStatus: "IN_PROGRESS" } },
  { executionId: uuid("1", 2), roadLegVehicleId: uuid("2", 2), routeLegId: uuid("3", 1),
    orderId: uuid("4", 1), orderCode: "ORD-QUEUE-10", orderStatus: "IN_PROGRESS", routeLegSequenceNo: 1,
    routeLegStatus: "IN_PROGRESS", isFinalLeg: false, origin: "Paris", destination: "Brussels",
    plannedDepartureAt: "2026-11-13T08:00:00", vehiclePlateNumber: "TRK-RUNNING", vehicleName: "Horse van",
    horseCount: 3, status: "IN_PROGRESS", reachedCheckpointCount: 1, pendingCheckpointWelfareCount: 1,
    destinationArrivedAt: null, finalWelfareRecorded: false, proofOfDeliveryRecorded: false, proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" } },
];

async function mockQueueApi(page: Page, role: "DRIVER" | "ESCORT") {
  let mutations = 0;
  await page.addInitScript(() => sessionStorage.setItem("horse-transport-token", "queue-browser-test"));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Accept, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() !== "GET") { mutations++; return route.fulfill({ status: 400, headers, json: {} }); }
    let body: unknown;
    if (path.endsWith("/auth/me")) body = { id: role === "DRIVER" ? driverId : escortId, fullName: role + " test", role, status: "ACTIVE" };
    else if (path.endsWith("/road-executions/assigned")) body = { executions: roadRows };
    else if (path.endsWith("/air-executions/assigned")) body = { executions: [{
      executionId: uuid("6", 1), orderId: uuid("4", 2), orderCode: "ORD-AIR-20", orderStatus: "READY_TO_SHIP",
      routeLegId: uuid("3", 2), routeLegSequenceNo: 2, routeLegStatus: "PLANNED", isFinalLeg: false,
      origin: "Amsterdam airport", destination: "London airport", plannedDepartureAt: "2026-11-14T08:00:00",
      plannedArrivalAt: "2026-11-14T10:00:00", status: "NOT_STARTED", welfareRecorded: false,
      proofOfDeliveryRecorded: false, proofOfDeliveryAvailable: false,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "PLANNED", orderStatus: "READY_TO_SHIP" },
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    }] };
    else {
      const summary = roadRows.find((row) => path.endsWith(row.executionId));
      if (summary) body = { ...summary, assignedAt: "2026-11-10T08:00:00",
        startedAt: summary.status === "IN_PROGRESS" ? "2026-11-13T08:00:00" : null, completedAt: null,
        assignedDriver: { id: driverId, fullName: "Driver test" }, assignedEscort: { id: escortId, fullName: "Escort test" },
        horses: [], checkpoints: [], finalWelfareEvidence: null, proofOfDelivery: null,
        availableActions: { start: false, nextCheckpointId: null, arriveAtDestination: false, checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
        lastUpdatedAt: "2026-11-10T08:00:00" };
    }
    await route.fulfill({ status: body ? 200 : 404, headers, contentType: "application/json", body: JSON.stringify(body ?? {}) });
  });
  return () => mutations;
}

test("Driver queue preserves detail selection and exposes no Start from queue-only metadata", async ({ page }, testInfo) => {
  const mutations = await mockQueueApi(page, "DRIVER");
  await page.goto("/driver");
  await expect(page.getByRole("button", { name: "All assigned 2", exact: true })).toHaveAttribute("aria-pressed", "true");
  const queue = page.getByRole("complementary", { name: "Assigned ROAD executions" });
  await expect(queue.getByRole("button")).toHaveCount(2);
  await expect(queue.getByText("Not started · Ready leg", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start my vehicle" })).toHaveCount(0);
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("region", { name: "Next Driver action" })).toBeHidden();
    await queue.getByRole("button", { name: /TRK-READY/ }).click();
    await expect(page.getByRole("button", { name: "Back to assigned work" })).toBeFocused();
  }
  await expect(page.getByRole("region", { name: "Next Driver action" })).toBeVisible();
  await page.getByRole("button", { name: "In progress 1", exact: true }).click();
  await expect(page.getByText(/The selected execution is outside your filters/)).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Back to assigned work" }).click();
    await expect(queue.getByRole("button", { name: /TRK-READY/ })).toBeFocused();
  }
  await page.getByLabel("Sort by departure").selectOption("latest");
  await expect(queue.getByRole("button").first()).toContainText("TRK-RUNNING");
  await page.getByRole("searchbox", { name: "Search assignments" }).fill("no match");
  await expect(page.getByRole("heading", { name: "No matching assignments" })).toBeVisible();
  expect(mutations()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("searchbox", { name: "Search assignments" }).fill("");
  await page.screenshot({ path: testInfo.outputPath("driver-queue.png"), fullPage: true });
});

test("Escort uses one responsive ROAD/AIR list with independent execution groups and filters", async ({ page }, testInfo) => {
  const mutations = await mockQueueApi(page, "ESCORT");
  await page.goto("/escort");
  await expect(page.getByRole("button", { name: "All assigned 3", exact: true })).toBeVisible();
  const table = page.getByRole("table", { name: "Assigned ROAD and AIR executions" });
  await expect(table.getByRole("columnheader")).toHaveCount(6);
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByText("Waiting for previous leg")).toBeVisible();
  await expect(table.getByRole("link", { name: /Record checkpoint welfare/ })).toBeVisible();
  await expect(table.getByRole("link", { name: /Start AIR/ })).toHaveCount(0);
  await page.getByLabel("Transport mode").selectOption("AIR");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Not started 1", exact: true })).toBeVisible();
  await page.getByLabel("Transport mode").selectOption("ALL");
  await page.getByRole("button", { name: "In progress 1", exact: true }).click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByText("TRK-RUNNING", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All assigned 3", exact: true }).click();
  await page.getByLabel("Sort by departure").selectOption("latest");
  await expect(table.getByRole("row").nth(1)).toContainText("ORD-AIR-20");
  expect(mutations()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("escort-queue.png"), fullPage: true });
});
