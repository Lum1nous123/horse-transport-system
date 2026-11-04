import { afterEach, describe, expect, it, vi } from "vitest";
import { getEscortExecutionService } from "./service";
import { EscortExecutionError } from "./types";

describe("getEscortExecutionService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  it("uses the authenticated API service outside explicit development preview", async () => {
    await expect(getEscortExecutionService(false).listAssignedRoadWork()).rejects.toMatchObject({
      name: EscortExecutionError.name,
      code: "FORBIDDEN",
    });
    await expect(getEscortExecutionService(true).listAssignedRoadWork()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getEscortExecutionService(false).listAssignedAirWork()).rejects.toMatchObject({
      name: EscortExecutionError.name,
      code: "FORBIDDEN",
    });
  });

  it("loads the isolated mock adapter only for explicit development preview", async () => {
    vi.stubEnv("NODE_ENV", "development");
    window.history.replaceState({}, "", "/escort?preview=1&escortId=escort-mia");

    const queue = await getEscortExecutionService(true).listAssignedAirWork();

    expect(queue.executions.some((execution) => execution.executionId === "air-execution-ready")).toBe(true);
  });
});
