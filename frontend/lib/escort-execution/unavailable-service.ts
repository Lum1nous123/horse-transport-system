import {
  EscortExecutionError,
  type EscortExecutionService,
} from "./types";

function unavailable(): never {
  throw new EscortExecutionError(
    "The Escort execution API contract is not available yet. Use development preview mode until the reviewed ROAD/AIR contracts are integrated.",
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
  async listAssignedAirWork() {
    return unavailable();
  },
  async getAssignedAirExecution() {
    return unavailable();
  },
  async startAirExecution() {
    return unavailable();
  },
  async recordAirDestinationArrival() {
    return unavailable();
  },
  async recordAirWelfare() {
    return unavailable();
  },
  async completeAirExecution() {
    return unavailable();
  },
};
