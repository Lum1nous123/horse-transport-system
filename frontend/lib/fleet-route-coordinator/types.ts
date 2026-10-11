export type RoutePlanStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "RETURNED"
  | "PENDING_LM_REVIEW"
  | "APPROVED";

export type PlanningReadinessItem = {
  id: string;
  label: string;
  description: string;
  state: "complete" | "current" | "locked";
};

export type AssignedCoordinatorOrderSummary = {
  id: string;
  orderCode: string;
  origin: string;
  destination: string;
  requestedDepartureAt: string;
  horseCount: number;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  routePlanStatus: RoutePlanStatus;
  routePlanUpdatedAt: string | null;
  returnReason: string | null;
};

export type AssignedCoordinatorOrderDetail = AssignedCoordinatorOrderSummary & {
  customerName: string;
  assignedAt: string;
  assignedTransportSpecialistName: string;
  assignedFleetRouteCoordinatorId: string;
  assignedFleetRouteCoordinatorName: string;
  documentFinalConfirmedAt: string;
  remainingBalancePaidAt: string;
  readiness: PlanningReadinessItem[];
  readOnly: boolean;
};

export type AssignedCoordinatorQueue = {
  orders: AssignedCoordinatorOrderSummary[];
};

export type FleetRouteCoordinatorService = {
  listAssignedActionableOrders(): Promise<AssignedCoordinatorQueue>;
  getAssignedPlanningContext(orderId: string): Promise<AssignedCoordinatorOrderDetail>;
};

export type CoordinatorWorkspaceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STALE_STATE"
  | "REQUEST_FAILED"
  | "CONTRACT_UNAVAILABLE";

export class CoordinatorWorkspaceError extends Error {
  constructor(message: string, public readonly code: CoordinatorWorkspaceErrorCode) {
    super(message);
    this.name = "CoordinatorWorkspaceError";
  }
}
