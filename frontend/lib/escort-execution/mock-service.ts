import { getPreviewEscortIdentity } from "./use-escort-access";
import { preparePreviewImage } from "./preview-image";
import {
  commitPreviewMutation,
  completeFinalPreviewRouteLeg,
  completePreviewRouteLeg,
  getPreviewOrderStatus,
  getPreviewRouteLegStatus,
  readPreviewSlice,
} from "./mock-preview-progression";
import {
  EscortExecutionError,
  type AssignedHorse,
  type AssignedRoadExecutionDetail,
  type AssignedRoadExecutionSummary,
  type RoadEscortExecutionService,
  type ExecutionStatus,
  type HandoverProgress,
  type ProofOfDelivery,
  type ProofOfDeliveryInput,
  type RecordRoadWelfareInput,
  type RoadCheckpointType,
  type RouteLegStatus,
  type WelfareEvidence,
} from "./types";

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
  roadLegVehicleId: string;
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
  proofOfDelivery: ProofOfDelivery | null;
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
    {
      id: "road-leg-3007-2",
      sequenceNo: 2,
      status: "PLANNED",
      isFinalLeg: false,
      origin: "London Heathrow Animal Reception Centre",
      destination: "Newmarket Equine Centre",
      plannedDepartureAt: "2026-11-03T12:00:00Z",
      checkpoints: [],
    },
    {
      id: "road-leg-3008-1",
      sequenceNo: 1,
      status: "IN_PROGRESS",
      isFinalLeg: false,
      origin: "Lexington, United States",
      destination: "Chicago O'Hare Cargo Terminal",
      plannedDepartureAt: "2026-11-05T08:00:00-05:00",
      checkpoints: [],
    },
  ],
  executions: [
    {
      id: "road-execution-2074-a",
      roadLegVehicleId: "road-vehicle-2074-a",
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
      proofOfDelivery: null,
      lastUpdatedAt: "2026-10-28T14:18:00-04:00",
    },
    {
      id: "road-execution-2108-final",
      roadLegVehicleId: "road-vehicle-2108-final",
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
      proofOfDelivery: null,
      lastUpdatedAt: "2026-10-30T11:42:00+01:00",
    },
    {
      id: "road-execution-2108-final-b",
      roadLegVehicleId: "road-vehicle-2108-final-b",
      orderId: "order-2108",
      orderCode: "ORD-2108",
      routeLegId: "leg-2108-3",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      driverName: "Sophie Dubois",
      vehiclePlateNumber: "BE-211",
      vehicleName: "Brussels Equine Van 2",
      horses: [
        { id: "horse-luna", name: "Luna Vale", microchipId: "985141000120211" },
        { id: "horse-orion", name: "Orion", microchipId: "985141000120212" },
      ],
      status: "DESTINATION",
      checkpointArrivals: {},
      checkpointWelfare: {},
      destinationArrivedAt: "2026-10-30T11:49:00+01:00",
      finalWelfareEvidence: null,
      proofOfDelivery: null,
      lastUpdatedAt: "2026-10-30T11:49:00+01:00",
    },
    {
      id: "road-execution-2074-b",
      roadLegVehicleId: "road-vehicle-2074-b",
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
      proofOfDelivery: null,
      lastUpdatedAt: "2026-10-28T17:06:00-05:00",
    },
    {
      id: "road-execution-after-air",
      roadLegVehicleId: "road-vehicle-3007",
      orderId: "order-3007",
      orderCode: "ORD-3007",
      routeLegId: "road-leg-3007-2",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      driverName: "Avery Thomas",
      vehiclePlateNumber: "UK-307",
      vehicleName: "Newmarket Connector",
      horses: [{ id: "horse-3007", name: "Northern Light", microchipId: "985141000123007" }],
      status: "NOT_STARTED",
      checkpointArrivals: {},
      checkpointWelfare: {},
      destinationArrivedAt: null,
      finalWelfareEvidence: null,
      proofOfDelivery: null,
      lastUpdatedAt: "2026-11-03T09:25:00Z",
    },
    {
      id: "road-execution-to-air",
      roadLegVehicleId: "road-vehicle-3008-a",
      orderId: "order-3008",
      orderCode: "ORD-3008",
      routeLegId: "road-leg-3008-1",
      assignedEscortId: "escort-mia",
      assignedEscortName: "Mia Laurent",
      driverName: "Jordan Miller",
      vehiclePlateNumber: "US-308",
      vehicleName: "Midwest Equine Transfer",
      horses: [{ id: "horse-3008", name: "Blue Horizon", microchipId: "985141000123008" }],
      status: "DESTINATION",
      checkpointArrivals: {},
      checkpointWelfare: {},
      destinationArrivedAt: "2026-11-05T14:50:00-06:00",
      finalWelfareEvidence: null,
      proofOfDelivery: null,
      lastUpdatedAt: "2026-11-05T14:50:00-06:00",
    },
    {
      id: "road-execution-to-air-b",
      roadLegVehicleId: "road-vehicle-3008-b",
      orderId: "order-3008",
      orderCode: "ORD-3008",
      routeLegId: "road-leg-3008-1",
      assignedEscortId: "escort-liam",
      assignedEscortName: "Liam Foster",
      driverName: "Taylor Anderson",
      vehiclePlateNumber: "US-309",
      vehicleName: "Midwest Equine Transfer 2",
      horses: [{ id: "horse-3009", name: "Prairie Star", microchipId: "985141000123009" }],
      status: "DESTINATION",
      checkpointArrivals: {},
      checkpointWelfare: {},
      destinationArrivedAt: "2026-11-05T14:57:00-06:00",
      finalWelfareEvidence: null,
      proofOfDelivery: null,
      lastUpdatedAt: "2026-11-05T14:57:00-06:00",
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
  return readPreviewSlice("road", initialState);
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

function findAssignedRoadVehicle(state: MockState, roadLegVehicleId: string) {
  const execution = state.executions.find((candidate) => candidate.roadLegVehicleId === roadLegVehicleId);
  if (!execution) throw new EscortExecutionError("This ROAD Vehicle is no longer available.", "NOT_FOUND");
  if (execution.assignedEscortId !== selectedEscort().id) {
    throw new EscortExecutionError("This Vehicle is assigned to another Escort.", "FORBIDDEN");
  }
  return execution;
}

function handoverProgress(state: MockState, execution: MockRoadExecution): HandoverProgress {
  const routeLeg = findRouteLeg(state, execution.routeLegId);
  if (!routeLeg.isFinalLeg) {
    return {
      completedHandovers: 0,
      requiredHandovers: 0,
      routeLegStatus: getPreviewRouteLegStatus(routeLeg.id, routeLeg.status),
      orderStatus: getPreviewOrderStatus(execution.orderId),
    };
  }
  const vehicles = state.executions.filter((candidate) => candidate.routeLegId === routeLeg.id);
  return {
    completedHandovers: vehicles.filter((candidate) => Boolean(candidate.proofOfDelivery)).length,
    requiredHandovers: vehicles.length,
    routeLegStatus: getPreviewRouteLegStatus(routeLeg.id, routeLeg.status),
    orderStatus: getPreviewOrderStatus(execution.orderId),
  };
}

function roadProofAvailable(state: MockState, execution: MockRoadExecution) {
  const routeLeg = findRouteLeg(state, execution.routeLegId);
  return routeLeg.isFinalLeg
    && getPreviewRouteLegStatus(routeLeg.id, routeLeg.status) === "IN_PROGRESS"
    && getPreviewOrderStatus(execution.orderId) === "IN_PROGRESS"
    && execution.status === "COMPLETED"
    && Boolean(execution.finalWelfareEvidence)
    && !execution.proofOfDelivery;
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
    roadLegVehicleId: execution.roadLegVehicleId,
    orderId: execution.orderId,
    orderCode: execution.orderCode,
    routeLegId: routeLeg.id,
    routeLegSequenceNo: routeLeg.sequenceNo,
    routeLegStatus: getPreviewRouteLegStatus(routeLeg.id, routeLeg.status),
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
    proofOfDeliveryRecorded: Boolean(execution.proofOfDelivery),
    proofOfDeliveryAvailable: roadProofAvailable(state, execution),
    handoverProgress: handoverProgress(state, execution),
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
    proofOfDelivery: currentProof(state, execution),
    availableActions: {
      checkpointWelfareIds: checkpoints
        .filter((checkpoint) => checkpoint.arrivedAt && !checkpoint.welfareEvidence)
        .map((checkpoint) => checkpoint.id),
      finalWelfare: Boolean(execution.destinationArrivedAt && !execution.finalWelfareEvidence),
      proofOfDelivery: roadProofAvailable(state, execution),
    },
    lastUpdatedAt: execution.lastUpdatedAt,
  };
}

function validateInput(input: RecordRoadWelfareInput) {
  if (!input.photo || !input.photo.type.startsWith("image/")) {
    throw new EscortExecutionError("Choose a welfare photo before saving.", "VALIDATION_ERROR");
  }
  if (!input.note.trim()) {
    throw new EscortExecutionError("Enter a welfare note before saving.", "VALIDATION_ERROR");
  }
}

function validateProofInput(input: ProofOfDeliveryInput) {
  const recipientName = input.recipientName.trim();
  if (!recipientName) {
    throw new EscortExecutionError("Enter the recipient name before confirming handover.", "VALIDATION_ERROR");
  }
  if (recipientName.length > 150) {
    throw new EscortExecutionError("Recipient name must be 150 characters or fewer.", "VALIDATION_ERROR");
  }
}

function currentProof(state: MockState, execution: MockRoadExecution) {
  if (!execution.proofOfDelivery) return null;
  const progress = handoverProgress(state, execution);
  return { ...clone(execution.proofOfDelivery), ...progress };
}

export const mockEscortExecutionService: RoadEscortExecutionService = {
  async listAssignedRoadWork() {
    await pause();
    maybeThrowScenarioFailure();
    if (scenario() === "empty") return { executions: [] };
    const state = readState();
    const escort = selectedEscort();
    return {
      executions: state.executions
        .filter((execution) => execution.assignedEscortId === escort.id)
        .map((execution) => summary(state, execution))
        .filter((execution) => execution.routeLegStatus !== "PLANNED"
          && (execution.status !== "COMPLETED"
            || (execution.isFinalLeg && execution.handoverProgress.orderStatus !== "DELIVERED")))
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
    const now = new Date().toISOString();
    const preparedPhoto = await preparePreviewImage(input.photo, { proof: false });
    commitPreviewMutation("road", initialState, (state, progression) => {
      const execution = findAssignedExecution(state, executionId);
      const routeLeg = findRouteLeg(state, execution.routeLegId);

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
          photoUrl: preparedPhoto.photoUrl,
          photoName: preparedPhoto.photoName,
          photoIsPreview: preparedPhoto.photoIsPreview,
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
          photoUrl: preparedPhoto.photoUrl,
          photoName: preparedPhoto.photoName,
          photoIsPreview: preparedPhoto.photoIsPreview,
          note: input.note.trim(),
          recordedAt: now,
        };
        execution.status = "COMPLETED";
      }

      execution.lastUpdatedAt = now;
      if (input.eventType === "FINAL_DESTINATION" && !routeLeg.isFinalLeg) {
        const everyVehicleCompleted = state.executions
          .filter((candidate) => candidate.routeLegId === routeLeg.id)
          .every((candidate) => candidate.status === "COMPLETED");
        if (everyVehicleCompleted) {
          completePreviewRouteLeg(progression, routeLeg.id);
          routeLeg.status = "COMPLETED";
        }
      }
    });
    if (scenario() === "stale") {
      throw new EscortExecutionError("The execution changed while you were saving. The persisted state was refreshed.", "STALE_STATE");
    }
  },

  async recordRoadProofOfDelivery(roadLegVehicleId: string, input: ProofOfDeliveryInput) {
    await pause();
    maybeThrowScenarioFailure();
    const before = readState();
    const existingExecution = findAssignedRoadVehicle(before, roadLegVehicleId);
    const existingProof = currentProof(before, existingExecution);
    if (existingProof) return existingProof;

    validateProofInput(input);
    const preparedPhoto = await preparePreviewImage(input.photo, { proof: true });
    const refreshed = readState();
    const refreshedExecution = findAssignedRoadVehicle(refreshed, roadLegVehicleId);
    const refreshedProof = currentProof(refreshed, refreshedExecution);
    if (refreshedProof) return refreshedProof;

    const proofPhotoUrl = `${preparedPhoto.photoUrl}#proof-of-delivery-${encodeURIComponent(roadLegVehicleId)}`;
    const timestamp = new Date().toISOString();
    let persisted!: ProofOfDelivery;

    commitPreviewMutation("road", initialState, (state, progression) => {
      const execution = findAssignedRoadVehicle(state, roadLegVehicleId);
      const routeLeg = findRouteLeg(state, execution.routeLegId);
      if (execution.proofOfDelivery) {
        persisted = clone(execution.proofOfDelivery);
        return;
      }
      if (!routeLeg.isFinalLeg || routeLeg.status !== "IN_PROGRESS") {
        throw new EscortExecutionError("Proof of Delivery is available only for the active final ROAD RouteLeg.", "VALIDATION_ERROR");
      }
      if (execution.status !== "COMPLETED" || !execution.finalWelfareEvidence) {
        throw new EscortExecutionError("ROAD handover requires destination arrival and persisted final welfare.", "VALIDATION_ERROR");
      }
      if (proofPhotoUrl === execution.finalWelfareEvidence.photoUrl) {
        throw new EscortExecutionError("Proof photo must be separate from the final welfare photo.", "VALIDATION_ERROR");
      }

      const vehicles = state.executions.filter((candidate) => candidate.routeLegId === routeLeg.id);
      execution.proofOfDelivery = {
        id: `pod-${execution.id}`,
        mode: "ROAD",
        roadLegVehicleId: execution.roadLegVehicleId,
        roadVehicleExecutionId: execution.id,
        routeLegId: routeLeg.id,
        transportedOrderHorseIds: execution.horses.map((horse) => horse.id),
        recipientName: input.recipientName.trim(),
        proofPhotoUrl,
        proofPhotoName: preparedPhoto.photoName,
        proofPhotoIsPreview: preparedPhoto.photoIsPreview,
        handoverNote: input.note?.trim() || null,
        confirmedByEscortId: execution.assignedEscortId,
        deliveredAt: timestamp,
        completedHandovers: 0,
        requiredHandovers: vehicles.length,
        routeLegStatus: "IN_PROGRESS",
        orderStatus: "IN_PROGRESS",
      };
      execution.lastUpdatedAt = timestamp;

      const ready = vehicles.every((candidate) => (
        candidate.status === "COMPLETED"
        && Boolean(candidate.finalWelfareEvidence)
        && Boolean(candidate.proofOfDelivery)
      ));
      if (ready) {
        completeFinalPreviewRouteLeg(progression, routeLeg.id);
        routeLeg.status = "COMPLETED";
      }

      const completedHandovers = vehicles.filter((candidate) => Boolean(candidate.proofOfDelivery)).length;
      const progressionLeg = progression.routeLegs.find((candidate) => candidate.id === routeLeg.id);
      const progressionOrder = progression.orders.find((candidate) => candidate.id === execution.orderId);
      if (!progressionLeg || !progressionOrder) {
        throw new EscortExecutionError("Delivery progression could not be reconciled.", "STALE_STATE");
      }
      for (const vehicle of vehicles) {
        if (!vehicle.proofOfDelivery) continue;
        vehicle.proofOfDelivery.completedHandovers = completedHandovers;
        vehicle.proofOfDelivery.requiredHandovers = vehicles.length;
        vehicle.proofOfDelivery.routeLegStatus = progressionLeg.status;
        vehicle.proofOfDelivery.orderStatus = progressionOrder.status;
      }
      persisted = clone(execution.proofOfDelivery);
    });

    if (scenario() === "stale" || scenario() === "pod-stale") {
      throw new EscortExecutionError("The ROAD handover changed while saving. Read back the persisted proof before continuing.", "STALE_STATE");
    }
    return persisted;
  },
};
