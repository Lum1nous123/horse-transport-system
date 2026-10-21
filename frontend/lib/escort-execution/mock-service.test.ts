import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockEscortExecutionService } from "./mock-service";
import { EscortExecutionError, type EscortExecutionErrorCode } from "./types";

function usePreviewEscort(escortId = "escort-mia", scenario?: string) {
  const params = new URLSearchParams({ preview: "1", escortId });
  if (scenario) params.set("scenario", scenario);
  window.history.replaceState({}, "", `/escort?${params.toString()}`);
}

function photo(name = "welfare.png") {
  return new File(["photo-data"], name, { type: "image/png" });
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
    window.sessionStorage.clear();
    usePreviewEscort();
  });

  it("returns only ROAD work assigned to the signed-in Escort", async () => {
    const queue = await mockEscortExecutionService.listAssignedRoadWork();

    expect(queue.executions).toHaveLength(2);
    expect(queue.executions.map((item) => item.executionId)).toEqual([
      "road-execution-2074-a",
      "road-execution-2108-final",
    ]);
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
    expect(checkpoint?.welfareEvidence?.photoUrl).toMatch(/^data:image\/png;base64,/);
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
});
