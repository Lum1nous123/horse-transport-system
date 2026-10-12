export type RoutePlanStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "RETURNED"
  | "PENDING_LM_REVIEW"
  | "APPROVED";

export type RouteLegType = "ROAD" | "AIR";

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

export type RoutePlanLeg = {
  id: string;
  sequenceNo: number;
  legType: RouteLegType;
  origin: string;
  destination: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  airProviderName: string | null;
  airReference: string | null;
  airCapacityHorses: number | null;
  equipmentDetails: string | null;
  notes: string | null;
};

export type RouteLegInput = Omit<RoutePlanLeg, "id" | "sequenceNo">;

export type RoutePlanValidationIssue = {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
  legId: string | null;
  field: keyof RouteLegInput | null;
};

export type RoutePlanDetail = {
  id: string | null;
  orderId: string;
  status: RoutePlanStatus;
  revision: number;
  updatedAt: string | null;
  returnedReason: string | null;
  readOnly: boolean;
  legs: RoutePlanLeg[];
  validationIssues: RoutePlanValidationIssue[];
};

export type RoadVehicleCandidate = {
  id: string;
  plateNumber: string;
  vehicleName: string;
  vehicleType: string;
  horseCapacity: number;
  selectable: boolean;
  unavailableReason: string | null;
};

export type RoadOrderHorse = {
  orderHorseId: string;
  name: string;
  microchipId: string;
  travelNotes: string | null;
};

export type RoadVehicleAllocation = {
  vehicleId: string;
  orderHorseIds: string[];
};

export type RoadCheckpointType = "REST_STOP" | "BORDER" | "QUARANTINE" | "OTHER";

export type RoadCheckpoint = {
  id: string;
  sequenceNo: number;
  name: string;
  checkpointType: RoadCheckpointType;
  countryCode: string | null;
  minimumRequiredStopMinutes: number | null;
  plannedStopDurationMinutes: number | null;
  notes: string | null;
};

export type RoadCheckpointInput = Omit<RoadCheckpoint, "id" | "sequenceNo">;

export type RoadSetupValidationIssue = {
  code: string;
  message: string;
  target: "SETUP" | "VEHICLE" | "HORSE" | "CHECKPOINT";
  targetId: string | null;
};

export type RoadLegSetup = {
  routeLegId: string;
  revision: number;
  updatedAt: string | null;
  readOnly: boolean;
  candidates: RoadVehicleCandidate[];
  horses: RoadOrderHorse[];
  allocations: RoadVehicleAllocation[];
  checkpoints: RoadCheckpoint[];
  validationIssues: RoadSetupValidationIssue[];
};

export type RoadAllocationInput = {
  selectedVehicleIds: string[];
  horseAssignments: Array<{ orderHorseId: string; vehicleId: string }>;
};

export type FleetRouteCoordinatorService = {
  listAssignedActionableOrders(): Promise<AssignedCoordinatorQueue>;
  getAssignedPlanningContext(orderId: string): Promise<AssignedCoordinatorOrderDetail>;
  getRoutePlan(orderId: string): Promise<RoutePlanDetail>;
  saveRouteLeg(orderId: string, input: RouteLegInput, legId?: string): Promise<RoutePlanDetail>;
  deleteRouteLeg(orderId: string, legId: string): Promise<RoutePlanDetail>;
  moveRouteLeg(orderId: string, legId: string, direction: "UP" | "DOWN"): Promise<RoutePlanDetail>;
  validateRoutePlan(orderId: string): Promise<RoutePlanDetail>;
  submitRoutePlan(orderId: string): Promise<RoutePlanDetail>;
  getRoadLegSetup(orderId: string, routeLegId: string): Promise<RoadLegSetup>;
  saveRoadAllocations(orderId: string, routeLegId: string, input: RoadAllocationInput): Promise<RoadLegSetup>;
  saveRoadCheckpoint(orderId: string, routeLegId: string, input: RoadCheckpointInput, checkpointId?: string): Promise<RoadLegSetup>;
  deleteRoadCheckpoint(orderId: string, routeLegId: string, checkpointId: string): Promise<RoadLegSetup>;
  moveRoadCheckpoint(orderId: string, routeLegId: string, checkpointId: string, direction: "UP" | "DOWN"): Promise<RoadLegSetup>;
  validateRoadLegSetup(orderId: string, routeLegId: string): Promise<RoadLegSetup>;
};

export type CoordinatorWorkspaceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STALE_STATE"
  | "LOCKED"
  | "VALIDATION_FAILED"
  | "REQUEST_FAILED"
  | "CONTRACT_UNAVAILABLE";

export class CoordinatorWorkspaceError extends Error {
  constructor(message: string, public readonly code: CoordinatorWorkspaceErrorCode) {
    super(message);
    this.name = "CoordinatorWorkspaceError";
  }
}
