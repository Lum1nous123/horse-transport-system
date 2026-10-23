import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAirExecutionService } from "./mock-air-service";
import { mockEscortExecutionService } from "./mock-service";
import {
  previewLegacyAirStorageKey,
  previewLegacyRoadStorageKey,
  previewProgressionStorageKey,
  previewUnifiedStorageKey,
} from "./mock-preview-progression";
import { EscortExecutionError, type EscortExecutionErrorCode } from "./types";

function usePreviewEscort(escortId = "escort-mia", scenario?: string) {
  const params = new URLSearchParams({ preview: "1", escortId });
  if (scenario) params.set("scenario", scenario);
  window.history.replaceState({}, "", `/escort?${params.toString()}`);
}

function photo(name = "air-welfare.png", type = "image/png") {
  return new File(["photo-data"], name, { type });
}

async function expectCode(promise: Promise<unknown>, code: EscortExecutionErrorCode) {
  try {
    await promise;
    throw new Error(`Expected service error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(EscortExecutionError);
    expect((error as EscortExecutionError).code).toBe(code);
  }
}

describe("mockAirExecutionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    usePreviewEscort();
  });

  it("returns upcoming and actionable AIR work only for the selected Escort", async () => {
    const queue = await mockAirExecutionService.listAssignedAirWork();

    expect(queue.executions.map((item) => item.executionId)).toEqual(expect.arrayContaining([
      "air-execution-upcoming",
      "air-execution-ready",
      "air-execution-in-progress",
      "air-execution-destination",
      "air-execution-welfare",
      "air-execution-final",
      "air-execution-next",
    ]));
    expect(queue.executions.map((item) => item.executionId)).not.toContain("air-execution-foreign");
    expect(queue.executions.find((item) => item.executionId === "air-execution-upcoming")?.availableActions)
      .toEqual({ start: false, arriveAtDestination: false, recordWelfare: false, complete: false });
    expect(queue.executions.find((item) => item.executionId === "air-execution-ready")?.availableActions.start).toBe(true);
  });

  it("rejects detail and mutations for an execution assigned to another Escort", async () => {
    await expectCode(mockAirExecutionService.getAssignedAirExecution("air-execution-foreign"), "FORBIDDEN");
    await expectCode(mockAirExecutionService.startAirExecution("air-execution-foreign"), "FORBIDDEN");
  });

  it("enforces start, destination and welfare lifecycle gates", async () => {
    await expectCode(mockAirExecutionService.getAssignedAirExecution("missing-air-execution"), "NOT_FOUND");
    await expectCode(mockAirExecutionService.startAirExecution("air-execution-upcoming"), "VALIDATION_ERROR");
    await expectCode(mockAirExecutionService.recordAirDestinationArrival("air-execution-ready"), "VALIDATION_ERROR");
    await expectCode(mockAirExecutionService.completeAirExecution("air-execution-destination"), "VALIDATION_ERROR");
    await expectCode(mockAirExecutionService.recordAirWelfare("air-execution-in-progress", {
      photo: photo(),
      note: "Horses are stable.",
    }), "VALIDATION_ERROR");
    await expectCode(mockAirExecutionService.recordAirWelfare("air-execution-destination", {
      photo: photo("not-an-image.txt", "text/plain"),
      note: "Horses are stable.",
    }), "VALIDATION_ERROR");
    await expectCode(mockAirExecutionService.recordAirWelfare("air-execution-destination", {
      photo: photo(),
      note: "   ",
    }), "VALIDATION_ERROR");
  });

  it("persists the full non-final lifecycle, trims welfare notes and readies the next RouteLeg", async () => {
    await mockAirExecutionService.startAirExecution("air-execution-ready");
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-ready")).toMatchObject({
      status: "IN_PROGRESS",
      routeLegStatus: "IN_PROGRESS",
      availableActions: { arriveAtDestination: true },
    });

    await mockAirExecutionService.recordAirDestinationArrival("air-execution-ready");
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-ready")).toMatchObject({
      status: "DESTINATION",
      availableActions: { recordWelfare: true },
    });

    await mockAirExecutionService.recordAirWelfare("air-execution-ready", {
      photo: photo("arrival.png"),
      note: "  Horses arrived calm and hydrated.  ",
    });
    const saved = await mockAirExecutionService.getAssignedAirExecution("air-execution-ready");
    expect(saved.welfareEvidence).toMatchObject({
      eventType: "FINAL_DESTINATION",
      checkpointId: null,
      photoName: "arrival.png",
      note: "Horses arrived calm and hydrated.",
    });
    expect(saved.welfareEvidence?.photoUrl).toMatch(/^data:image\/png;base64,/);
    expect(saved.availableActions.complete).toBe(true);
    await expectCode(mockAirExecutionService.recordAirWelfare("air-execution-ready", {
      photo: photo("duplicate.png"),
      note: "Duplicate evidence.",
    }), "VALIDATION_ERROR");

    await mockAirExecutionService.completeAirExecution("air-execution-ready");
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-ready")).toMatchObject({
      status: "COMPLETED",
      routeLegStatus: "COMPLETED",
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    });

    await mockAirExecutionService.completeAirExecution("air-execution-welfare");
    const queue = await mockAirExecutionService.listAssignedAirWork();
    expect(queue.executions.find((item) => item.executionId === "air-execution-next")).toMatchObject({
      routeLegStatus: "READY",
      availableActions: { start: true },
    });
  });

  it("opens exactly the next ROAD leg after valid AIR completion", async () => {
    expect((await mockEscortExecutionService.listAssignedRoadWork()).executions.map((item) => item.executionId))
      .not.toContain("road-execution-after-air");
    expect(await mockEscortExecutionService.getAssignedRoadExecution("road-execution-after-air")).toMatchObject({
      routeLegStatus: "PLANNED",
    });
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-after-road")).toMatchObject({
      routeLegStatus: "PLANNED",
      availableActions: { start: false },
    });

    await mockAirExecutionService.completeAirExecution("air-execution-to-road");

    expect(await mockEscortExecutionService.getAssignedRoadExecution("road-execution-after-air")).toMatchObject({
      routeLegStatus: "READY",
    });
    expect((await mockEscortExecutionService.listAssignedRoadWork()).executions.map((item) => item.executionId))
      .toContain("road-execution-after-air");
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-after-road")).toMatchObject({
      routeLegStatus: "PLANNED",
      availableActions: { start: false },
    });
  });

  it("opens the next AIR leg only after the last ROAD Vehicle completes valid final welfare", async () => {
    const before = await mockAirExecutionService.getAssignedAirExecution("air-execution-road-next");
    expect(before).toMatchObject({ routeLegStatus: "PLANNED", availableActions: { start: false } });
    await expectCode(mockAirExecutionService.startAirExecution("air-execution-road-next"), "VALIDATION_ERROR");

    await mockEscortExecutionService.recordRoadWelfare("road-execution-to-air", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-final.png"),
      note: "  Final ROAD welfare is complete.  ",
    });

    expect(await mockEscortExecutionService.getAssignedRoadExecution("road-execution-to-air")).toMatchObject({
      status: "COMPLETED",
      routeLegStatus: "IN_PROGRESS",
    });
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-road-next")).toMatchObject({
      routeLegStatus: "PLANNED",
      availableActions: { start: false },
    });

    usePreviewEscort("escort-liam");
    await mockEscortExecutionService.recordRoadWelfare("road-execution-to-air-b", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-final-second-vehicle.png"),
      note: "The second Vehicle final welfare is complete.",
    });
    expect(await mockEscortExecutionService.getAssignedRoadExecution("road-execution-to-air-b")).toMatchObject({
      status: "COMPLETED",
      routeLegStatus: "COMPLETED",
    });

    usePreviewEscort();
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-road-next")).toMatchObject({
      routeLegStatus: "READY",
      availableActions: { start: true },
    });
  });

  it("keeps final AIR completion unavailable after welfare for PoD handover", async () => {
    const detail = await mockAirExecutionService.getAssignedAirExecution("air-execution-final");
    expect(detail.isFinalLeg).toBe(true);
    expect(detail.welfareRecorded).toBe(true);
    expect(detail.availableActions.complete).toBe(false);
    await expectCode(mockAirExecutionService.completeAirExecution("air-execution-final"), "VALIDATION_ERROR");
  });

  it("supports empty, failure and stale preview scenarios with persisted read-back", async () => {
    usePreviewEscort("escort-mia", "air-empty");
    await expect(mockAirExecutionService.listAssignedAirWork()).resolves.toEqual({ executions: [] });

    usePreviewEscort("escort-mia", "air-failure");
    await expectCode(mockAirExecutionService.listAssignedAirWork(), "REQUEST_FAILED");

    usePreviewEscort("escort-mia", "air-stale");
    await expectCode(mockAirExecutionService.startAirExecution("air-execution-ready"), "STALE_STATE");
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-ready")).toMatchObject({
      status: "IN_PROGRESS",
      routeLegStatus: "IN_PROGRESS",
    });
  });

  it("normalizes browser storage read and quota failures as request failures", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    await expectCode(mockAirExecutionService.listAssignedAirWork(), "REQUEST_FAILED");
    getItem.mockRestore();

    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await expectCode(mockAirExecutionService.startAirExecution("air-execution-ready"), "REQUEST_FAILED");
  });

  it("persists each logical mutation with one authoritative storage write", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await mockAirExecutionService.startAirExecution("air-execution-ready");

    expect(setItem).toHaveBeenCalledOnce();
    expect(setItem).toHaveBeenCalledWith(previewUnifiedStorageKey, expect.any(String));
  });

  it("does not publish advanced AIR state when unified persistence fails and retries safely", async () => {
    const before = await mockAirExecutionService.getAssignedAirExecution("air-execution-ready");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await expectCode(mockAirExecutionService.startAirExecution("air-execution-ready"), "REQUEST_FAILED");
    setItem.mockRestore();

    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-ready")).toMatchObject({
      status: before.status,
      routeLegStatus: before.routeLegStatus,
      availableActions: { start: true },
    });
    expect(window.sessionStorage.getItem(previewUnifiedStorageKey)).toBeNull();

    await mockAirExecutionService.startAirExecution("air-execution-ready");
    await expectCode(mockAirExecutionService.startAirExecution("air-execution-ready"), "VALIDATION_ERROR");
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-ready")).toMatchObject({
      status: "IN_PROGRESS",
      routeLegStatus: "IN_PROGRESS",
      availableActions: { arriveAtDestination: true },
    });
  });

  it("does not unlock AIR when the last ROAD Vehicle mutation fails, then retries without duplicate progression", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-to-air", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-first.png"),
      note: "First Vehicle complete.",
    });
    usePreviewEscort("escort-liam");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await expectCode(mockEscortExecutionService.recordRoadWelfare("road-execution-to-air-b", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-second.png"),
      note: "Second Vehicle complete.",
    }), "REQUEST_FAILED");
    setItem.mockRestore();

    usePreviewEscort();
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-road-next")).toMatchObject({
      routeLegStatus: "PLANNED",
      availableActions: { start: false },
    });
    usePreviewEscort("escort-liam");
    expect(await mockEscortExecutionService.getAssignedRoadExecution("road-execution-to-air-b")).toMatchObject({
      status: "DESTINATION",
      routeLegStatus: "IN_PROGRESS",
    });

    await mockEscortExecutionService.recordRoadWelfare("road-execution-to-air-b", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-second-retry.png"),
      note: "Second Vehicle retry complete.",
    });
    usePreviewEscort();
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-road-next")).toMatchObject({
      routeLegStatus: "READY",
      availableActions: { start: true },
    });
  });

  it("keeps AIR to ROAD progression consistent after a fresh module load", async () => {
    await mockAirExecutionService.completeAirExecution("air-execution-to-road");
    vi.resetModules();
    const { mockEscortExecutionService: reloadedRoadService } = await import("./mock-service");

    expect(await reloadedRoadService.getAssignedRoadExecution("road-execution-after-air")).toMatchObject({
      routeLegStatus: "READY",
    });
  });

  it("keeps multi-Vehicle ROAD to AIR progression consistent after a fresh module load", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-to-air", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-first.png"),
      note: "First Vehicle complete.",
    });
    usePreviewEscort("escort-liam");
    await mockEscortExecutionService.recordRoadWelfare("road-execution-to-air-b", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-second.png"),
      note: "Second Vehicle complete.",
    });
    usePreviewEscort();
    vi.resetModules();
    const { mockAirExecutionService: reloadedAirService } = await import("./mock-air-service");

    expect(await reloadedAirService.getAssignedAirExecution("air-execution-road-next")).toMatchObject({
      routeLegStatus: "READY",
      availableActions: { start: true },
    });
  });

  it("migrates consistent legacy preview state and rejects a legacy premature unlock", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-to-air", {
      eventType: "FINAL_DESTINATION",
      photo: photo("road-first.png"),
      note: "First Vehicle complete.",
    });
    const snapshot = JSON.parse(window.sessionStorage.getItem(previewUnifiedStorageKey)!) as {
      progression: { routeLegs: Array<{ id: string; status: string }> };
      road: unknown;
      air?: unknown;
    };

    window.sessionStorage.clear();
    window.sessionStorage.setItem("unrelated-preview-state", "keep-me");
    window.sessionStorage.setItem(previewProgressionStorageKey, JSON.stringify(snapshot.progression));
    window.sessionStorage.setItem(previewLegacyRoadStorageKey, JSON.stringify(snapshot.road));
    if (snapshot.air) window.sessionStorage.setItem(previewLegacyAirStorageKey, JSON.stringify(snapshot.air));
    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-road-next")).toMatchObject({
      routeLegStatus: "PLANNED",
      availableActions: { start: false },
    });
    expect(window.sessionStorage.getItem("unrelated-preview-state")).toBe("keep-me");

    const roadLeg = snapshot.progression.routeLegs.find((leg) => leg.id === "road-leg-3008-1")!;
    const airLeg = snapshot.progression.routeLegs.find((leg) => leg.id === "air-leg-3008-2")!;
    roadLeg.status = "COMPLETED";
    airLeg.status = "READY";
    window.sessionStorage.setItem(previewProgressionStorageKey, JSON.stringify(snapshot.progression));

    await expectCode(mockAirExecutionService.getAssignedAirExecution("air-execution-road-next"), "REQUEST_FAILED");
  });
});
