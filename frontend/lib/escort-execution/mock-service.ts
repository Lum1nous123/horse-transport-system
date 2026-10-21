import { getPreviewEscortIdentity } from "./use-escort-access";
import {
  EscortExecutionError,
  type AssignedHorse,
  type AssignedRoadExecutionDetail,
  type AssignedRoadExecutionSummary,
  type EscortExecutionService,
  type ExecutionStatus,
  type RecordRoadWelfareInput,
  type RoadCheckpointType,
  type RouteLegStatus,
  type WelfareEvidence,
} from "./types";

const STORAGE_KEY = "horse-transport-escort-road-preview-v1";

type MockCheckpointDefinition = {
  id: string;
  sequenceNo: number;
  name: string;
  checkpointType: RoadCheckpointType;
};

type MockRouteLeg = {
  id: string;
  sequenceNo: number;
  status: RouteLegStatus;
  isFinalLeg: boolean;
  origin: string;
  destination: string;
  plannedDepartureAt: string;
  checkpoints: MockCheckpointDefinition[];
};

type MockRoadExecution = {
  id: string;
  orderId: string;
  orderCode: string;
  routeLegId: string;
  assignedEscortId: string;
  assignedEscortName: string;
  driverName: string;
  vehiclePlateNumber: string;
  vehicleName: string;
  horses: AssignedHorse[];
  status: ExecutionStatus;
  checkpointArrivals: Record<string, string>;
  checkpointWelfare: Record<string, WelfareEvidence>;
  destinationArrivedAt: string | null;
  finalWelfareEvidence: WelfareEvidence | null;
  lastUpdatedAt: string;
};

type MockState = {
  routeLegs: MockRouteLeg[];
  executions: MockRoadExecution[];
};

const sharedLexingtonCheckpoints: MockCheckpointDefinition[] = [
  { id: "checkpoint-lex-1", sequenceNo: 1, name: "Bluegrass rest area", checkpointType: "REST_STOP" },
  { id: "checkpoint-lex-2", sequenceNo: 2, name: "Chicago cargo gate", checkpointType: "OTHER" },
];

const initialState: MockState = {
  routeLegs: [
    {
      id: "leg-2074-1",
      sequenceNo: 1,
      status: "IN_PROGRESS",
      isFinalLeg: false,
      origin: "Lexington, United States",
      destination: "Chicago O'Hare Cargo Terminal",
      plannedDepartureAt: "2026-10-28T09:00:00-04:00",
      checkpoints: sharedLexingtonCheckpoints,
    },
    {
      id: "leg-2108-3",
      sequenceNo: 3,
      status: "IN_PROGRESS",
      isFinalLeg: true,
      origin: "Brussels Airport Cargo",
      destination: "Chantilly, France",
      plannedDepartureAt: "2026-10-30T08:00:00+01:00",
      checkpoints: [],
    },
  ],
  executions: [
    {
      id: "road-execution-2074-a",
      orderId: "order-2074",
      orderCode: "ORD-2074",
      routeLegId: "leg-2074-1",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      driverName: "Noah Williams",
      vehiclePlateNumber: "TRK-101",
      vehicleName: "EquiMove 1",
      horses: [
        { id: "horse-apollo", name: "Apollo", microchipId: "985141000120101" },
        { id: "horse-bella", name: "Bella", microchipId: "985141000120102" },
      ],
      status: "IN_PROGRESS",
      checkpointArrivals: { "checkpoint-lex-1": "2026-10-28T14:18:00-04:00" },
      checkpointWelfare: {},
      destinationArrivedAt: null,
      finalWelfareEvidence: null,
      lastUpdatedAt: "2026-10-28T14:18:00-04:00",
    },
    {
      id: "road-execution-2108-final",
      orderId: "order-2108",
      orderCode: "ORD-2108",
      routeLegId: "leg-2108-3",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      driverName: "Ethan Brown",
      vehiclePlateNumber: "BE-210",
      vehicleName: "Brussels Equine Van",
      horses: [
        { id: "horse-comet", name: "Silver Comet", microchipId: "985141000120210" },
      ],
      status: "DESTINATION",
      checkpointArrivals: {},
      checkpointWelfare: {},
      destinationArrivedAt: "2026-10-30T11:42:00+01:00",
      finalWelfareEvidence: null,
      lastUpdatedAt: "2026-10-30T11:42:00+01:00",
    },
    {
      id: "road-execution-2074-b",
      orderId: "order-2074",
      orderCode: "ORD-2074",
      routeLegId: "leg-2074-1",
      assignedEscortId: "escort-liam",
      assignedEscortName: "Liam Foster",
      driverName: "Oliver Martin",
      vehiclePlateNumber: "TRK-102",
      vehicleName: "Stallion Express",
      horses: [
        { id: "horse-commander", name: "Commander", microchipId: "985141000120103" },
        { id: "horse-dakota", name: "Dakota", microchipId: "985141000120104" },
      ],
      status: "IN_PROGRESS",
      checkpointArrivals: {
        "checkpoint-lex-1": "2026-10-28T14:47:00-04:00",
        "checkpoint-lex-2": "2026-10-28T17:06:00-05:00",
      },
      checkpointWelfare: {},
      destinationArrivedAt: null,
      finalWelfareEvidence: null,
      lastUpdatedAt: "2026-10-28T17:06:00-05:00",
    },
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function scenario() {
  return new URLSearchParams(window.location.search).get("scenario");
}

function selectedEscort() {
  return getPreviewEscortIdentity(window.location.search);
}

function pause() {
  const delay = process.env.NODE_ENV === "test" ? 0 : 120;
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}

function readState(): MockState {
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return clone(initialState);
  try {
    return JSON.parse(saved) as MockState;
  } catch {
    throw new EscortExecutionError("We couldn't read the saved preview state. Refresh and try again.", "REQUEST_FAILED");
  }
}

function writeState(state: MockState) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new EscortExecutionError(
      "The preview state could not be saved in this browser session. Choose a smaller photo or clear the preview state and try again.",
      "REQUEST_FAILED",
    );
  }
}

function maybeThrowScenarioFailure() {
  if (scenario() === "failure") {
    throw new EscortExecutionError("We couldn't load your assigned execution work. Try again.", "REQUEST_FAILED");
  }
}

function findRouteLeg(state: MockState, routeLegId: string) {
  const routeLeg = state.routeLegs.find((candidate) => candidate.id === routeLegId);
  if (!routeLeg) throw new EscortExecutionError("This RouteLeg is no longer available.", "STALE_STATE");
  return routeLeg;
}

function findAssignedExecution(state: MockState, executionId: string) {
  const execution = state.executions.find((candidate) => candidate.id === executionId);
  if (!execution) throw new EscortExecutionError("This ROAD execution is no longer available.", "NOT_FOUND");
  if (execution.assignedEscortId !== selectedEscort().id) {
    throw new EscortExecutionError("This Vehicle is assigned to another Escort.", "FORBIDDEN");
  }
  return execution;
}

function summary(state: MockState, execution: MockRoadExecution): AssignedRoadExecutionSummary {
  const routeLeg = findRouteLeg(state, execution.routeLegId);
  const reachedCheckpointIds = routeLeg.checkpoints
    .filter((checkpoint) => Boolean(execution.checkpointArrivals[checkpoint.id]))
    .map((checkpoint) => checkpoint.id);
  const pendingCheckpointWelfareCount = reachedCheckpointIds
    .filter((checkpointId) => !execution.checkpointWelfare[checkpointId]).length;
  return {
    executionId: execution.id,
    orderId: execution.orderId,
    orderCode: execution.orderCode,
    routeLegId: routeLeg.id,
    routeLegSequenceNo: routeLeg.sequenceNo,
    routeLegStatus: routeLeg.status,
    isFinalLeg: routeLeg.isFinalLeg,
    origin: routeLeg.origin,
    destination: routeLeg.destination,
    plannedDepartureAt: routeLeg.plannedDepartureAt,
    vehiclePlateNumber: execution.vehiclePlateNumber,
    vehicleName: execution.vehicleName,
    horseCount: execution.horses.length,
    status: execution.status,
    reachedCheckpointCount: reachedCheckpointIds.length,
    pendingCheckpointWelfareCount,
    destinationArrivedAt: execution.destinationArrivedAt,
    finalWelfareRecorded: Boolean(execution.finalWelfareEvidence),
  };
}

function detail(state: MockState, execution: MockRoadExecution): AssignedRoadExecutionDetail {
  const routeLeg = findRouteLeg(state, execution.routeLegId);
  const checkpoints = routeLeg.checkpoints.map((checkpoint) => ({
    ...checkpoint,
    arrivedAt: execution.checkpointArrivals[checkpoint.id] ?? null,
    welfareEvidence: execution.checkpointWelfare[checkpoint.id] ?? null,
  }));
  return {
    ...summary(state, execution),
    assignedEscortId: execution.assignedEscortId,
    assignedEscortName: execution.assignedEscortName,
    driverName: execution.driverName,
    horses: clone(execution.horses),
    checkpoints,
    finalWelfareEvidence: execution.finalWelfareEvidence,
    availableActions: {
      checkpointWelfareIds: checkpoints
        .filter((checkpoint) => checkpoint.arrivedAt && !checkpoint.welfareEvidence)
        .map((checkpoint) => checkpoint.id),
      finalWelfare: Boolean(execution.destinationArrivedAt && !execution.finalWelfareEvidence),
    },
    lastUpdatedAt: execution.lastUpdatedAt,
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new EscortExecutionError("We couldn't read that photo. Choose it again.", "VALIDATION_ERROR"));
    reader.readAsDataURL(file);
  });
}

function validateInput(input: RecordRoadWelfareInput) {
  if (!input.photo || !input.photo.type.startsWith("image/")) {
    throw new EscortExecutionError("Choose a welfare photo before saving.", "VALIDATION_ERROR");
  }
  if (!input.note.trim()) {
    throw new EscortExecutionError("Enter a welfare note before saving.", "VALIDATION_ERROR");
  }
}

export const mockEscortExecutionService: EscortExecutionService = {
  async listAssignedRoadWork() {
    await pause();
    maybeThrowScenarioFailure();
    if (scenario() === "empty") return { executions: [] };
    const state = readState();
    const escort = selectedEscort();
    return {
      executions: state.executions
        .filter((execution) => execution.assignedEscortId === escort.id && execution.status !== "COMPLETED")
        .map((execution) => summary(state, execution))
        .sort((left, right) => left.plannedDepartureAt.localeCompare(right.plannedDepartureAt)),
    };
  },

  async getAssignedRoadExecution(executionId: string) {
    await pause();
    maybeThrowScenarioFailure();
    const state = readState();
    return detail(state, findAssignedExecution(state, executionId));
  },

  async recordRoadWelfare(executionId: string, input: RecordRoadWelfareInput) {
    await pause();
    maybeThrowScenarioFailure();
    validateInput(input);
    const state = readState();
    const execution = findAssignedExecution(state, executionId);
    const routeLeg = findRouteLeg(state, execution.routeLegId);
    const now = new Date().toISOString();
    const photoUrl = await fileToDataUrl(input.photo);

    if (input.eventType === "CHECKPOINT") {
      const checkpoint = routeLeg.checkpoints.find((candidate) => candidate.id === input.checkpointId);
      if (!checkpoint || !execution.checkpointArrivals[checkpoint.id]) {
        throw new EscortExecutionError("Welfare can only be recorded for a checkpoint this Vehicle has reached.", "VALIDATION_ERROR");
      }
      if (execution.checkpointWelfare[checkpoint.id]) {
        throw new EscortExecutionError("Welfare was already recorded for this Vehicle checkpoint. The saved state was refreshed.", "STALE_STATE");
      }
      execution.checkpointWelfare[checkpoint.id] = {
        id: `welfare-${execution.id}-${checkpoint.id}`,
        eventType: "CHECKPOINT",
        checkpointId: checkpoint.id,
        photoUrl,
        photoName: input.photo.name,
        note: input.note.trim(),
        recordedAt: now,
      };
    } else {
      if (!execution.destinationArrivedAt) {
        throw new EscortExecutionError("Final welfare is available only after the Driver records destination arrival.", "VALIDATION_ERROR");
      }
      if (execution.finalWelfareEvidence) {
        throw new EscortExecutionError("Final welfare was already recorded. The saved state was refreshed.", "STALE_STATE");
      }
      execution.finalWelfareEvidence = {
        id: `welfare-${execution.id}-final`,
        eventType: "FINAL_DESTINATION",
        checkpointId: null,
        photoUrl,
        photoName: input.photo.name,
        note: input.note.trim(),
        recordedAt: now,
      };
      execution.status = "COMPLETED";
    }

    execution.lastUpdatedAt = now;
    if (scenario() === "stale") {
      writeState(state);
      throw new EscortExecutionError("The execution changed while you were saving. The persisted state was refreshed.", "STALE_STATE");
    }
    writeState(state);
  },
};
