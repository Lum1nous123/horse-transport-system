// Frontend view models, not BE-23/BE-24 wire DTOs. An approved API adapter must
// map the published contract to this boundary before production integration.
export type LegStatus = "PLANNED" | "READY" | "IN_PROGRESS" | "COMPLETED";
export type ExecutionStatus = "NOT_STARTED" | "IN_PROGRESS" | "DESTINATION" | "COMPLETED";
export type ExecutionOrderStatus = "READY_TO_SHIP" | "IN_PROGRESS" | "DELIVERED" | "CANCELLED" | "REJECTED";

export type ExecutionLeg = {
  id: string;
  sequenceNo: number;
  type: "ROAD" | "AIR";
  origin: string;
  destination: string;
  status: LegStatus;
};

export type ExecutionCheckpoint = {
  id: string;
  routeLegId: string;
  sequenceNo: number;
  name: string;
};

export type CheckpointArrival = {
  checkpointId: string;
  executionId: string;
  arrivedAt: string;
};

export type DriverExecution = {
  id: string;
  driverId: string;
  revision: number;
  order: { id: string; code: string; status: ExecutionOrderStatus };
  currentLegId: string | null;
  legId: string;
  legs: ExecutionLeg[];
  vehicle: { id: string; plateNumber: string; horseCount: number };
  status: ExecutionStatus;
  checkpoints: ExecutionCheckpoint[];
  arrivals: CheckpointArrival[];
  startedAt: string | null;
  destinationArrivedAt: string | null;
  completedAt: string | null;
  // Adapter supplies server-authoritative eligibility, including any rules
  // beyond the conservative UI guards in actions.ts.
  permissions: {
    canStart: boolean;
    nextCheckpointId: string | null;
    canArriveAtDestination: boolean;
    blockedReason: string | null;
  };
};

export type ExecutionCommand = {
  executionId: string;
  expectedRevision: number;
};

export interface DriverExecutionService {
  listAssignedWork(signal?: AbortSignal): Promise<DriverExecution[]>;
  getExecution(executionId: string, signal?: AbortSignal): Promise<DriverExecution>;
  startVehicle(command: ExecutionCommand): Promise<void>;
  arriveAtCheckpoint(command: ExecutionCommand & { checkpointId: string }): Promise<void>;
  arriveAtDestination(command: ExecutionCommand): Promise<void>;
}

export type ExecutionErrorCode =
  | "FORBIDDEN" | "NOT_FOUND" | "OUT_OF_SEQUENCE" | "STALE_STATE"
  | "ALREADY_RECORDED" | "NETWORK_ERROR" | "CONTRACT_UNAVAILABLE";

export class ExecutionError extends Error {
  constructor(message: string, public readonly code: ExecutionErrorCode) {
    super(message);
    this.name = "ExecutionError";
  }
}

export type DriverSession = {
  driverId: string;
  fullName: string;
  preview: boolean;
  previewQuery: string;
  service: DriverExecutionService;
};
