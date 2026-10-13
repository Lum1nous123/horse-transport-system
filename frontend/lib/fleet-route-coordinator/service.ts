import { mockFleetRouteCoordinatorService } from "./mock-service";
import {
  CoordinatorWorkspaceError,
  type FleetRouteCoordinatorService,
} from "./types";

function contractUnavailable(): never {
  throw new CoordinatorWorkspaceError(
    "Route Plan services are not available right now. Try again later.",
    "CONTRACT_UNAVAILABLE",
  );
}

const contractUnavailableService: FleetRouteCoordinatorService = {
  async listAssignedActionableOrders() { return contractUnavailable(); },
  async getAssignedPlanningContext() { return contractUnavailable(); },
  async getRoutePlan() { return contractUnavailable(); },
  async saveRouteLeg() { return contractUnavailable(); },
  async deleteRouteLeg() { return contractUnavailable(); },
  async moveRouteLeg() { return contractUnavailable(); },
  async validateRoutePlan() { return contractUnavailable(); },
  async submitRoutePlan() { return contractUnavailable(); },
  async getRoadLegSetup() { return contractUnavailable(); },
  async saveRoadAllocations() { return contractUnavailable(); },
  async saveRoadCheckpoint() { return contractUnavailable(); },
  async deleteRoadCheckpoint() { return contractUnavailable(); },
  async moveRoadCheckpoint() { return contractUnavailable(); },
  async validateRoadLegSetup() { return contractUnavailable(); },
};

// BE-15/16/19/20 do not yet expose usable frontend contracts. Keeping service
// selection here prevents guessed endpoints and DTOs from leaking into pages.
export function getFleetRouteCoordinatorService(preview: boolean): FleetRouteCoordinatorService {
  return preview ? mockFleetRouteCoordinatorService : contractUnavailableService;
}

export * from "./types";
