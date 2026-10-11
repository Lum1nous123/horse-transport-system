import { mockFleetRouteCoordinatorService } from "./mock-service";
import {
  CoordinatorWorkspaceError,
  type FleetRouteCoordinatorService,
} from "./types";

const contractUnavailableService: FleetRouteCoordinatorService = {
  async listAssignedActionableOrders() {
    throw new CoordinatorWorkspaceError(
      "Assigned route-planning Orders are not available right now. Try again later.",
      "CONTRACT_UNAVAILABLE",
    );
  },
  async getAssignedPlanningContext() {
    throw new CoordinatorWorkspaceError(
      "Route-planning context is not available right now. Return to the planning queue.",
      "CONTRACT_UNAVAILABLE",
    );
  },
};

// BE-15 does not yet expose a usable frontend contract. Keeping service
// selection here prevents guessed endpoints and DTOs from leaking into pages.
export function getFleetRouteCoordinatorService(preview: boolean): FleetRouteCoordinatorService {
  return preview ? mockFleetRouteCoordinatorService : contractUnavailableService;
}

export * from "./types";
