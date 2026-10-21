import { describe, expect, it } from "vitest";
import { getEscortExecutionService } from "./service";
import { EscortExecutionError } from "./types";

describe("getEscortExecutionService", () => {
  it("fails closed outside development preview while backend contracts are unavailable", async () => {
    await expect(getEscortExecutionService(false).listAssignedRoadWork()).rejects.toMatchObject({
      name: EscortExecutionError.name,
      code: "CONTRACT_UNAVAILABLE",
    });
    await expect(getEscortExecutionService(true).listAssignedRoadWork()).rejects.toMatchObject({
      code: "CONTRACT_UNAVAILABLE",
    });
  });
});
