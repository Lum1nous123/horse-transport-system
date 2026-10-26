import { getPreviewEscortIdentity } from "./use-escort-access";
import { preparePreviewImage } from "./preview-image";
import { assertValidEvidencePhoto } from "./media-validation";
import {
  commitPreviewMutation,
  completeFinalPreviewRouteLeg,
  completePreviewRouteLeg,
  getPreviewOrderStatus,
  getPreviewRouteLegStatus,
  readPreviewSlice,
  startPreviewRouteLeg,
} from "./mock-preview-progression";
import {
  EscortExecutionError,
  type AirEscortExecutionService,
  type AirExecutionAvailableActions,
  type AssignedAirExecutionDetail,
  type AssignedAirExecutionSummary,
  type ExecutionStatus,
  type HandoverProgress,
  type ProofOfDelivery,
  type ProofOfDeliveryInput,
  type RecordAirWelfareInput,
  type RouteLegStatus,
  type WelfareEvidence,
} from "./types";

type MockAirRouteLeg = {
  id: string;
  orderId: string;
  orderCode: string;
  sequenceNo: number;
  status: RouteLegStatus;
  isFinalLeg: boolean;
  origin: string;
  destination: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
};

type MockAirExecution = {
  id: string;
  routeLegId: string;
  assignedEscortId: string;
  assignedEscortName: string;
  status: ExecutionStatus;
  startedAt: string | null;
  destinationArrivedAt: string | null;
  completedAt: string | null;
  welfareEvidence: WelfareEvidence | null;
  proofOfDelivery?: ProofOfDelivery | null;
  lastUpdatedAt: string;
};

type MockAirState = {
  routeLegs: MockAirRouteLeg[];
  executions: MockAirExecution[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const initialState: MockAirState = {
  routeLegs: [
    {
      id: "air-leg-3001-2",
      orderId: "order-3001",
      orderCode: "ORD-3001",
      sequenceNo: 2,
      status: "PLANNED",
      isFinalLeg: false,
      origin: "Chicago O'Hare Cargo Terminal",
      destination: "Liège Airport Cargo",
      plannedDepartureAt: "2026-11-02T09:00:00-06:00",
      plannedArrivalAt: "2026-11-02T23:10:00+01:00",
    },
    {
      id: "air-leg-3002-1",
      orderId: "order-3002",
      orderCode: "ORD-3002",
      sequenceNo: 1,
      status: "READY",
      isFinalLeg: false,
      origin: "Dallas Fort Worth Cargo",
      destination: "Amsterdam Schiphol Cargo",
      plannedDepartureAt: "2026-10-31T11:30:00-05:00",
      plannedArrivalAt: "2026-11-01T06:40:00+01:00",
    },
    {
      id: "air-leg-3003-2",
      orderId: "order-3003",
      orderCode: "ORD-3003",
      sequenceNo: 2,
      status: "IN_PROGRESS",
      isFinalLeg: false,
      origin: "Toronto Pearson Cargo",
      destination: "Frankfurt Animal Lounge",
      plannedDepartureAt: "2026-10-30T18:00:00-04:00",
      plannedArrivalAt: "2026-10-31T08:10:00+01:00",
    },
    {
      id: "air-leg-3004-2",
      orderId: "order-3004",
      orderCode: "ORD-3004",
      sequenceNo: 2,
      status: "IN_PROGRESS",
      isFinalLeg: false,
      origin: "New York JFK Cargo",
      destination: "Paris Charles de Gaulle Cargo",
      plannedDepartureAt: "2026-10-30T16:00:00-04:00",
      plannedArrivalAt: "2026-10-31T05:50:00+01:00",
    },
    {
      id: "air-leg-3005-3",
      orderId: "order-3005",
      orderCode: "ORD-3005",
      sequenceNo: 3,
      status: "IN_PROGRESS",
      isFinalLeg: false,
      origin: "Dubai World Central Cargo",
      destination: "Singapore Changi Animal Quarantine",
      plannedDepartureAt: "2026-10-30T20:00:00+04:00",
      plannedArrivalAt: "2026-10-31T07:15:00+08:00",
    },
    {
      id: "air-leg-3005-4",
      orderId: "order-3005",
      orderCode: "ORD-3005",
      sequenceNo: 4,
      status: "PLANNED",
      isFinalLeg: true,
      origin: "Singapore Changi Animal Quarantine",
      destination: "Singapore Equine Centre",
      plannedDepartureAt: "2026-10-31T11:30:00+08:00",
      plannedArrivalAt: "2026-10-31T12:20:00+08:00",
    },
    {
      id: "air-leg-3006-final",
      orderId: "order-3006",
      orderCode: "ORD-3006",
      sequenceNo: 3,
      status: "IN_PROGRESS",
      isFinalLeg: true,
      origin: "Los Angeles International Cargo",
      destination: "Tokyo Narita Animal Facility",
      plannedDepartureAt: "2026-10-30T13:00:00-07:00",
      plannedArrivalAt: "2026-10-31T17:20:00+09:00",
    },
    {
      id: "air-leg-foreign",
      orderId: "order-foreign",
      orderCode: "ORD-FOREIGN",
      sequenceNo: 1,
      status: "READY",
      isFinalLeg: false,
      origin: "Miami International Cargo",
      destination: "Madrid Barajas Cargo",
      plannedDepartureAt: "2026-11-01T10:00:00-04:00",
      plannedArrivalAt: "2026-11-01T23:45:00+01:00",
    },
    {
      id: "air-leg-3007-1",
      orderId: "order-3007",
      orderCode: "ORD-3007",
      sequenceNo: 1,
      status: "IN_PROGRESS",
      isFinalLeg: false,
      origin: "Dublin Airport Cargo",
      destination: "London Heathrow Animal Reception Centre",
      plannedDepartureAt: "2026-11-03T08:00:00Z",
      plannedArrivalAt: "2026-11-03T09:20:00Z",
    },
    {
      id: "air-leg-3007-3",
      orderId: "order-3007",
      orderCode: "ORD-3007",
      sequenceNo: 3,
      status: "PLANNED",
      isFinalLeg: true,
      origin: "Newmarket Equine Centre",
      destination: "Paris Charles de Gaulle Cargo",
      plannedDepartureAt: "2026-11-04T13:00:00Z",
      plannedArrivalAt: "2026-11-04T15:10:00+01:00",
    },
    {
      id: "air-leg-3008-2",
      orderId: "order-3008",
      orderCode: "ORD-3008",
      sequenceNo: 2,
      status: "PLANNED",
      isFinalLeg: true,
      origin: "Chicago O'Hare Cargo Terminal",
      destination: "Amsterdam Schiphol Cargo",
      plannedDepartureAt: "2026-11-05T18:00:00-06:00",
      plannedArrivalAt: "2026-11-06T08:15:00+01:00",
    },
  ],
  executions: [
    {
      id: "air-execution-upcoming",
      routeLegId: "air-leg-3001-2",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "NOT_STARTED",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-10-29T08:00:00Z",
    },
    {
      id: "air-execution-ready",
      routeLegId: "air-leg-3002-1",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "NOT_STARTED",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-10-30T10:00:00Z",
    },
    {
      id: "air-execution-in-progress",
      routeLegId: "air-leg-3003-2",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "IN_PROGRESS",
      startedAt: "2026-10-30T22:04:00Z",
      destinationArrivedAt: null,
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-10-30T22:04:00Z",
    },
    {
      id: "air-execution-destination",
      routeLegId: "air-leg-3004-2",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "DESTINATION",
      startedAt: "2026-10-30T20:05:00Z",
      destinationArrivedAt: "2026-10-31T04:52:00Z",
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-10-31T04:52:00Z",
    },
    {
      id: "air-execution-welfare",
      routeLegId: "air-leg-3005-3",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "DESTINATION",
      startedAt: "2026-10-30T16:05:00Z",
      destinationArrivedAt: "2026-10-30T23:18:00Z",
      completedAt: null,
      welfareEvidence: {
        id: "welfare-air-execution-welfare-final",
        eventType: "FINAL_DESTINATION",
        checkpointId: null,
        photoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='220'%3E%3Crect width='320' height='220' fill='%23dceef6'/%3E%3Ctext x='160' y='116' text-anchor='middle' font-family='sans-serif' font-size='18' fill='%23143d59'%3EAIR welfare%3C/text%3E%3C/svg%3E",
        photoName: "air-welfare-arrival.svg",
        note: "All horses arrived alert and hydrated.",
        recordedAt: "2026-10-30T23:25:00Z",
      },
      lastUpdatedAt: "2026-10-30T23:25:00Z",
    },
    {
      id: "air-execution-final",
      routeLegId: "air-leg-3006-final",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "DESTINATION",
      startedAt: "2026-10-30T20:02:00Z",
      destinationArrivedAt: "2026-10-31T08:23:00Z",
      completedAt: null,
      welfareEvidence: {
        id: "welfare-air-execution-final-final",
        eventType: "FINAL_DESTINATION",
        checkpointId: null,
        photoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='220'%3E%3Crect width='320' height='220' fill='%23e5f4ea'/%3E%3Ctext x='160' y='116' text-anchor='middle' font-family='sans-serif' font-size='18' fill='%2312653c'%3EFinal AIR welfare%3C/text%3E%3C/svg%3E",
        photoName: "final-air-welfare.svg",
        note: "Final welfare check completed; handover is ready for PoD.",
        recordedAt: "2026-10-31T08:31:00Z",
      },
      lastUpdatedAt: "2026-10-31T08:31:00Z",
    },
    {
      id: "air-execution-next",
      routeLegId: "air-leg-3005-4",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "NOT_STARTED",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-10-30T23:25:00Z",
    },
    {
      id: "air-execution-foreign",
      routeLegId: "air-leg-foreign",
      assignedEscortId: "escort-liam",
      assignedEscortName: "Liam Foster",
      status: "NOT_STARTED",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-10-30T09:00:00Z",
    },
    {
      id: "air-execution-to-road",
      routeLegId: "air-leg-3007-1",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "DESTINATION",
      startedAt: "2026-11-03T08:04:00Z",
      destinationArrivedAt: "2026-11-03T09:18:00Z",
      completedAt: null,
      welfareEvidence: {
        id: "welfare-air-execution-to-road-final",
        eventType: "FINAL_DESTINATION",
        checkpointId: null,
        photoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='220'%3E%3Crect width='320' height='220' fill='%23dceef6'/%3E%3C/svg%3E",
        photoName: "air-to-road-welfare.svg",
        note: "Horses are ready for the connecting ROAD leg.",
        recordedAt: "2026-11-03T09:25:00Z",
      },
      lastUpdatedAt: "2026-11-03T09:25:00Z",
    },
    {
      id: "air-execution-after-road",
      routeLegId: "air-leg-3007-3",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "NOT_STARTED",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-11-03T09:25:00Z",
    },
    {
      id: "air-execution-road-next",
      routeLegId: "air-leg-3008-2",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      status: "NOT_STARTED",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      welfareEvidence: null,
      lastUpdatedAt: "2026-11-05T15:00:00Z",
    },
  ],
};

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

function readState(): MockAirState {
  return readPreviewSlice("air", initialState);
}

function maybeThrowScenarioFailure() {
  if (scenario() === "air-failure" || scenario() === "failure") {
    throw new EscortExecutionError("We couldn't load your assigned AIR execution work. Try again.", "REQUEST_FAILED");
  }
}

function findRouteLeg(state: MockAirState, routeLegId: string) {
  const routeLeg = state.routeLegs.find((candidate) => candidate.id === routeLegId);
  if (!routeLeg) throw new EscortExecutionError("This AIR RouteLeg is no longer available.", "STALE_STATE");
  return routeLeg;
}

function findAssignedExecution(state: MockAirState, executionId: string) {
  const execution = state.executions.find((candidate) => candidate.id === executionId);
  if (!execution) throw new EscortExecutionError("This AIR execution is no longer available.", "NOT_FOUND");
  if (execution.assignedEscortId !== selectedEscort().id) {
    throw new EscortExecutionError("This AIR RouteLeg is assigned to another Escort.", "FORBIDDEN");
  }
  return execution;
}

function findAssignedRouteLegExecution(state: MockAirState, routeLegId: string) {
  const execution = state.executions.find((candidate) => candidate.routeLegId === routeLegId);
  if (!execution) throw new EscortExecutionError("This AIR RouteLeg is no longer available.", "NOT_FOUND");
  if (execution.assignedEscortId !== selectedEscort().id) {
    throw new EscortExecutionError("This AIR RouteLeg is assigned to another Escort.", "FORBIDDEN");
  }
  return execution;
}

function handoverProgress(routeLeg: MockAirRouteLeg, execution: MockAirExecution): HandoverProgress {
  return {
    completedHandovers: Number(Boolean(execution.proofOfDelivery)),
    requiredHandovers: routeLeg.isFinalLeg ? 1 : 0,
    routeLegStatus: getPreviewRouteLegStatus(routeLeg.id, routeLeg.status),
    orderStatus: getPreviewOrderStatus(routeLeg.orderId),
  };
}

function airProofAvailable(routeLeg: MockAirRouteLeg, execution: MockAirExecution) {
  return routeLeg.isFinalLeg
    && getPreviewRouteLegStatus(routeLeg.id, routeLeg.status) === "IN_PROGRESS"
    && getPreviewOrderStatus(routeLeg.orderId) === "IN_PROGRESS"
    && execution.status === "DESTINATION"
    && Boolean(execution.welfareEvidence)
    && !execution.proofOfDelivery;
}

function availableActions(routeLeg: MockAirRouteLeg, execution: MockAirExecution): AirExecutionAvailableActions {
  const welfareRecorded = Boolean(execution.welfareEvidence);
  const routeLegStatus = getPreviewRouteLegStatus(routeLeg.id, routeLeg.status);
  return {
    start: routeLegStatus === "READY" && execution.status === "NOT_STARTED",
    arriveAtDestination: routeLegStatus === "IN_PROGRESS" && execution.status === "IN_PROGRESS",
    recordWelfare: execution.status === "DESTINATION" && !welfareRecorded,
    complete: !routeLeg.isFinalLeg && execution.status === "DESTINATION" && welfareRecorded,
  };
}

function summary(state: MockAirState, execution: MockAirExecution): AssignedAirExecutionSummary {
  const routeLeg = findRouteLeg(state, execution.routeLegId);
  return {
    executionId: execution.id,
    orderId: routeLeg.orderId,
    orderCode: routeLeg.orderCode,
    routeLegId: routeLeg.id,
    routeLegSequenceNo: routeLeg.sequenceNo,
    routeLegStatus: getPreviewRouteLegStatus(routeLeg.id, routeLeg.status),
    isFinalLeg: routeLeg.isFinalLeg,
    origin: routeLeg.origin,
    destination: routeLeg.destination,
    plannedDepartureAt: routeLeg.plannedDepartureAt,
    plannedArrivalAt: routeLeg.plannedArrivalAt,
    status: execution.status,
    welfareRecorded: Boolean(execution.welfareEvidence),
    proofOfDeliveryRecorded: Boolean(execution.proofOfDelivery),
    proofOfDeliveryAvailable: airProofAvailable(routeLeg, execution),
    handoverProgress: handoverProgress(routeLeg, execution),
    availableActions: availableActions(routeLeg, execution),
  };
}

function detail(state: MockAirState, execution: MockAirExecution): AssignedAirExecutionDetail {
  return {
    ...summary(state, execution),
    assignedEscortId: execution.assignedEscortId,
    assignedEscortName: execution.assignedEscortName,
    startedAt: execution.startedAt,
    destinationArrivedAt: execution.destinationArrivedAt,
    completedAt: execution.completedAt,
    welfareEvidence: execution.welfareEvidence,
    proofOfDelivery: execution.proofOfDelivery ?? null,
    lastUpdatedAt: execution.lastUpdatedAt,
  };
}

function now() {
  return new Date().toISOString();
}

function ensureAction(allowed: boolean, message: string) {
  if (!allowed) throw new EscortExecutionError(message, "VALIDATION_ERROR");
}

function throwStaleAfterPersist() {
  throw new EscortExecutionError(
    "The AIR execution changed while you were saving. The persisted state was refreshed.",
    "STALE_STATE",
  );
}

function validateWelfare(input: RecordAirWelfareInput) {
  assertValidEvidencePhoto(input.photo, "welfare");
  if (!input.note.trim()) {
    throw new EscortExecutionError("Enter a welfare note before saving.", "VALIDATION_ERROR");
  }
}

function validateProofInput(input: ProofOfDeliveryInput) {
  assertValidEvidencePhoto(input.photo, "proof");
  const recipientName = input.recipientName.trim();
  if (!recipientName) {
    throw new EscortExecutionError("Enter the recipient name before confirming handover.", "VALIDATION_ERROR");
  }
  if (recipientName.length > 150) {
    throw new EscortExecutionError("Recipient name must be 150 characters or fewer.", "VALIDATION_ERROR");
  }
}

export const mockAirExecutionService: AirEscortExecutionService = {
  async listAssignedAirWork() {
    await pause();
    maybeThrowScenarioFailure();
    if (scenario() === "air-empty" || scenario() === "empty") return { executions: [] };
    const state = readState();
    const escort = selectedEscort();
    return {
      executions: state.executions
        .filter((execution) => execution.assignedEscortId === escort.id && execution.status !== "COMPLETED")
        .map((execution) => summary(state, execution))
        .sort((left, right) => left.plannedDepartureAt.localeCompare(right.plannedDepartureAt)),
    };
  },

  async getAssignedAirExecution(executionId: string) {
    await pause();
    maybeThrowScenarioFailure();
    const state = readState();
    return detail(state, findAssignedExecution(state, executionId));
  },

  async startAirExecution(executionId: string) {
    await pause();
    maybeThrowScenarioFailure();
    commitPreviewMutation("air", initialState, (state, progression) => {
      const execution = findAssignedExecution(state, executionId);
      const routeLeg = findRouteLeg(state, execution.routeLegId);
      ensureAction(availableActions(routeLeg, execution).start, "This AIR RouteLeg cannot be started in its current state.");
      startPreviewRouteLeg(progression, routeLeg.id);
      const timestamp = now();
      routeLeg.status = "IN_PROGRESS";
      execution.status = "IN_PROGRESS";
      execution.startedAt = timestamp;
      execution.lastUpdatedAt = timestamp;
    });
    if (scenario() === "air-stale" || scenario() === "stale") {
      throw new EscortExecutionError("The AIR execution changed while you were saving. The persisted state was refreshed.", "STALE_STATE");
    }
  },

  async recordAirDestinationArrival(executionId: string) {
    await pause();
    maybeThrowScenarioFailure();
    commitPreviewMutation("air", initialState, (state) => {
      const execution = findAssignedExecution(state, executionId);
      const routeLeg = findRouteLeg(state, execution.routeLegId);
      ensureAction(availableActions(routeLeg, execution).arriveAtDestination, "Destination arrival is available only after this AIR execution starts.");
      const timestamp = now();
      execution.status = "DESTINATION";
      execution.destinationArrivedAt = timestamp;
      execution.lastUpdatedAt = timestamp;
    });
    if (scenario() === "air-stale" || scenario() === "stale") return throwStaleAfterPersist();
  },

  async recordAirWelfare(executionId: string, input: RecordAirWelfareInput) {
    await pause();
    maybeThrowScenarioFailure();
    validateWelfare(input);
    const preparedPhoto = await preparePreviewImage(input.photo, { proof: false });
    const timestamp = now();
    commitPreviewMutation("air", initialState, (state) => {
      const execution = findAssignedExecution(state, executionId);
      const routeLeg = findRouteLeg(state, execution.routeLegId);
      ensureAction(availableActions(routeLeg, execution).recordWelfare, "AIR welfare is available only after destination arrival and can be saved once.");
      execution.welfareEvidence = {
        id: `welfare-${execution.id}-final`,
        eventType: "FINAL_DESTINATION",
        checkpointId: null,
        photoUrl: preparedPhoto.photoUrl,
        photoName: preparedPhoto.photoName,
        photoIsPreview: preparedPhoto.photoIsPreview,
        note: input.note.trim(),
        recordedAt: timestamp,
      };
      execution.lastUpdatedAt = timestamp;
    });
    if (scenario() === "air-stale" || scenario() === "stale") return throwStaleAfterPersist();
  },

  async completeAirExecution(executionId: string) {
    await pause();
    maybeThrowScenarioFailure();
    commitPreviewMutation("air", initialState, (state, progression) => {
      const execution = findAssignedExecution(state, executionId);
      const routeLeg = findRouteLeg(state, execution.routeLegId);
      ensureAction(availableActions(routeLeg, execution).complete, routeLeg.isFinalLeg
        ? "Final AIR execution waits for Proof of Delivery and cannot be completed here."
        : "AIR completion requires persisted destination welfare evidence.");
      completePreviewRouteLeg(progression, routeLeg.id);
      const timestamp = now();
      execution.status = "COMPLETED";
      execution.completedAt = timestamp;
      execution.lastUpdatedAt = timestamp;
      routeLeg.status = "COMPLETED";
    });
    if (scenario() === "air-stale" || scenario() === "stale") {
      throw new EscortExecutionError("The AIR execution changed while you were saving. The persisted state was refreshed.", "STALE_STATE");
    }
  },

  async recordAirProofOfDelivery(routeLegId: string, input: ProofOfDeliveryInput) {
    await pause();
    maybeThrowScenarioFailure();
    const before = readState();
    const existingExecution = findAssignedRouteLegExecution(before, routeLegId);
    if (existingExecution.proofOfDelivery) {
      const routeLeg = findRouteLeg(before, routeLegId);
      return { ...clone(existingExecution.proofOfDelivery), ...handoverProgress(routeLeg, existingExecution) };
    }

    validateProofInput(input);
    const preparedPhoto = await preparePreviewImage(input.photo, { proof: true });
    const refreshed = readState();
    const refreshedExecution = findAssignedRouteLegExecution(refreshed, routeLegId);
    if (refreshedExecution.proofOfDelivery) {
      const routeLeg = findRouteLeg(refreshed, routeLegId);
      return { ...clone(refreshedExecution.proofOfDelivery), ...handoverProgress(routeLeg, refreshedExecution) };
    }

    const proofPhotoUrl = `${preparedPhoto.photoUrl}#proof-of-delivery-${encodeURIComponent(routeLegId)}`;
    const timestamp = now();
    let persisted!: ProofOfDelivery;

    commitPreviewMutation("air", initialState, (state, progression) => {
      const execution = findAssignedRouteLegExecution(state, routeLegId);
      const routeLeg = findRouteLeg(state, routeLegId);
      if (execution.proofOfDelivery) {
        persisted = clone(execution.proofOfDelivery);
        return;
      }
      if (!routeLeg.isFinalLeg || routeLeg.status !== "IN_PROGRESS") {
        throw new EscortExecutionError("Proof of Delivery is available only for the active final AIR RouteLeg.", "VALIDATION_ERROR");
      }
      if (execution.status !== "DESTINATION" || !execution.welfareEvidence) {
        throw new EscortExecutionError("AIR handover requires destination arrival and persisted final welfare.", "VALIDATION_ERROR");
      }
      if (proofPhotoUrl === execution.welfareEvidence.photoUrl) {
        throw new EscortExecutionError("Proof photo must be separate from the final welfare photo.", "VALIDATION_ERROR");
      }

      execution.proofOfDelivery = {
        id: `pod-${execution.id}`,
        mode: "AIR",
        airLegExecutionId: execution.id,
        routeLegId,
        transportedOrderHorseIds: [],
        recipientName: input.recipientName.trim(),
        proofPhotoUrl,
        proofPhotoName: preparedPhoto.photoName,
        proofPhotoIsPreview: preparedPhoto.photoIsPreview,
        handoverNote: input.note?.trim() || null,
        confirmedByEscortId: execution.assignedEscortId,
        deliveredAt: timestamp,
        completedHandovers: 1,
        requiredHandovers: 1,
        routeLegStatus: "COMPLETED",
        orderStatus: "DELIVERED",
      };
      execution.status = "COMPLETED";
      execution.completedAt = timestamp;
      execution.lastUpdatedAt = timestamp;
      completeFinalPreviewRouteLeg(progression, routeLeg.id);
      routeLeg.status = "COMPLETED";
      persisted = clone(execution.proofOfDelivery);
    });

    if (scenario() === "air-stale" || scenario() === "stale" || scenario() === "pod-stale") {
      throw new EscortExecutionError("The AIR handover changed while saving. Read back the persisted proof before continuing.", "STALE_STATE");
    }
    return persisted;
  },
};
