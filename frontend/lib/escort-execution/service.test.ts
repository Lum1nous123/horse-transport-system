import { afterEach, describe, expect, it, vi } from "vitest";
import { getEscortExecutionService } from "./service";
import { EscortExecutionError } from "./types";

describe("getEscortExecutionService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  it("fails closed outside development preview while real API integration is disabled", async () => {
    await expect(getEscortExecutionService(false).listAssignedRoadWork()).rejects.toMatchObject({
      name: EscortExecutionError.name,
      code: "CONTRACT_UNAVAILABLE",
    });
    await expect(getEscortExecutionService(true).listAssignedRoadWork()).rejects.toMatchObject({
      code: "CONTRACT_UNAVAILABLE",
    });
    await expect(getEscortExecutionService(false).listAssignedAirWork()).rejects.toMatchObject({
      name: EscortExecutionError.name,
      code: "CONTRACT_UNAVAILABLE",
    });
    await expect(getEscortExecutionService(true).startAirExecution("air-execution-ready")).rejects.toMatchObject({
      code: "CONTRACT_UNAVAILABLE",
    });
    await expect(getEscortExecutionService(true).recordRoadProofOfDelivery("road-vehicle", {
      recipientName: "Recipient",
      photo: new File(["photo"], "proof.png", { type: "image/png" }),
    })).rejects.toMatchObject({ code: "CONTRACT_UNAVAILABLE" });
    await expect(getEscortExecutionService(true).recordAirProofOfDelivery("air-leg", {
      recipientName: "Recipient",
      photo: new File(["photo"], "proof.png", { type: "image/png" }),
    })).rejects.toMatchObject({ code: "CONTRACT_UNAVAILABLE" });
  });

  it("loads the isolated mock adapter only for explicit development preview", async () => {
    vi.stubEnv("NODE_ENV", "development");
    window.history.replaceState({}, "", "/escort?preview=1&escortId=escort-mia");

    const queue = await getEscortExecutionService(true).listAssignedAirWork();

    expect(queue.executions.some((execution) => execution.executionId === "air-execution-ready")).toBe(true);
  });
});
