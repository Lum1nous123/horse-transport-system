import { apiFleetRouteCoordinatorService } from "./api-service";
import { mockFleetRouteCoordinatorService } from "./mock-service";
import type { FleetRouteCoordinatorService } from "./types";

export function getFleetRouteCoordinatorService(preview: boolean): FleetRouteCoordinatorService {
  return preview ? mockFleetRouteCoordinatorService : apiFleetRouteCoordinatorService;
}

export * from "./types";
