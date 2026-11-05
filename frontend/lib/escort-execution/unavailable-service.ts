import {
  EscortExecutionError,
  type EscortExecutionService,
} from "./types";

function unavailable(): never {
  throw new EscortExecutionError(
    "The Escort execution API integration is not enabled in this frontend build. Use development preview mode until the reviewed ROAD/AIR/PoD contracts are integrated.",
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
  async recordRoadProofOfDelivery() {
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
  async recordAirProofOfDelivery() {
    return unavailable();
  },
};
