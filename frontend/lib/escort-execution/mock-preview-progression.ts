import { EscortExecutionError, type RouteLegStatus } from "./types";

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
};

type PreviewSnapshot = {
  version: 2;
  progression: PreviewProgressionState;
  road?: unknown;
  air?: unknown;
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
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStoredValue(key: string): unknown {
  const saved = window.sessionStorage.getItem(key);
  return saved ? JSON.parse(saved) as unknown : undefined;
}

function isProgressionState(value: unknown): value is PreviewProgressionState {
  if (!isRecord(value) || !Array.isArray(value.routeLegs)) return false;
  return value.routeLegs.every((candidate) => (
    isRecord(candidate)
    && typeof candidate.id === "string"
    && typeof candidate.orderId === "string"
    && typeof candidate.sequenceNo === "number"
    && (candidate.mode === "ROAD" || candidate.mode === "AIR")
    && typeof candidate.isFinalLeg === "boolean"
    && ["PLANNED", "READY", "IN_PROGRESS", "COMPLETED"].includes(String(candidate.status))
  ));
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
      return clone(unified as PreviewSnapshot);
    }

    const legacyProgression = parseStoredValue(LEGACY_PROGRESSION_STORAGE_KEY);
    const progression = legacyProgression === undefined ? clone(initialProgression) : legacyProgression;
    if (!isProgressionState(progression)) throw new Error("Invalid legacy preview progression");

    return {
      version: 2,
      progression: clone(progression),
      road: parseStoredValue(LEGACY_ROAD_STORAGE_KEY),
      air: parseStoredValue(LEGACY_AIR_STORAGE_KEY),
    };
  } catch {
    throw new EscortExecutionError("We couldn't read the saved Escort preview state.", "REQUEST_FAILED");
  }
}

function stateFromSnapshot<T>(snapshot: PreviewSnapshot, slice: PreviewSlice, initialState: T): T {
  const stored = snapshot[slice];
  return stored === undefined ? clone(initialState) : clone(stored as T);
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

type ExecutionRecord = {
  routeLegId?: unknown;
  status?: unknown;
};

function executionRecords(value: unknown): ExecutionRecord[] | null {
  if (value === undefined) return null;
  if (!isRecord(value) || !Array.isArray(value.executions)) {
    throw new EscortExecutionError("The saved Escort preview execution state is invalid.", "REQUEST_FAILED");
  }
  return value.executions.filter(isRecord);
}

function validateSnapshotConsistency(snapshot: PreviewSnapshot) {
  const roadExecutions = executionRecords(snapshot.road);
  const airExecutions = executionRecords(snapshot.air);

  for (const routeLeg of snapshot.progression.routeLegs) {
    const executions = (routeLeg.mode === "ROAD" ? roadExecutions : airExecutions)
      ?.filter((execution) => execution.routeLegId === routeLeg.id);
    if (!executions?.length) continue;

    const statuses = executions.map((execution) => execution.status);
    if (routeLeg.mode === "AIR") {
      const status = statuses[0];
      const consistent = status === "NOT_STARTED"
        ? routeLeg.status === "PLANNED" || routeLeg.status === "READY"
        : status === "IN_PROGRESS" || status === "DESTINATION"
          ? routeLeg.status === "IN_PROGRESS"
          : status === "COMPLETED"
            ? routeLeg.status === "COMPLETED"
            : false;
      if (!consistent) {
        throw new EscortExecutionError("The saved AIR preview state conflicts with RouteLeg progression.", "REQUEST_FAILED");
      }
      continue;
    }

    const everyVehicleCompleted = statuses.every((status) => status === "COMPLETED");
    const anyVehicleActive = statuses.some((status) => status === "IN_PROGRESS" || status === "DESTINATION" || status === "COMPLETED");
    const consistent = routeLeg.status === "COMPLETED"
      ? !routeLeg.isFinalLeg && everyVehicleCompleted
      : routeLeg.status === "IN_PROGRESS"
        ? anyVehicleActive
        : !anyVehicleActive;
    if (!consistent) {
      throw new EscortExecutionError("The saved ROAD preview state conflicts with RouteLeg progression.", "REQUEST_FAILED");
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

export const previewUnifiedStorageKey = UNIFIED_STORAGE_KEY;
export const previewProgressionStorageKey = LEGACY_PROGRESSION_STORAGE_KEY;
export const previewLegacyRoadStorageKey = LEGACY_ROAD_STORAGE_KEY;
export const previewLegacyAirStorageKey = LEGACY_AIR_STORAGE_KEY;
