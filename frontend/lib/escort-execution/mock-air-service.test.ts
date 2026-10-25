import { beforeEach, describe, expect, it, vi } from "vitest";
import { installPreviewImageMocks, validPngFile } from "@/test/image-fixtures";
import { preFe16RoadSnapshot } from "@/test/pre-fe16-road-snapshot";
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
  return type === "image/png"
    ? validPngFile(name)
    : new File(["photo-data"], name, { type });
}

type StoredSlice = {
  routeLegs: Array<Record<string, unknown>>;
  executions: Array<Record<string, unknown>>;
};

type StoredSnapshot = {
  progression: {
    routeLegs: Array<Record<string, unknown>>;
    orders: Array<Record<string, unknown>>;
  };
  road?: StoredSlice;
  air?: StoredSlice;
};

function storedSnapshot() {
  return JSON.parse(window.sessionStorage.getItem(previewUnifiedStorageKey)!) as StoredSnapshot;
}

function replaceSnapshot(snapshot: StoredSnapshot) {
  window.sessionStorage.setItem(previewUnifiedStorageKey, JSON.stringify(snapshot));
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
    vi.unstubAllGlobals();
    installPreviewImageMocks();
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
    expect(saved.welfareEvidence?.photoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(saved.welfareEvidence?.photoIsPreview).toBe(true);
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
    if (snapshot.road && typeof snapshot.road === "object" && "executions" in snapshot.road) {
      for (const execution of (snapshot.road as StoredSlice).executions) {
        delete execution.roadLegVehicleId;
        delete execution.proofOfDelivery;
      }
    }
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

  it("migrates the genuine six-execution pre-FE16 ROAD snapshot without fabricating delivery", async () => {
    window.sessionStorage.setItem(previewUnifiedStorageKey, JSON.stringify(preFe16RoadSnapshot()));

    const addedVehicle = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final-b");
    expect(addedVehicle).toMatchObject({
      roadLegVehicleId: "road-vehicle-2108-final-b",
      status: "DESTINATION",
      routeLegStatus: "IN_PROGRESS",
      finalWelfareEvidence: null,
      proofOfDelivery: null,
      proofOfDeliveryAvailable: false,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 2, orderStatus: "IN_PROGRESS" },
    });

    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final-b", {
      eventType: "FINAL_DESTINATION",
      photo: photo("migrated-vehicle-welfare.png"),
      note: "Migrated Vehicle still requires an explicit handover.",
    });
    const persisted = storedSnapshot();
    expect(persisted.road!.executions).toHaveLength(7);
    expect(persisted.road!.executions
      .find((execution) => execution.id === "road-execution-2108-final-b")).toMatchObject({
      status: "COMPLETED",
      proofOfDelivery: null,
    });
    expect(persisted.progression.routeLegs.find((routeLeg) => routeLeg.id === "leg-2108-3")?.status)
      .toBe("IN_PROGRESS");
    expect(persisted.progression.orders.find((order) => order.id === "order-2108")?.status)
      .toBe("IN_PROGRESS");
  });

  it("rejects a current non-delivered snapshot missing the newly required ROAD execution", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2074-a", {
      eventType: "CHECKPOINT",
      checkpointId: "checkpoint-lex-1",
      photo: photo("current-snapshot-welfare.png"),
      note: "Create a current-version snapshot.",
    });
    const current = storedSnapshot();
    current.road!.executions = current.road!.executions
      .filter((execution) => execution.id !== "road-execution-2108-final-b");
    replaceSnapshot(current);

    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");
  });

  it("records one final AIR PoD, delivers atomically and persists read-back", async () => {
    const before = await mockAirExecutionService.getAssignedAirExecution("air-execution-final");
    expect(before).toMatchObject({
      isFinalLeg: true,
      status: "DESTINATION",
      proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 1, orderStatus: "IN_PROGRESS" },
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const saved = await mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: "  Aiko Tanaka  ",
      photo: photo("air-proof.png"),
    });

    expect(setItem).toHaveBeenCalledOnce();
    expect(saved).toMatchObject({
      mode: "AIR",
      recipientName: "Aiko Tanaka",
      handoverNote: null,
      completedHandovers: 1,
      requiredHandovers: 1,
      routeLegStatus: "COMPLETED",
      orderStatus: "DELIVERED",
    });
    expect(saved.proofPhotoUrl).not.toBe(before.welfareEvidence?.photoUrl);
    const detail = await mockAirExecutionService.getAssignedAirExecution("air-execution-final");
    expect(detail).toMatchObject({
      status: "COMPLETED",
      routeLegStatus: "COMPLETED",
      proofOfDeliveryRecorded: true,
      proofOfDeliveryAvailable: false,
      handoverProgress: { orderStatus: "DELIVERED" },
    });

    vi.resetModules();
    const { mockAirExecutionService: reloadedService } = await import("./mock-air-service");
    expect((await reloadedService.getAssignedAirExecution("air-execution-final")).proofOfDelivery?.id)
      .toBe(saved.id);
  });

  it("keeps AIR PoD idempotent and rejects gates, foreign assignment and invalid evidence", async () => {
    await expectCode(mockAirExecutionService.recordAirProofOfDelivery("air-leg-3004-2", {
      recipientName: "Recipient", photo: photo("too-early.png"),
    }), "VALIDATION_ERROR");
    await expectCode(mockAirExecutionService.recordAirProofOfDelivery("air-leg-foreign", {
      recipientName: "Recipient", photo: photo("foreign.png"),
    }), "FORBIDDEN");
    await expectCode(mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: " ", photo: photo(),
    }), "VALIDATION_ERROR");
    await expectCode(mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: "Recipient", photo: new File(["x"], "proof.gif", { type: "image/gif" }),
    }), "VALIDATION_ERROR");

    const saved = await mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: "Recipient", photo: photo("proof.png"), note: "Safe handover",
    });
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const duplicate = await mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: "", photo: new File([], "", { type: "" }),
    });
    expect(duplicate.id).toBe(saved.id);
    expect(writes).not.toHaveBeenCalled();
  });

  it("does not publish final AIR delivery when unified storage fails", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await expectCode(mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: "Recipient", photo: photo("proof.png"),
    }), "REQUEST_FAILED");
    setItem.mockRestore();

    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-final")).toMatchObject({
      status: "DESTINATION",
      routeLegStatus: "IN_PROGRESS",
      proofOfDelivery: null,
      handoverProgress: { orderStatus: "IN_PROGRESS" },
    });
  });

  it("persists a stale AIR PoD once and exposes terminal state through recovery read-back", async () => {
    usePreviewEscort("escort-mia", "pod-stale");
    await expectCode(mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: "Aiko Tanaka", photo: photo("air-proof.png"),
    }), "STALE_STATE");

    expect(await mockAirExecutionService.getAssignedAirExecution("air-execution-final")).toMatchObject({
      status: "COMPLETED",
      routeLegStatus: "COMPLETED",
      proofOfDeliveryRecorded: true,
      handoverProgress: { orderStatus: "DELIVERED" },
    });
  });

  it("deduplicates concurrent final AIR PoD attempts and persists one terminal handover", async () => {
    const [first, second] = await Promise.all([
      mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
        recipientName: "First recipient",
        photo: photo("air-concurrent-first.png"),
      }),
      mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
        recipientName: "Second recipient",
        photo: photo("air-concurrent-second.png"),
      }),
    ]);

    expect(second.id).toBe(first.id);
    const persisted = await mockAirExecutionService.getAssignedAirExecution("air-execution-final");
    expect(persisted).toMatchObject({
      status: "COMPLETED",
      routeLegStatus: "COMPLETED",
      handoverProgress: { completedHandovers: 1, requiredHandovers: 1, orderStatus: "DELIVERED" },
    });
    expect(persisted.proofOfDelivery?.id).toBe(first.id);
  });

  it("preserves mixed ROAD/AIR handovers and accumulated previews under concurrent preparation", async () => {
    vi.mocked(HTMLCanvasElement.prototype.toDataURL)
      .mockReturnValue(`data:image/jpeg;base64,${"a".repeat(90_000)}`);
    for (const executionId of ["road-execution-2108-final", "road-execution-2108-final-b"]) {
      await mockEscortExecutionService.recordRoadWelfare(executionId, {
        eventType: "FINAL_DESTINATION",
        photo: photo(`${executionId}-welfare.png`),
        note: `Final welfare for ${executionId}.`,
      });
    }

    const [roadFirst, airDelivered] = await Promise.all([
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
        recipientName: "Road recipient",
        photo: photo("mixed-road-proof.png"),
      }),
      mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
        recipientName: "Air recipient",
        photo: photo("mixed-air-proof.png"),
      }),
    ]);

    expect(roadFirst.orderStatus).toBe("IN_PROGRESS");
    expect(airDelivered.orderStatus).toBe("DELIVERED");
    await mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final-b", {
      recipientName: "Second road recipient",
      photo: photo("mixed-road-proof-b.png"),
    });

    expect((await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final"))
      .handoverProgress.orderStatus).toBe("DELIVERED");
    expect((await mockAirExecutionService.getAssignedAirExecution("air-execution-final"))
      .handoverProgress.orderStatus).toBe("DELIVERED");
    const snapshot = storedSnapshot();
    expect(JSON.stringify(snapshot).length).toBeLessThan(750_000);
    expect(JSON.stringify(snapshot)).not.toContain("photo-data");

    const roadProof = snapshot.road!.executions
      .find((execution) => execution.id === "road-execution-2108-final")!.proofOfDelivery as Record<string, unknown>;
    const airProof = snapshot.air!.executions
      .find((execution) => execution.id === "air-execution-final")!.proofOfDelivery as Record<string, unknown>;
    airProof.id = roadProof.id;
    replaceSnapshot(snapshot);
    await expectCode(mockAirExecutionService.listAssignedAirWork(), "REQUEST_FAILED");
  });

  it("rejects malformed, duplicate and invalid execution relationships with typed errors", async () => {
    await mockAirExecutionService.startAirExecution("air-execution-ready");
    const clean = storedSnapshot();
    const corruptions: Array<(snapshot: StoredSnapshot) => void> = [
      (snapshot) => { snapshot.air!.executions.push(null as unknown as Record<string, unknown>); },
      (snapshot) => { snapshot.air!.executions.push({ ...snapshot.air!.executions[0] }); },
      (snapshot) => { snapshot.air!.executions[0].routeLegId = "missing-route-leg"; },
      (snapshot) => { snapshot.progression.routeLegs.push({ ...snapshot.progression.routeLegs[0] }); },
      (snapshot) => { snapshot.progression.orders.push({ ...snapshot.progression.orders[0] }); },
      (snapshot) => {
        snapshot.air!.executions.push({ ...snapshot.air!.executions[0], id: "duplicate-air-scope" });
      },
    ];

    for (const corrupt of corruptions) {
      const snapshot = JSON.parse(JSON.stringify(clean)) as StoredSnapshot;
      corrupt(snapshot);
      replaceSnapshot(snapshot);
      await expectCode(mockAirExecutionService.listAssignedAirWork(), "REQUEST_FAILED");
    }
  });

  it("rejects duplicate ROAD Vehicle ownership and inconsistent persisted PoD progress", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("strict-road-welfare.png"),
      note: "Ready for handover.",
    });
    await mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: "Recipient",
      photo: photo("strict-road-proof.png"),
    });
    const clean = storedSnapshot();

    const duplicateVehicle = JSON.parse(JSON.stringify(clean)) as StoredSnapshot;
    duplicateVehicle.road!.executions[1].roadLegVehicleId = duplicateVehicle.road!.executions[0].roadLegVehicleId;
    replaceSnapshot(duplicateVehicle);
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");

    const duplicateHorse = JSON.parse(JSON.stringify(clean)) as StoredSnapshot;
    const firstVehicle = duplicateHorse.road!.executions
      .find((execution) => execution.id === "road-execution-2108-final")!;
    const secondVehicle = duplicateHorse.road!.executions
      .find((execution) => execution.id === "road-execution-2108-final-b")!;
    (secondVehicle.horses as Array<Record<string, unknown>>)[0].id =
      (firstVehicle.horses as Array<Record<string, unknown>>)[0].id;
    replaceSnapshot(duplicateHorse);
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");

    const inconsistentProof = JSON.parse(JSON.stringify(clean)) as StoredSnapshot;
    const executionWithProof = inconsistentProof.road!.executions
      .find((execution) => execution.id === "road-execution-2108-final")!;
    (executionWithProof.proofOfDelivery as Record<string, unknown>).completedHandovers = 2;
    replaceSnapshot(inconsistentProof);
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");
  });

  it("rejects missing mandatory ROAD executions or proofs in a delivered snapshot", async () => {
    for (const executionId of ["road-execution-2108-final", "road-execution-2108-final-b"]) {
      await mockEscortExecutionService.recordRoadWelfare(executionId, {
        eventType: "FINAL_DESTINATION",
        photo: photo(`${executionId}-roster-welfare.png`),
        note: `Final welfare for ${executionId}.`,
      });
    }
    await mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: "Recipient A",
      photo: photo("roster-proof-a.png"),
    });
    expect((await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final"))
      .handoverProgress).toMatchObject({ completedHandovers: 1, requiredHandovers: 2, orderStatus: "IN_PROGRESS" });
    await mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final-b", {
      recipientName: "Recipient B",
      photo: photo("roster-proof-b.png"),
    });
    expect((await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final"))
      .handoverProgress).toMatchObject({ completedHandovers: 2, requiredHandovers: 2, orderStatus: "DELIVERED" });
    const delivered = storedSnapshot();

    const withoutFinalExecutions = JSON.parse(JSON.stringify(delivered)) as StoredSnapshot;
    withoutFinalExecutions.road!.executions = withoutFinalExecutions.road!.executions
      .filter((execution) => execution.routeLegId !== "leg-2108-3");
    replaceSnapshot(withoutFinalExecutions);
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");

    const withoutOneVehicle = JSON.parse(JSON.stringify(delivered)) as StoredSnapshot;
    withoutOneVehicle.road!.executions = withoutOneVehicle.road!.executions
      .filter((execution) => execution.id !== "road-execution-2108-final-b");
    replaceSnapshot(withoutOneVehicle);
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");

    const withSubstitutedVehicle = JSON.parse(JSON.stringify(delivered)) as StoredSnapshot;
    withSubstitutedVehicle.road!.executions
      .find((execution) => execution.id === "road-execution-2108-final-b")!.roadLegVehicleId = "replacement-vehicle";
    replaceSnapshot(withSubstitutedVehicle);
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");

    const withoutProof = JSON.parse(JSON.stringify(delivered)) as StoredSnapshot;
    withoutProof.road!.executions
      .find((execution) => execution.id === "road-execution-2108-final-b")!.proofOfDelivery = null;
    replaceSnapshot(withoutProof);
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");
  });

  it("rejects a missing final AIR execution or proof after delivery", async () => {
    await mockAirExecutionService.recordAirProofOfDelivery("air-leg-3006-final", {
      recipientName: "Aiko Tanaka",
      photo: photo("air-roster-proof.png"),
    });
    expect((await mockAirExecutionService.getAssignedAirExecution("air-execution-final"))
      .handoverProgress.orderStatus).toBe("DELIVERED");
    const delivered = storedSnapshot();

    const withoutExecution = JSON.parse(JSON.stringify(delivered)) as StoredSnapshot;
    withoutExecution.air!.executions = withoutExecution.air!.executions
      .filter((execution) => execution.id !== "air-execution-final");
    replaceSnapshot(withoutExecution);
    await expectCode(mockAirExecutionService.listAssignedAirWork(), "REQUEST_FAILED");

    const withoutProof = JSON.parse(JSON.stringify(delivered)) as StoredSnapshot;
    withoutProof.air!.executions
      .find((execution) => execution.id === "air-execution-final")!.proofOfDelivery = null;
    replaceSnapshot(withoutProof);
    await expectCode(mockAirExecutionService.listAssignedAirWork(), "REQUEST_FAILED");
  });
});
