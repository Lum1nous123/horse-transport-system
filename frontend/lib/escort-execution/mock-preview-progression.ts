import {
  EscortExecutionError,
  type DeliveryOrderStatus,
  type RouteLegStatus,
} from "./types";

const UNIFIED_STORAGE_KEY = "horse-transport-escort-preview-v2";
const LEGACY_PROGRESSION_STORAGE_KEY = "horse-transport-escort-route-progression-preview-v1";
const LEGACY_ROAD_STORAGE_KEY = "horse-transport-escort-road-preview-v1";
const LEGACY_AIR_STORAGE_KEY = "horse-transport-escort-air-preview-v1";

type PreviewLegMode = "ROAD" | "AIR";
type PreviewSlice = "road" | "air";

export type PreviewRouteLeg = {
  id: string;
  orderId: string;
  sequenceNo: number;
  mode: PreviewLegMode;
  isFinalLeg: boolean;
  status: RouteLegStatus;
};

export type PreviewProgressionState = {
  routeLegs: PreviewRouteLeg[];
  orders: Array<{ id: string; status: DeliveryOrderStatus }>;
};

type PreviewSnapshot = {
  version: 2;
  progression: PreviewProgressionState;
  road?: unknown;
  air?: unknown;
};

type ExpectedPreviewExecution = {
  id: string;
  routeLegId: string;
  roadLegVehicleId?: string;
};

// This immutable fixture roster is the preview equivalent of the Backend's
// assigned execution rows. Persisted execution arrays are mutable state and
// therefore must never redefine which final Vehicles/legs are mandatory.
const expectedExecutionRoster: Record<PreviewSlice, ExpectedPreviewExecution[]> = {
  road: [
    { id: "road-execution-2074-a", routeLegId: "leg-2074-1", roadLegVehicleId: "road-vehicle-2074-a" },
    { id: "road-execution-2108-final", routeLegId: "leg-2108-3", roadLegVehicleId: "road-vehicle-2108-final" },
    { id: "road-execution-2108-final-b", routeLegId: "leg-2108-3", roadLegVehicleId: "road-vehicle-2108-final-b" },
    { id: "road-execution-2074-b", routeLegId: "leg-2074-1", roadLegVehicleId: "road-vehicle-2074-b" },
    { id: "road-execution-after-air", routeLegId: "road-leg-3007-2", roadLegVehicleId: "road-vehicle-3007" },
    { id: "road-execution-to-air", routeLegId: "road-leg-3008-1", roadLegVehicleId: "road-vehicle-3008-a" },
    { id: "road-execution-to-air-b", routeLegId: "road-leg-3008-1", roadLegVehicleId: "road-vehicle-3008-b" },
  ],
  air: [
    { id: "air-execution-upcoming", routeLegId: "air-leg-3001-2" },
    { id: "air-execution-ready", routeLegId: "air-leg-3002-1" },
    { id: "air-execution-in-progress", routeLegId: "air-leg-3003-2" },
    { id: "air-execution-destination", routeLegId: "air-leg-3004-2" },
    { id: "air-execution-welfare", routeLegId: "air-leg-3005-3" },
    { id: "air-execution-final", routeLegId: "air-leg-3006-final" },
    { id: "air-execution-next", routeLegId: "air-leg-3005-4" },
    { id: "air-execution-foreign", routeLegId: "air-leg-foreign" },
    { id: "air-execution-to-road", routeLegId: "air-leg-3007-1" },
    { id: "air-execution-after-road", routeLegId: "air-leg-3007-3" },
    { id: "air-execution-road-next", routeLegId: "air-leg-3008-2" },
  ],
};

const preFe16RoadExecutionIds = expectedExecutionRoster.road
  .filter((execution) => execution.id !== "road-execution-2108-final-b")
  .map((execution) => execution.id);

const addedFinalRoadExecution = {
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
};

const initialProgression: PreviewProgressionState = {
  routeLegs: [
    { id: "leg-2074-1", orderId: "order-2074", sequenceNo: 1, mode: "ROAD", isFinalLeg: false, status: "IN_PROGRESS" },
    { id: "leg-2108-3", orderId: "order-2108", sequenceNo: 3, mode: "ROAD", isFinalLeg: true, status: "IN_PROGRESS" },
    { id: "air-leg-3001-2", orderId: "order-3001", sequenceNo: 2, mode: "AIR", isFinalLeg: false, status: "PLANNED" },
    { id: "air-leg-3002-1", orderId: "order-3002", sequenceNo: 1, mode: "AIR", isFinalLeg: false, status: "READY" },
    { id: "air-leg-3003-2", orderId: "order-3003", sequenceNo: 2, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
    { id: "air-leg-3004-2", orderId: "order-3004", sequenceNo: 2, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
    { id: "air-leg-3005-3", orderId: "order-3005", sequenceNo: 3, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
    { id: "air-leg-3005-4", orderId: "order-3005", sequenceNo: 4, mode: "AIR", isFinalLeg: true, status: "PLANNED" },
    { id: "air-leg-3006-final", orderId: "order-3006", sequenceNo: 3, mode: "AIR", isFinalLeg: true, status: "IN_PROGRESS" },
    { id: "air-leg-foreign", orderId: "order-foreign", sequenceNo: 1, mode: "AIR", isFinalLeg: false, status: "READY" },
    { id: "air-leg-3007-1", orderId: "order-3007", sequenceNo: 1, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
    { id: "road-leg-3007-2", orderId: "order-3007", sequenceNo: 2, mode: "ROAD", isFinalLeg: false, status: "PLANNED" },
    { id: "air-leg-3007-3", orderId: "order-3007", sequenceNo: 3, mode: "AIR", isFinalLeg: true, status: "PLANNED" },
    { id: "road-leg-3008-1", orderId: "order-3008", sequenceNo: 1, mode: "ROAD", isFinalLeg: false, status: "IN_PROGRESS" },
    { id: "air-leg-3008-2", orderId: "order-3008", sequenceNo: 2, mode: "AIR", isFinalLeg: true, status: "PLANNED" },
  ],
  orders: [
    "order-2074",
    "order-2108",
    "order-3001",
    "order-3002",
    "order-3003",
    "order-3004",
    "order-3005",
    "order-3006",
    "order-3007",
    "order-3008",
    "order-foreign",
  ].map((id) => ({ id, status: "IN_PROGRESS" })),
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function hasUniqueStrings(values: unknown[]) {
  return values.every(isString) && new Set(values).size === values.length;
}

function validWelfare(value: unknown) {
  return value === null || (isRecord(value)
    && isString(value.id)
    && (value.eventType === "CHECKPOINT" || value.eventType === "FINAL_DESTINATION")
    && isNullableString(value.checkpointId)
    && isString(value.photoUrl)
    && isString(value.photoName)
    && (value.photoIsPreview === undefined || typeof value.photoIsPreview === "boolean")
    && isString(value.note)
    && isString(value.recordedAt));
}

function validProof(value: unknown) {
  return value === null || (isRecord(value)
    && isString(value.id)
    && (value.mode === "ROAD" || value.mode === "AIR")
    && isString(value.routeLegId)
    && Array.isArray(value.transportedOrderHorseIds)
    && hasUniqueStrings(value.transportedOrderHorseIds)
    && isString(value.recipientName)
    && isString(value.proofPhotoUrl)
    && isString(value.proofPhotoName)
    && (value.proofPhotoIsPreview === undefined || typeof value.proofPhotoIsPreview === "boolean")
    && isNullableString(value.handoverNote)
    && isString(value.confirmedByEscortId)
    && isString(value.deliveredAt)
    && Number.isInteger(value.completedHandovers)
    && Number.isInteger(value.requiredHandovers)
    && ["PLANNED", "READY", "IN_PROGRESS", "COMPLETED"].includes(String(value.routeLegStatus))
    && (value.orderStatus === "IN_PROGRESS" || value.orderStatus === "DELIVERED"));
}

function isExactPreFe16UnifiedRoadSnapshot(snapshot: PreviewSnapshot) {
  if (Array.isArray(snapshot.progression.orders)
      || !isRecord(snapshot.road)
      || !Array.isArray(snapshot.road.executions)) return false;
  const executions = snapshot.road.executions;
  const executionIds = executions.map((execution) => isRecord(execution) ? execution.id : undefined);
  const finalLeg = snapshot.progression.routeLegs.find((routeLeg) => routeLeg.id === "leg-2108-3");
  return executions.length === preFe16RoadExecutionIds.length
    && hasUniqueStrings(executionIds)
    && preFe16RoadExecutionIds.every((executionId) => executionIds.includes(executionId))
    && executions.every((execution) => isRecord(execution)
      && !Object.hasOwn(execution, "roadLegVehicleId")
      && !Object.hasOwn(execution, "proofOfDelivery"))
    && finalLeg?.status === "IN_PROGRESS";
}

function migrateLegacySnapshot(snapshot: PreviewSnapshot, allowKnownSixExecutionRoadUpgrade: boolean) {
  if (isRecord(snapshot.road) && Array.isArray(snapshot.road.executions)) {
    if (allowKnownSixExecutionRoadUpgrade) {
      snapshot.road.executions.push(clone(addedFinalRoadExecution));
    }
    snapshot.road.executions = snapshot.road.executions.map((candidate) => {
      if (!isRecord(candidate)) return candidate;
      const expected = expectedExecutionRoster.road.find((execution) => execution.id === candidate.id);
      return {
        ...candidate,
        roadLegVehicleId: candidate.roadLegVehicleId === undefined && isString(candidate.id)
          ? expected?.roadLegVehicleId ?? `legacy-road-vehicle-${candidate.id}`
          : candidate.roadLegVehicleId,
        proofOfDelivery: candidate.proofOfDelivery ?? null,
      };
    });
  }
  if (isRecord(snapshot.air) && Array.isArray(snapshot.air.executions)) {
    snapshot.air.executions = snapshot.air.executions.map((candidate) => (
      isRecord(candidate) ? { ...candidate, proofOfDelivery: candidate.proofOfDelivery ?? null } : candidate
    ));
  }
}

function parseStoredValue(key: string): unknown {
  const saved = window.sessionStorage.getItem(key);
  return saved ? JSON.parse(saved) as unknown : undefined;
}

function isProgressionState(value: unknown): value is PreviewProgressionState {
  if (!isRecord(value) || !Array.isArray(value.routeLegs)) return false;
  const routeLegsAreValid = value.routeLegs.every((candidate) => (
    isRecord(candidate)
    && typeof candidate.id === "string"
    && typeof candidate.orderId === "string"
    && typeof candidate.sequenceNo === "number"
    && (candidate.mode === "ROAD" || candidate.mode === "AIR")
    && typeof candidate.isFinalLeg === "boolean"
    && ["PLANNED", "READY", "IN_PROGRESS", "COMPLETED"].includes(String(candidate.status))
  ));
  const ordersAreValid = value.orders === undefined || (
    Array.isArray(value.orders)
    && value.orders.every((candidate) => (
      isRecord(candidate)
      && typeof candidate.id === "string"
      && (candidate.status === "IN_PROGRESS" || candidate.status === "DELIVERED")
    ))
  );
  return routeLegsAreValid && ordersAreValid;
}

function ensureProgressionOrders(progression: PreviewProgressionState) {
  if (!Array.isArray(progression.orders)) {
    progression.orders = [...new Set(progression.routeLegs.map((routeLeg) => routeLeg.orderId))]
      .map((id) => ({ id, status: "IN_PROGRESS" as const }));
  }
}

function legacySliceKey(slice: PreviewSlice) {
  return slice === "road" ? LEGACY_ROAD_STORAGE_KEY : LEGACY_AIR_STORAGE_KEY;
}

function readSnapshot(): PreviewSnapshot {
  try {
    const unified = parseStoredValue(UNIFIED_STORAGE_KEY);
    if (unified !== undefined) {
      if (!isRecord(unified) || unified.version !== 2 || !isProgressionState(unified.progression)) {
        throw new Error("Invalid unified preview snapshot");
      }
      const snapshot = clone(unified as PreviewSnapshot);
      const preFe16RoadSnapshot = isExactPreFe16UnifiedRoadSnapshot(snapshot);
      if (!Array.isArray(snapshot.progression.orders) && !preFe16RoadSnapshot) {
        throw new Error("Ambiguous unified preview snapshot without current Order metadata");
      }
      if (preFe16RoadSnapshot) migrateLegacySnapshot(snapshot, true);
      ensureProgressionOrders(snapshot.progression);
      return snapshot;
    }

    const legacyProgression = parseStoredValue(LEGACY_PROGRESSION_STORAGE_KEY);
    const progression = legacyProgression === undefined ? clone(initialProgression) : legacyProgression;
    if (!isProgressionState(progression)) throw new Error("Invalid legacy preview progression");

    const snapshot: PreviewSnapshot = {
      version: 2,
      progression: clone(progression),
      road: parseStoredValue(LEGACY_ROAD_STORAGE_KEY),
      air: parseStoredValue(LEGACY_AIR_STORAGE_KEY),
    };
    const preFe16RoadSnapshot = isExactPreFe16UnifiedRoadSnapshot(snapshot);
    if (isRecord(snapshot.road) && Array.isArray(snapshot.road.executions)
        && snapshot.road.executions.length === preFe16RoadExecutionIds.length
        && !preFe16RoadSnapshot) {
      throw new Error("Ambiguous legacy ROAD preview snapshot");
    }
    migrateLegacySnapshot(snapshot, preFe16RoadSnapshot);
    ensureProgressionOrders(snapshot.progression);
    return snapshot;
  } catch {
    throw new EscortExecutionError("We couldn't read the saved Escort preview state.", "REQUEST_FAILED");
  }
}

function stateFromSnapshot<T>(snapshot: PreviewSnapshot, slice: PreviewSlice, initialState: T): T {
  const stored = snapshot[slice];
  const state = stored === undefined ? clone(initialState) : clone(stored as T);
  if (stored === undefined && slice === "air" && isRecord(state) && Array.isArray(state.executions)) {
    return {
      ...state,
      executions: state.executions.map((execution) => (
        isRecord(execution) && !Object.hasOwn(execution, "proofOfDelivery")
          ? { ...execution, proofOfDelivery: null }
          : execution
      )),
    } as T;
  }
  return state;
}

function writeSnapshot(snapshot: PreviewSnapshot) {
  try {
    window.sessionStorage.setItem(UNIFIED_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    throw new EscortExecutionError(
      "The Escort preview state could not be saved in this browser session. Choose a smaller photo or clear the preview state and try again.",
      "REQUEST_FAILED",
    );
  }
}

function requireUniqueRecords(records: unknown[], idKey: string, message: string) {
  if (!records.every(isRecord)) throw new EscortExecutionError(message, "REQUEST_FAILED");
  const ids = records.map((record) => record[idKey]);
  if (!hasUniqueStrings(ids)) throw new EscortExecutionError(message, "REQUEST_FAILED");
  return records as Record<string, unknown>[];
}

function roadExecutionIsValid(execution: Record<string, unknown>) {
  const horsesValid = Array.isArray(execution.horses)
    && execution.horses.every((horse) => isRecord(horse)
      && isString(horse.id) && isString(horse.name) && isString(horse.microchipId))
    && hasUniqueStrings(execution.horses.map((horse) => (horse as Record<string, unknown>).id));
  const welfareValid = isRecord(execution.checkpointWelfare)
    && Object.values(execution.checkpointWelfare).every(validWelfare);
  return isString(execution.id)
    && isString(execution.roadLegVehicleId)
    && isString(execution.orderId)
    && isString(execution.orderCode)
    && isString(execution.routeLegId)
    && isString(execution.assignedEscortId)
    && isString(execution.assignedEscortName)
    && isString(execution.driverName)
    && isString(execution.vehiclePlateNumber)
    && isString(execution.vehicleName)
    && horsesValid
    && ["NOT_STARTED", "IN_PROGRESS", "DESTINATION", "COMPLETED"].includes(String(execution.status))
    && isRecord(execution.checkpointArrivals)
    && Object.values(execution.checkpointArrivals).every(isString)
    && welfareValid
    && isNullableString(execution.destinationArrivedAt)
    && validWelfare(execution.finalWelfareEvidence)
    && validProof(execution.proofOfDelivery)
    && isString(execution.lastUpdatedAt);
}

function airExecutionIsValid(execution: Record<string, unknown>) {
  return isString(execution.id)
    && isString(execution.routeLegId)
    && isString(execution.assignedEscortId)
    && isString(execution.assignedEscortName)
    && ["NOT_STARTED", "IN_PROGRESS", "DESTINATION", "COMPLETED"].includes(String(execution.status))
    && isNullableString(execution.startedAt)
    && isNullableString(execution.destinationArrivedAt)
    && isNullableString(execution.completedAt)
    && validWelfare(execution.welfareEvidence)
    && validProof(execution.proofOfDelivery)
    && isString(execution.lastUpdatedAt);
}

function sliceExecutions(snapshot: PreviewSnapshot, slice: PreviewSlice) {
  const value = snapshot[slice];
  if (value === undefined) return null;
  if (!isRecord(value) || !Array.isArray(value.executions) || !Array.isArray(value.routeLegs)) {
    throw new EscortExecutionError("The saved Escort preview execution state is invalid.", "REQUEST_FAILED");
  }
  const executions = requireUniqueRecords(
    value.executions,
    "id",
    `The saved ${slice.toUpperCase()} preview executions are invalid or duplicated.`,
  );
  const routeLegs = requireUniqueRecords(
    value.routeLegs,
    "id",
    `The saved ${slice.toUpperCase()} preview RouteLegs are invalid or duplicated.`,
  );
  const validator = slice === "road" ? roadExecutionIsValid : airExecutionIsValid;
  if (!executions.every(validator)) {
    throw new EscortExecutionError(`The saved ${slice.toUpperCase()} preview execution shape is invalid.`, "REQUEST_FAILED");
  }
  if (slice === "road") {
    const vehicleIds = executions.map((execution) => execution.roadLegVehicleId);
    if (!hasUniqueStrings(vehicleIds)) {
      throw new EscortExecutionError("The saved ROAD Vehicle assignments are duplicated.", "REQUEST_FAILED");
    }
  } else if (!hasUniqueStrings(executions.map((execution) => execution.routeLegId))) {
    throw new EscortExecutionError("The saved AIR preview has more than one execution for a RouteLeg.", "REQUEST_FAILED");
  }
  return { executions, routeLegs };
}

function validateExpectedExecutionMembership(
  snapshot: PreviewSnapshot,
  slice: PreviewSlice,
  state: ReturnType<typeof sliceExecutions>,
) {
  if (!state) {
    const completedFinalLeg = snapshot.progression.routeLegs.some((routeLeg) => (
      routeLeg.mode === slice.toUpperCase()
      && routeLeg.isFinalLeg
      && routeLeg.status === "COMPLETED"
    ));
    if (completedFinalLeg) {
      throw new EscortExecutionError(
        `The saved ${slice.toUpperCase()} final execution roster is missing.`,
        "REQUEST_FAILED",
      );
    }
    return;
  }

  const expected = expectedExecutionRoster[slice];
  if (state.executions.length !== expected.length) {
    throw new EscortExecutionError(
      `The saved ${slice.toUpperCase()} execution roster is incomplete or contains unexpected records.`,
      "REQUEST_FAILED",
    );
  }
  for (const expectedExecution of expected) {
    const actual = state.executions.find((execution) => execution.id === expectedExecution.id);
    if (!actual
        || actual.routeLegId !== expectedExecution.routeLegId
        || (slice === "road" && actual.roadLegVehicleId !== expectedExecution.roadLegVehicleId)) {
      throw new EscortExecutionError(
        `The saved ${slice.toUpperCase()} execution roster does not match the authoritative preview assignments.`,
        "REQUEST_FAILED",
      );
    }
  }
}

function validateSnapshotConsistency(snapshot: PreviewSnapshot) {
  const road = sliceExecutions(snapshot, "road");
  const air = sliceExecutions(snapshot, "air");
  validateExpectedExecutionMembership(snapshot, "road", road);
  validateExpectedExecutionMembership(snapshot, "air", air);
  const roadExecutions = road?.executions ?? null;
  const airExecutions = air?.executions ?? null;

  if (!hasUniqueStrings(snapshot.progression.routeLegs.map((routeLeg) => routeLeg.id))) {
    throw new EscortExecutionError("The saved Escort preview RouteLeg IDs are duplicated.", "REQUEST_FAILED");
  }
  if (!hasUniqueStrings(snapshot.progression.orders.map((order) => order.id))) {
    throw new EscortExecutionError("The saved Escort preview Order IDs are duplicated.", "REQUEST_FAILED");
  }
  const orderIds = new Set(snapshot.progression.routeLegs.map((routeLeg) => routeLeg.orderId));
  const storedOrderIds = new Set(snapshot.progression.orders.map((order) => order.id));
  if (storedOrderIds.size !== orderIds.size
      || [...storedOrderIds].some((orderId) => !orderIds.has(orderId))) {
    throw new EscortExecutionError("The saved Escort preview order state is invalid.", "REQUEST_FAILED");
  }

  const progressionByLeg = new Map(snapshot.progression.routeLegs.map((routeLeg) => [routeLeg.id, routeLeg]));
  for (const [slice, state] of [["ROAD", road], ["AIR", air]] as const) {
    if (!state) continue;
    for (const routeLeg of state.routeLegs) {
      const progressionLeg = progressionByLeg.get(String(routeLeg.id));
      if (!progressionLeg
          || progressionLeg.mode !== slice
          || progressionLeg.sequenceNo !== routeLeg.sequenceNo
          || progressionLeg.isFinalLeg !== routeLeg.isFinalLeg
          || (slice === "AIR" && progressionLeg.orderId !== routeLeg.orderId)) {
        throw new EscortExecutionError(`The saved ${slice} RouteLeg references are inconsistent.`, "REQUEST_FAILED");
      }
    }
    for (const execution of state.executions) {
      const progressionLeg = progressionByLeg.get(String(execution.routeLegId));
      const sliceLeg = state.routeLegs.find((routeLeg) => routeLeg.id === execution.routeLegId);
      if (!progressionLeg || !sliceLeg || progressionLeg.mode !== slice
          || (slice === "ROAD" && execution.orderId !== progressionLeg.orderId)) {
        throw new EscortExecutionError(`The saved ${slice} execution relationships are invalid.`, "REQUEST_FAILED");
      }
      if (slice === "ROAD") {
        const checkpoints = Array.isArray(sliceLeg.checkpoints) ? sliceLeg.checkpoints : [];
        if (!checkpoints.every(isRecord)
            || !hasUniqueStrings(checkpoints.map((checkpoint) => checkpoint.id))) {
          throw new EscortExecutionError("The saved ROAD checkpoint definitions are invalid.", "REQUEST_FAILED");
        }
        const checkpointIds = new Set(checkpoints.map((checkpoint) => checkpoint.id));
        const arrivals = execution.checkpointArrivals as Record<string, unknown>;
        const welfare = execution.checkpointWelfare as Record<string, unknown>;
        if ([...Object.keys(arrivals), ...Object.keys(welfare)].some((checkpointId) => !checkpointIds.has(checkpointId))
            || Object.entries(welfare).some(([checkpointId, evidence]) => !isRecord(evidence)
              || evidence.eventType !== "CHECKPOINT" || evidence.checkpointId !== checkpointId)
            || (isRecord(execution.finalWelfareEvidence)
              && (execution.finalWelfareEvidence.eventType !== "FINAL_DESTINATION"
                || execution.finalWelfareEvidence.checkpointId !== null))) {
          throw new EscortExecutionError("The saved ROAD welfare ownership is invalid.", "REQUEST_FAILED");
        }
      } else if (isRecord(execution.welfareEvidence)
          && (execution.welfareEvidence.eventType !== "FINAL_DESTINATION"
            || execution.welfareEvidence.checkpointId !== null)) {
        throw new EscortExecutionError("The saved AIR welfare ownership is invalid.", "REQUEST_FAILED");
      }
    }
  }

  if (roadExecutions) {
    for (const routeLegId of new Set(roadExecutions.map((execution) => execution.routeLegId))) {
      const horseIds = roadExecutions
        .filter((execution) => execution.routeLegId === routeLegId)
        .flatMap((execution) => (execution.horses as Record<string, unknown>[]).map((horse) => horse.id));
      if (!hasUniqueStrings(horseIds)) {
        throw new EscortExecutionError("The saved ROAD Horse allocation is duplicated across Vehicles.", "REQUEST_FAILED");
      }
    }
  }

  for (const routeLeg of snapshot.progression.routeLegs) {
    const executions = (routeLeg.mode === "ROAD" ? roadExecutions : airExecutions)
      ?.filter((execution) => execution.routeLegId === routeLeg.id);
    if (!executions?.length) continue;

    const statuses = executions.map((execution) => execution.status);
    if (routeLeg.mode === "AIR") {
      const status = statuses[0];
      const proofRecorded = Boolean(executions[0]?.proofOfDelivery);
      const consistent = status === "NOT_STARTED"
        ? routeLeg.status === "PLANNED" || routeLeg.status === "READY"
        : status === "IN_PROGRESS" || status === "DESTINATION"
          ? routeLeg.status === "IN_PROGRESS"
          : status === "COMPLETED"
            ? routeLeg.status === "COMPLETED" && (!routeLeg.isFinalLeg || proofRecorded)
            : false;
      if (!consistent) {
        throw new EscortExecutionError("The saved AIR preview state conflicts with RouteLeg progression.", "REQUEST_FAILED");
      }
      continue;
    }

    const everyVehicleCompleted = statuses.every((status) => status === "COMPLETED");
    const everyVehicleHasProof = executions.every((execution) => Boolean(execution.proofOfDelivery));
    const anyVehicleActive = statuses.some((status) => status === "IN_PROGRESS" || status === "DESTINATION" || status === "COMPLETED");
    const consistent = routeLeg.status === "COMPLETED"
      ? everyVehicleCompleted && (!routeLeg.isFinalLeg || everyVehicleHasProof)
      : routeLeg.status === "IN_PROGRESS"
        ? anyVehicleActive
        : !anyVehicleActive;
    if (!consistent) {
      throw new EscortExecutionError("The saved ROAD preview state conflicts with RouteLeg progression.", "REQUEST_FAILED");
    }
  }

  const proofIds: string[] = [];
  if (roadExecutions) {
    for (const execution of roadExecutions) {
      const proof = execution.proofOfDelivery;
      if (!isRecord(proof)) continue;
      proofIds.push(String(proof.id));
      const vehicles = roadExecutions.filter((candidate) => candidate.routeLegId === execution.routeLegId);
      const progressionLeg = progressionByLeg.get(String(execution.routeLegId));
      const progressionOrder = snapshot.progression.orders.find((order) => order.id === execution.orderId);
      const completed = vehicles.filter((candidate) => isRecord(candidate.proofOfDelivery)).length;
      const horseIds = (execution.horses as Record<string, unknown>[]).map((horse) => horse.id);
      if (proof.mode !== "ROAD"
          || proof.roadLegVehicleId !== execution.roadLegVehicleId
          || proof.roadVehicleExecutionId !== execution.id
          || proof.routeLegId !== execution.routeLegId
          || proof.confirmedByEscortId !== execution.assignedEscortId
          || JSON.stringify(proof.transportedOrderHorseIds) !== JSON.stringify(horseIds)
          || proof.completedHandovers !== completed
          || proof.requiredHandovers !== vehicles.length
          || proof.routeLegStatus !== progressionLeg?.status
          || proof.orderStatus !== progressionOrder?.status
          || execution.status !== "COMPLETED"
          || !execution.finalWelfareEvidence
          || !progressionLeg?.isFinalLeg) {
        throw new EscortExecutionError("The saved ROAD Proof of Delivery ownership or progress is invalid.", "REQUEST_FAILED");
      }
    }
  }
  if (airExecutions) {
    for (const execution of airExecutions) {
      const proof = execution.proofOfDelivery;
      if (!isRecord(proof)) continue;
      proofIds.push(String(proof.id));
      const progressionLeg = progressionByLeg.get(String(execution.routeLegId));
      const progressionOrder = snapshot.progression.orders.find((order) => order.id === progressionLeg?.orderId);
      if (proof.mode !== "AIR"
          || proof.airLegExecutionId !== execution.id
          || proof.routeLegId !== execution.routeLegId
          || proof.confirmedByEscortId !== execution.assignedEscortId
          || proof.completedHandovers !== 1
          || proof.requiredHandovers !== 1
          || proof.routeLegStatus !== progressionLeg?.status
          || proof.orderStatus !== progressionOrder?.status
          || execution.status !== "COMPLETED"
          || !execution.welfareEvidence
          || !progressionLeg?.isFinalLeg) {
        throw new EscortExecutionError("The saved AIR Proof of Delivery ownership or progress is invalid.", "REQUEST_FAILED");
      }
    }
  }
  if (!hasUniqueStrings(proofIds)) {
    throw new EscortExecutionError("The saved Proof of Delivery IDs are duplicated.", "REQUEST_FAILED");
  }

  for (const order of snapshot.progression.orders) {
    const legs = orderedLegs(snapshot.progression, order.id);
    const finalLeg = legs.at(-1);
    const delivered = Boolean(finalLeg?.isFinalLeg) && legs.every((routeLeg) => routeLeg.status === "COMPLETED");
    if ((order.status === "DELIVERED") !== delivered) {
      throw new EscortExecutionError("The saved delivery state conflicts with RouteLeg progression.", "REQUEST_FAILED");
    }
  }
}

export function readPreviewSlice<T>(slice: PreviewSlice, initialState: T): T {
  const snapshot = readSnapshot();
  if (snapshot[slice] === undefined) {
    try {
      snapshot[slice] = parseStoredValue(legacySliceKey(slice));
    } catch {
      throw new EscortExecutionError("We couldn't read the saved Escort preview state.", "REQUEST_FAILED");
    }
  }
  validateSnapshotConsistency(snapshot);
  return stateFromSnapshot(snapshot, slice, initialState);
}

export function commitPreviewMutation<T>(
  slice: PreviewSlice,
  initialState: T,
  transition: (state: T, progression: PreviewProgressionState) => void,
) {
  const snapshot = readSnapshot();
  validateSnapshotConsistency(snapshot);
  const nextSnapshot = clone(snapshot);
  const nextState = stateFromSnapshot(nextSnapshot, slice, initialState);
  transition(nextState, nextSnapshot.progression);
  nextSnapshot[slice] = nextState;
  validateSnapshotConsistency(nextSnapshot);
  writeSnapshot(nextSnapshot);
}

function findLeg(state: PreviewProgressionState, routeLegId: string) {
  const routeLeg = state.routeLegs.find((candidate) => candidate.id === routeLegId);
  if (!routeLeg) throw new EscortExecutionError("This RouteLeg is missing from preview progression.", "STALE_STATE");
  return routeLeg;
}

function orderedLegs(state: PreviewProgressionState, orderId: string) {
  return state.routeLegs
    .filter((candidate) => candidate.orderId === orderId)
    .sort((left, right) => left.sequenceNo - right.sequenceNo);
}

export function getPreviewRouteLegStatus(routeLegId: string, fallback: RouteLegStatus): RouteLegStatus {
  const routeLeg = readSnapshot().progression.routeLegs.find((candidate) => candidate.id === routeLegId);
  return routeLeg?.status ?? fallback;
}

export function getPreviewOrderStatus(orderId: string): DeliveryOrderStatus {
  const order = readSnapshot().progression.orders.find((candidate) => candidate.id === orderId);
  if (!order) throw new EscortExecutionError("This Order is missing from preview progression.", "STALE_STATE");
  return order.status;
}

export function startPreviewRouteLeg(state: PreviewProgressionState, routeLegId: string) {
  const routeLeg = findLeg(state, routeLegId);
  const routeOrder = orderedLegs(state, routeLeg.orderId);
  const earlierComplete = routeOrder
    .filter((candidate) => candidate.sequenceNo < routeLeg.sequenceNo)
    .every((candidate) => candidate.status === "COMPLETED");
  const anotherOpen = routeOrder.some((candidate) => candidate.id !== routeLeg.id && candidate.status === "IN_PROGRESS");
  if (routeLeg.status !== "READY" || !earlierComplete || anotherOpen) {
    throw new EscortExecutionError("This RouteLeg cannot start before every earlier RouteLeg is completed.", "VALIDATION_ERROR");
  }
  routeLeg.status = "IN_PROGRESS";
}

export function completePreviewRouteLeg(state: PreviewProgressionState, routeLegId: string) {
  const routeLeg = findLeg(state, routeLegId);
  if (routeLeg.isFinalLeg || routeLeg.status !== "IN_PROGRESS") {
    throw new EscortExecutionError(
      routeLeg.isFinalLeg
        ? "Final RouteLeg completion belongs to the Proof of Delivery workflow."
        : "Only the active RouteLeg can be completed.",
      "VALIDATION_ERROR",
    );
  }

  const routeOrder = orderedLegs(state, routeLeg.orderId);
  const currentIndex = routeOrder.findIndex((candidate) => candidate.id === routeLeg.id);
  const followingLeg = routeOrder[currentIndex + 1];
  routeLeg.status = "COMPLETED";
  if (followingLeg) {
    if (followingLeg.status !== "PLANNED") {
      throw new EscortExecutionError("The next RouteLeg is not in a valid locked state.", "STALE_STATE");
    }
    followingLeg.status = "READY";
  }
}

export function completeFinalPreviewRouteLeg(state: PreviewProgressionState, routeLegId: string) {
  const routeLeg = findLeg(state, routeLegId);
  const routeOrder = orderedLegs(state, routeLeg.orderId);
  const currentIndex = routeOrder.findIndex((candidate) => candidate.id === routeLeg.id);
  if (!routeLeg.isFinalLeg || currentIndex !== routeOrder.length - 1 || routeLeg.status !== "IN_PROGRESS") {
    throw new EscortExecutionError("Only the active final RouteLeg can complete delivery.", "VALIDATION_ERROR");
  }
  if (!routeOrder.slice(0, currentIndex).every((candidate) => candidate.status === "COMPLETED")) {
    throw new EscortExecutionError("Final delivery requires every earlier RouteLeg to be completed.", "STALE_STATE");
  }
  const order = state.orders.find((candidate) => candidate.id === routeLeg.orderId);
  if (!order || order.status !== "IN_PROGRESS") {
    throw new EscortExecutionError("This Order is not available for final delivery.", "STALE_STATE");
  }
  routeLeg.status = "COMPLETED";
  order.status = "DELIVERED";
}

export const previewUnifiedStorageKey = UNIFIED_STORAGE_KEY;
export const previewProgressionStorageKey = LEGACY_PROGRESSION_STORAGE_KEY;
export const previewLegacyRoadStorageKey = LEGACY_ROAD_STORAGE_KEY;
export const previewLegacyAirStorageKey = LEGACY_AIR_STORAGE_KEY;
