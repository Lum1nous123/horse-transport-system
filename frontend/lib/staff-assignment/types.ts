export type AssignmentStatus = "NEEDS_ASSIGNMENT" | "ASSIGNED";

export type StaffRole = "TRANSPORT_SPECIALIST" | "FLEET_ROUTE_COORDINATOR";

export type AssignmentCandidate = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  activeOrderCount: number;
};

export type AssignedPair = {
  transportSpecialist: AssignmentCandidate;
  fleetRouteCoordinator: AssignmentCandidate;
  assignedAt: string;
};

export type AssignmentOrderSummary = {
  id: string;
  orderCode: string;
  origin: string;
  destination: string;
  requestedDepartureAt: string;
  horseCount: number;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  assignmentStatus: AssignmentStatus;
};

export type AssignmentOrderDetail = AssignmentOrderSummary & {
  customerName: string;
  candidates: {
    transportSpecialists: AssignmentCandidate[];
    fleetRouteCoordinators: AssignmentCandidate[];
  };
  assignedPair: AssignedPair | null;
};

export type AssignmentQueues = {
  needsAssignment: AssignmentOrderSummary[];
  assigned: AssignmentOrderSummary[];
};

export type AssignStaffInput = {
  transportSpecialistId: string;
  fleetRouteCoordinatorId: string;
};

export type AssignmentErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STALE_STATE"
  | "VALIDATION_ERROR"
  | "REQUEST_FAILED";

export class AssignmentServiceError extends Error {
  constructor(
    message: string,
    readonly code: AssignmentErrorCode,
  ) {
    super(message);
  }
}

export interface StaffAssignmentService {
  listOrders(): Promise<AssignmentQueues>;
  getOrder(orderId: string): Promise<AssignmentOrderDetail>;
  assignStaff(orderId: string, input: AssignStaffInput): Promise<void>;
}
