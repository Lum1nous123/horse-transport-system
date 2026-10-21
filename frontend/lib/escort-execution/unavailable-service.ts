import {
  EscortExecutionError,
  type EscortExecutionService,
} from "./types";

function unavailable(): never {
  throw new EscortExecutionError(
    "The ROAD execution API contract is not available yet. Use development preview mode until BE-23 and BE-24 publish the reviewed contract.",
    "CONTRACT_UNAVAILABLE",
  );
}

export const unavailableEscortExecutionService: EscortExecutionService = {
  async listAssignedRoadWork() {
    return unavailable();
  },
  async getAssignedRoadExecution() {
    return unavailable();
  },
  async recordRoadWelfare() {
    return unavailable();
  },
};
