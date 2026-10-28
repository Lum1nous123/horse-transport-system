import type { EscortExecutionService } from "./types";
import { unavailableEscortExecutionService } from "./unavailable-service";
import { productionEscortExecutionService } from "./production-service";

let mockServicePromise: Promise<EscortExecutionService> | null = null;

function loadDevelopmentMockService() {
  if (process.env.NODE_ENV !== "development") {
    return Promise.resolve(unavailableEscortExecutionService);
  }
  mockServicePromise ??= Promise.all([
    import("./mock-service"),
    import("./mock-air-service"),
  ]).then(([road, air]) => ({
    ...road.mockEscortExecutionService,
    ...air.mockAirExecutionService,
  }));
  return mockServicePromise;
}

const lazyDevelopmentMockService: EscortExecutionService = {
  async listAssignedRoadWork() {
    return (await loadDevelopmentMockService()).listAssignedRoadWork();
  },
  async getAssignedRoadExecution(executionId) {
    return (await loadDevelopmentMockService()).getAssignedRoadExecution(executionId);
  },
  async recordRoadWelfare(executionId, input) {
    return (await loadDevelopmentMockService()).recordRoadWelfare(executionId, input);
  },
  async recordRoadProofOfDelivery(roadLegVehicleId, input) {
    return (await loadDevelopmentMockService()).recordRoadProofOfDelivery(roadLegVehicleId, input);
  },
  async listAssignedAirWork() {
    return (await loadDevelopmentMockService()).listAssignedAirWork();
  },
  async getAssignedAirExecution(executionId) {
    return (await loadDevelopmentMockService()).getAssignedAirExecution(executionId);
  },
  async startAirExecution(executionId) {
    return (await loadDevelopmentMockService()).startAirExecution(executionId);
  },
  async recordAirDestinationArrival(executionId) {
    return (await loadDevelopmentMockService()).recordAirDestinationArrival(executionId);
  },
  async recordAirWelfare(executionId, input) {
    return (await loadDevelopmentMockService()).recordAirWelfare(executionId, input);
  },
  async completeAirExecution(executionId) {
    return (await loadDevelopmentMockService()).completeAirExecution(executionId);
  },
  async recordAirProofOfDelivery(routeLegId, input) {
    return (await loadDevelopmentMockService()).recordAirProofOfDelivery(routeLegId, input);
  },
};

export function getEscortExecutionService(preview: boolean): EscortExecutionService {
  const developmentPreview = process.env.NODE_ENV === "development" && preview;
  return developmentPreview ? lazyDevelopmentMockService : productionEscortExecutionService;
}

export * from "./types";
