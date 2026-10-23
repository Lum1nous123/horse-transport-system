export type ExecutionStatus = "NOT_STARTED" | "IN_PROGRESS" | "DESTINATION" | "COMPLETED";

export type RouteLegStatus = "PLANNED" | "READY" | "IN_PROGRESS" | "COMPLETED";

export type RoadCheckpointType = "REST_STOP" | "BORDER" | "QUARANTINE" | "OTHER";

export type WelfareEventType = "CHECKPOINT" | "FINAL_DESTINATION";

export type AssignedHorse = {
  id: string;
  name: string;
  microchipId: string;
};

export type WelfareEvidence = {
  id: string;
  eventType: WelfareEventType;
  checkpointId: string | null;
  photoUrl: string;
  photoName: string;
  note: string;
  recordedAt: string;
};

export type RoadCheckpointProgress = {
  id: string;
  sequenceNo: number;
  name: string;
  checkpointType: RoadCheckpointType;
  arrivedAt: string | null;
  welfareEvidence: WelfareEvidence | null;
};

export type AssignedRoadExecutionSummary = {
  executionId: string;
  orderId: string;
  orderCode: string;
  routeLegId: string;
  routeLegSequenceNo: number;
  routeLegStatus: RouteLegStatus;
  isFinalLeg: boolean;
  origin: string;
  destination: string;
  plannedDepartureAt: string;
  vehiclePlateNumber: string;
  vehicleName: string;
  horseCount: number;
  status: ExecutionStatus;
  reachedCheckpointCount: number;
  pendingCheckpointWelfareCount: number;
  destinationArrivedAt: string | null;
  finalWelfareRecorded: boolean;
};

export type AssignedRoadExecutionDetail = AssignedRoadExecutionSummary & {
  assignedEscortId: string;
  assignedEscortName: string;
  driverName: string;
  horses: AssignedHorse[];
  checkpoints: RoadCheckpointProgress[];
  finalWelfareEvidence: WelfareEvidence | null;
  availableActions: {
    checkpointWelfareIds: string[];
    finalWelfare: boolean;
  };
  lastUpdatedAt: string;
};

export type AssignedRoadWorkQueue = {
  executions: AssignedRoadExecutionSummary[];
};

export type AirExecutionAvailableActions = {
  start: boolean;
  arriveAtDestination: boolean;
  recordWelfare: boolean;
  complete: boolean;
};

export type AssignedAirExecutionSummary = {
  executionId: string;
  orderId: string;
  orderCode: string;
  routeLegId: string;
  routeLegSequenceNo: number;
  routeLegStatus: RouteLegStatus;
  isFinalLeg: boolean;
  origin: string;
  destination: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  status: ExecutionStatus;
  welfareRecorded: boolean;
  availableActions: AirExecutionAvailableActions;
};

export type AssignedAirExecutionDetail = AssignedAirExecutionSummary & {
  assignedEscortId: string;
  assignedEscortName: string;
  startedAt: string | null;
  destinationArrivedAt: string | null;
  completedAt: string | null;
  welfareEvidence: WelfareEvidence | null;
  lastUpdatedAt: string;
};

export type AssignedAirWorkQueue = {
  executions: AssignedAirExecutionSummary[];
};

export type RecordAirWelfareInput = {
  photo: File;
  note: string;
};

export type RecordRoadWelfareInput =
  | {
      eventType: "CHECKPOINT";
      checkpointId: string;
      photo: File;
      note: string;
    }
  | {
      eventType: "FINAL_DESTINATION";
      checkpointId?: never;
      photo: File;
      note: string;
    };

export type RoadEscortExecutionService = {
  listAssignedRoadWork(): Promise<AssignedRoadWorkQueue>;
  getAssignedRoadExecution(executionId: string): Promise<AssignedRoadExecutionDetail>;
  recordRoadWelfare(executionId: string, input: RecordRoadWelfareInput): Promise<void>;
};

export type AirEscortExecutionService = {
  listAssignedAirWork(): Promise<AssignedAirWorkQueue>;
  getAssignedAirExecution(executionId: string): Promise<AssignedAirExecutionDetail>;
  startAirExecution(executionId: string): Promise<void>;
  recordAirDestinationArrival(executionId: string): Promise<void>;
  recordAirWelfare(executionId: string, input: RecordAirWelfareInput): Promise<void>;
  completeAirExecution(executionId: string): Promise<void>;
};

export type EscortExecutionService = RoadEscortExecutionService & AirEscortExecutionService;

export type EscortExecutionErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "STALE_STATE"
  | "REQUEST_FAILED"
  | "CONTRACT_UNAVAILABLE";

export class EscortExecutionError extends Error {
  constructor(message: string, public readonly code: EscortExecutionErrorCode) {
    super(message);
    this.name = "EscortExecutionError";
  }
}
