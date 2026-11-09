import { describe, expect, it } from "vitest";
import { queueDate, selectQueueRows, type QueueRecord } from "./execution-queue";
import { driverQueueRow } from "./driver-execution/queue";
import { createPreviewWork } from "./driver-execution/preview-service";

const rows: QueueRecord[] = [
  { key: "road-2", orderCode: "ORD-1", sequenceNo: 2, origin: "Paris", destination: "Brussels", vehicle: "TRK-2", mode: "ROAD", departure: "2026-11-12T10:00:00Z", group: "processing" },
  { key: "air-1", orderCode: "ORD-1", sequenceNo: 1, origin: "London", destination: "Paris", vehicle: "AIR RouteLeg", mode: "AIR", departure: "2026-11-11T10:00:00Z", group: "upcoming" },
  { key: "road-1", orderCode: "ORD-1", sequenceNo: 2, origin: "Paris", destination: "Brussels", vehicle: "TRK-1", mode: "ROAD", departure: "2026-11-12T10:00:00Z", group: "processing" },
  { key: "unknown", orderCode: "ORD-0", sequenceNo: 1, origin: "Paris", destination: "Berlin", vehicle: "TRK-0", mode: "ROAD", departure: "invalid", group: null },
];

describe("Assigned execution list selectors", () => {
  it("sorts by real departure and uses stable identity without merging multiple vehicles of the same Order", () => {
    expect(selectQueueRows(rows, "all", "", "earliest").map((row) => row.key)).toEqual(["air-1", "road-1", "road-2", "unknown"]);
    expect(selectQueueRows(rows, "all", "", "latest").map((row) => row.key)).toEqual(["road-1", "road-2", "air-1", "unknown"]);
    expect(rows[0].key).toBe("road-2");
  });
  it("combines search and execution groups while retaining invalid rows in All only", () => {
    expect(selectQueueRows(rows, "processing", "BRUSSELS", "earliest")).toHaveLength(2);
    expect(selectQueueRows(rows, "upcoming", "trk", "earliest")).toHaveLength(0);
    expect(selectQueueRows(rows, "all", "TRK-0", "earliest")[0].group).toBeNull();
  });
  it("puts missing dates last and never renders Invalid Date", () => {
    expect(selectQueueRows([...rows, { ...rows[0], key: "missing", departure: null }], "all", "", "latest").slice(-2).map((row) => row.key)).toEqual(["unknown", "missing"]);
    expect(queueDate("invalid")).toBeNull();
    expect(queueDate(null)).toBeNull();
  });
});

describe("Driver execution display groups", () => {
  it("keeps a not-started vehicle upcoming even if its Order is already IN_PROGRESS", () => {
    const execution = createPreviewWork()[0];
    execution.order.status = "IN_PROGRESS";
    execution.permissions.canStart = false;
    expect(driverQueueRow(execution).group).toBe("upcoming");
    expect(driverQueueRow(execution).label).toBe("Not started · Ready leg");
  });
  it("distinguishes a later leg from one ready to start without inferring Start permission", () => {
    const execution = createPreviewWork()[0];
    execution.currentLegId = null;
    execution.legs[0].status = "PLANNED";
    execution.legs[0].sequenceNo = 2;
    expect(driverQueueRow(execution).label).toBe("Waiting for previous leg");
  });
  it.each(["in-progress", "destination", "completed"] as const)("groups %s without changing Order status", (scenario) => {
    const execution = createPreviewWork(scenario)[0];
    expect(driverQueueRow(execution).group).toBe(scenario === "completed" ? "completed" : "processing");
    if (scenario === "destination") expect(driverQueueRow(execution).label).toBe("At destination");
  });
  it("surfaces contradictory leg data in All only", () => {
    const execution = createPreviewWork("in-progress")[0];
    execution.legs[0].status = "READY";
    expect(driverQueueRow(execution)).toMatchObject({ group: null, label: "Check state" });
  });
});
