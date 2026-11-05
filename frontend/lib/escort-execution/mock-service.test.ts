import { beforeEach, describe, expect, it, vi } from "vitest";
import { installPreviewImageMocks, nearTenMegabytePng, validPngFile } from "@/test/image-fixtures";
import { previewUnifiedStorageKey } from "./mock-preview-progression";
import { mockEscortExecutionService } from "./mock-service";
import { EscortExecutionError, type EscortExecutionErrorCode } from "./types";

function usePreviewEscort(escortId = "escort-mia", scenario?: string) {
  const params = new URLSearchParams({ preview: "1", escortId });
  if (scenario) params.set("scenario", scenario);
  window.history.replaceState({}, "", `/escort?${params.toString()}`);
}

function photo(name = "welfare.png") {
  return validPngFile(name);
}

function proofInput(name = "handover.png") {
  return { recipientName: "  Camille Martin  ", photo: photo(name), note: "  Received safely.  " };
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

describe("mockEscortExecutionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    installPreviewImageMocks();
    window.sessionStorage.clear();
    usePreviewEscort();
  });

  it("returns only ROAD work assigned to the signed-in Escort", async () => {
    const queue = await mockEscortExecutionService.listAssignedRoadWork();

    expect(queue.executions.map((item) => item.executionId)).toEqual(expect.arrayContaining([
      "road-execution-2074-a",
      "road-execution-2108-final",
      "road-execution-to-air",
    ]));
    expect(queue.executions.map((item) => item.executionId)).not.toContain("road-execution-2074-b");
  });

  it("rejects access to a Vehicle assigned to another Escort", async () => {
    await expectCode(
      mockEscortExecutionService.getAssignedRoadExecution("road-execution-2074-b"),
      "FORBIDDEN",
    );
  });

  it("allows checkpoint welfare only after that Vehicle reaches the checkpoint", async () => {
    await expectCode(
      mockEscortExecutionService.recordRoadWelfare("road-execution-2074-a", {
        eventType: "CHECKPOINT",
        checkpointId: "checkpoint-lex-2",
        photo: photo(),
        note: "Horse is calm and hydrated.",
      }),
      "VALIDATION_ERROR",
    );
  });

  it("persists checkpoint evidence and reads it back before preventing duplicates", async () => {
    const input = {
      eventType: "CHECKPOINT" as const,
      checkpointId: "checkpoint-lex-1",
      photo: photo("apollo-rest-stop.png"),
      note: "  Horses are calm after water and rest.  ",
    };

    await mockEscortExecutionService.recordRoadWelfare("road-execution-2074-a", input);
    const detail = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2074-a");
    const checkpoint = detail.checkpoints.find((item) => item.id === "checkpoint-lex-1");

    expect(checkpoint?.welfareEvidence).toMatchObject({
      eventType: "CHECKPOINT",
      checkpointId: "checkpoint-lex-1",
      photoName: "apollo-rest-stop.png",
      note: "Horses are calm after water and rest.",
    });
    expect(checkpoint?.welfareEvidence?.photoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(checkpoint?.welfareEvidence?.photoIsPreview).toBe(true);
    expect(detail.availableActions.checkpointWelfareIds).not.toContain("checkpoint-lex-1");

    await expectCode(
      mockEscortExecutionService.recordRoadWelfare("road-execution-2074-a", input),
      "STALE_STATE",
    );
  });

  it("unlocks final welfare only after destination and does not complete the RouteLeg", async () => {
    await expectCode(
      mockEscortExecutionService.recordRoadWelfare("road-execution-2074-a", {
        eventType: "FINAL_DESTINATION",
        photo: photo(),
        note: "Final welfare check.",
      }),
      "VALIDATION_ERROR",
    );

    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("final-welfare.png"),
      note: "Horse arrived alert and in good condition.",
    });
    const detail = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final");

    expect(detail.status).toBe("COMPLETED");
    expect(detail.routeLegStatus).toBe("IN_PROGRESS");
    expect(detail.finalWelfareEvidence).toMatchObject({
      eventType: "FINAL_DESTINATION",
      checkpointId: null,
      photoName: "final-welfare.png",
    });
  });

  it("supports empty, failure and stale-state preview scenarios", async () => {
    usePreviewEscort("escort-mia", "empty");
    await expect(mockEscortExecutionService.listAssignedRoadWork()).resolves.toEqual({ executions: [] });

    usePreviewEscort("escort-mia", "failure");
    await expectCode(mockEscortExecutionService.listAssignedRoadWork(), "REQUEST_FAILED");

    usePreviewEscort("escort-mia", "stale");
    await expectCode(
      mockEscortExecutionService.recordRoadWelfare("road-execution-2074-a", {
        eventType: "CHECKPOINT",
        checkpointId: "checkpoint-lex-1",
        photo: photo(),
        note: "Saved by another session.",
      }),
      "STALE_STATE",
    );
    const detail = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2074-a");
    expect(detail.checkpoints[0].welfareEvidence?.note).toBe("Saved by another session.");
  });

  it("normalizes browser storage failures without claiming server persistence", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await expectCode(
      mockEscortExecutionService.recordRoadWelfare("road-execution-2074-a", {
        eventType: "CHECKPOINT",
        checkpointId: "checkpoint-lex-1",
        photo: photo(),
        note: "Horse is stable.",
      }),
      "REQUEST_FAILED",
    );
  });

  it("keeps completed final Vehicles visible and delivers only after every Vehicle PoD", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("welfare-a.png"),
      note: "Vehicle A final welfare.",
    });
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final-b", {
      eventType: "FINAL_DESTINATION",
      photo: photo("welfare-b.png"),
      note: "Vehicle B final welfare.",
    });

    const readyQueue = await mockEscortExecutionService.listAssignedRoadWork();
    expect(readyQueue.executions).toEqual(expect.arrayContaining([
      expect.objectContaining({ executionId: "road-execution-2108-final", status: "COMPLETED", proofOfDeliveryAvailable: true }),
      expect.objectContaining({ executionId: "road-execution-2108-final-b", status: "COMPLETED", proofOfDeliveryAvailable: true }),
    ]));
    expect((await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final-b")).horses)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "horse-luna" }),
        expect.objectContaining({ id: "horse-orion" }),
      ]));

    const first = await mockEscortExecutionService.recordRoadProofOfDelivery(
      "road-vehicle-2108-final",
      proofInput("proof-a.png"),
    );
    expect(first).toMatchObject({
      recipientName: "Camille Martin",
      handoverNote: "Received safely.",
      transportedOrderHorseIds: ["horse-comet"],
      completedHandovers: 1,
      requiredHandovers: 2,
      routeLegStatus: "IN_PROGRESS",
      orderStatus: "IN_PROGRESS",
    });
    expect(first.proofPhotoUrl).not.toBe(
      (await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final")).finalWelfareEvidence?.photoUrl,
    );

    const second = await mockEscortExecutionService.recordRoadProofOfDelivery(
      "road-vehicle-2108-final-b",
      { recipientName: "Recipient B", photo: photo("proof-b.jpg"), note: "   " },
    );
    expect(second).toMatchObject({
      handoverNote: null,
      transportedOrderHorseIds: ["horse-luna", "horse-orion"],
      completedHandovers: 2,
      requiredHandovers: 2,
      routeLegStatus: "COMPLETED",
      orderStatus: "DELIVERED",
    });
    const firstReadBack = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final");
    expect(firstReadBack.handoverProgress).toMatchObject({ completedHandovers: 2, orderStatus: "DELIVERED" });
    expect(firstReadBack.proofOfDelivery?.recipientName).toBe("Camille Martin");
    expect((await mockEscortExecutionService.listAssignedRoadWork()).executions.map((item) => item.orderId))
      .not.toContain("order-2108");
  });

  it("is idempotent, assigned-only and fails storage writes without publishing delivery", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("welfare-a.png"),
      note: "Vehicle A final welfare.",
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await expectCode(
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", proofInput()),
      "REQUEST_FAILED",
    );
    setItem.mockRestore();
    expect((await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final")).proofOfDelivery)
      .toBeNull();

    const saved = await mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", proofInput());
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const duplicate = await mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: "",
      photo: new File([], "", { type: "" }),
    });
    expect(duplicate.id).toBe(saved.id);
    expect(writes).not.toHaveBeenCalled();

    await expectCode(
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2074-b", proofInput()),
      "FORBIDDEN",
    );
  });

  it("validates recipient, MIME and size before a ROAD PoD write", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("welfare-a.png"),
      note: "Vehicle A final welfare.",
    });
    await expectCode(mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: " ", photo: photo(),
    }), "VALIDATION_ERROR");
    await expectCode(mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: "x".repeat(151), photo: photo(),
    }), "VALIDATION_ERROR");
    await expectCode(mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: "Recipient", photo: new File(["x"], "proof.gif", { type: "image/gif" }),
    }), "VALIDATION_ERROR");
    await expectCode(mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: "Recipient",
      photo: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "proof.png", { type: "image/png" }),
    }), "VALIDATION_ERROR");
  });

  it("persists a stale ROAD PoD once and exposes it through recovery read-back", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("welfare-a.png"),
      note: "Vehicle A final welfare.",
    });
    usePreviewEscort("escort-mia", "pod-stale");

    await expectCode(
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", proofInput()),
      "STALE_STATE",
    );
    const recovered = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final");
    expect(recovered.proofOfDelivery).toMatchObject({ recipientName: "Camille Martin" });
    expect(recovered.handoverProgress).toMatchObject({ completedHandovers: 1, requiredHandovers: 2, orderStatus: "IN_PROGRESS" });
  });

  it("supports final ROAD handovers in the opposite Vehicle order without premature delivery", async () => {
    for (const executionId of ["road-execution-2108-final", "road-execution-2108-final-b"]) {
      await mockEscortExecutionService.recordRoadWelfare(executionId, {
        eventType: "FINAL_DESTINATION",
        photo: photo(`${executionId}-welfare.png`),
        note: `Final welfare for ${executionId}.`,
      });
    }

    const secondVehicleFirst = await mockEscortExecutionService.recordRoadProofOfDelivery(
      "road-vehicle-2108-final-b",
      proofInput("proof-b-first.png"),
    );
    expect(secondVehicleFirst).toMatchObject({
      transportedOrderHorseIds: ["horse-luna", "horse-orion"],
      completedHandovers: 1,
      requiredHandovers: 2,
      routeLegStatus: "IN_PROGRESS",
      orderStatus: "IN_PROGRESS",
    });

    const delivered = await mockEscortExecutionService.recordRoadProofOfDelivery(
      "road-vehicle-2108-final",
      proofInput("proof-a-last.png"),
    );
    expect(delivered).toMatchObject({
      transportedOrderHorseIds: ["horse-comet"],
      completedHandovers: 2,
      requiredHandovers: 2,
      routeLegStatus: "COMPLETED",
      orderStatus: "DELIVERED",
    });
  });

  it("deduplicates concurrent PoD attempts for one ROAD Vehicle", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("concurrent-welfare.png"),
      note: "Ready for concurrent handover attempts.",
    });

    const [first, second] = await Promise.all([
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", proofInput("first.png")),
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", proofInput("second.png")),
    ]);

    expect(second.id).toBe(first.id);
    const persisted = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final");
    expect(persisted.proofOfDelivery?.id).toBe(first.id);
    expect(persisted.handoverProgress).toMatchObject({ completedHandovers: 1, requiredHandovers: 2, orderStatus: "IN_PROGRESS" });
  });

  it("atomically preserves two different ROAD Vehicle handovers submitted concurrently", async () => {
    for (const executionId of ["road-execution-2108-final", "road-execution-2108-final-b"]) {
      await mockEscortExecutionService.recordRoadWelfare(executionId, {
        eventType: "FINAL_DESTINATION",
        photo: photo(`${executionId}-concurrent-welfare.png`),
        note: `Concurrent readiness for ${executionId}.`,
      });
    }

    const [first, second] = await Promise.all([
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", proofInput("concurrent-a.png")),
      mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final-b", proofInput("concurrent-b.png")),
    ]);

    expect(new Set([first.roadLegVehicleId, second.roadLegVehicleId])).toEqual(new Set([
      "road-vehicle-2108-final",
      "road-vehicle-2108-final-b",
    ]));
    const [vehicleA, vehicleB] = await Promise.all([
      mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final"),
      mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final-b"),
    ]);
    expect(vehicleA.handoverProgress).toMatchObject({ completedHandovers: 2, requiredHandovers: 2, orderStatus: "DELIVERED" });
    expect(vehicleB.handoverProgress).toEqual(vehicleA.handoverProgress);
    expect(vehicleA.proofOfDelivery?.id).not.toBe(vehicleB.proofOfDelivery?.id);
  });

  it("persists and reloads a valid near-10 MB proof as a bounded preview", async () => {
    await mockEscortExecutionService.recordRoadWelfare("road-execution-2108-final", {
      eventType: "FINAL_DESTINATION",
      photo: photo("large-proof-welfare.png"),
      note: "Ready for a large proof upload.",
    });
    await mockEscortExecutionService.recordRoadProofOfDelivery("road-vehicle-2108-final", {
      recipientName: "Camille Martin",
      photo: nearTenMegabytePng(),
    });

    const serialized = window.sessionStorage.getItem(previewUnifiedStorageKey)!;
    expect(serialized.length).toBeLessThan(500_000);
    const reloaded = await mockEscortExecutionService.getAssignedRoadExecution("road-execution-2108-final");
    expect(reloaded.proofOfDelivery).toMatchObject({
      proofPhotoName: "large-proof.png",
      proofPhotoIsPreview: true,
    });
    expect(reloaded.proofOfDelivery?.proofPhotoUrl.length).toBeLessThan(100_000);
  });
});
