import { checkpointArrival, nextDriverAction, orderedCheckpoints } from "./actions";
import {
  ExecutionError, type DriverExecution, type DriverExecutionService,
  type DriverSession, type ExecutionCommand,
} from "./types";

export const previewScenarios = [
  "ready", "additional-driver", "in-progress", "locked", "no-checkpoints",
  "destination", "completed", "empty", "error",
] as const;
export type PreviewScenario = typeof previewScenarios[number];

// Local behavioral simulation for UI review. This is NOT an approved API
// contract or evidence of real-API integration. See DRIVER_EXECUTION.md.
export function createPreviewWork(scenario: PreviewScenario = "ready"): DriverExecution[] {
  const base: DriverExecution = {
    id: "demo-execution-204", driverId: "demo-driver-alex", revision: 1,
    order: { id: "demo-order-2084", code: "ORD-2084", status: "READY_TO_SHIP" },
    currentLegId: "demo-leg-1", legId: "demo-leg-1",
    legs: [
      { id: "demo-leg-1", sequenceNo: 1, type: "ROAD", origin: "Bangkok depot", destination: "Ayutthaya equine center", status: "READY" },
      { id: "demo-leg-2", sequenceNo: 2, type: "AIR", origin: "Ayutthaya equine center", destination: "Amsterdam airport", status: "PLANNED" },
      { id: "demo-leg-3", sequenceNo: 3, type: "ROAD", origin: "Amsterdam airport", destination: "Utrecht stables", status: "PLANNED" },
    ],
    vehicle: { id: "demo-vehicle-204", plateNumber: "HT-204", horseCount: 3 },
    status: "NOT_STARTED",
    checkpoints: [
      { id: "demo-stop-1", routeLegId: "demo-leg-1", sequenceNo: 1, name: "Pathum Thani rest stop" },
      { id: "demo-stop-2", routeLegId: "demo-leg-1", sequenceNo: 2, name: "Bang Pa-in checkpoint" },
    ],
    arrivals: [], startedAt: null, destinationArrivedAt: null, completedAt: null,
    permissions: { canStart: true, nextCheckpointId: null, canArriveAtDestination: false, blockedReason: null },
  };
  const sibling = structuredClone(base);
  sibling.id = "demo-execution-205";
  sibling.driverId = "demo-driver-jamie";
  sibling.vehicle = { id: "demo-vehicle-205", plateNumber: "HT-205", horseCount: 2 };
  const locked = structuredClone(base);
  locked.id = "demo-execution-119";
  locked.order = { id: "demo-order-2091", code: "ORD-2091", status: "IN_PROGRESS" };
  locked.legId = "demo-leg-3";
  locked.legs[0].status = "IN_PROGRESS";
  locked.vehicle = { id: "demo-vehicle-119", plateNumber: "HT-119", horseCount: 1 };
  locked.checkpoints = [];
  locked.permissions = { canStart: false, nextCheckpointId: null, canArriveAtDestination: false, blockedReason: "Wait for the previous leg to complete." };
  if (scenario === "additional-driver") {
    for (const work of [base, sibling]) {
      work.order.status = "IN_PROGRESS";
      work.legs[0].status = "IN_PROGRESS";
    }
    sibling.status = "IN_PROGRESS";
    sibling.startedAt = "2026-10-22T08:00:00+07:00";
  }
  if (["in-progress", "destination", "completed"].includes(scenario)) {
    base.order.status = "IN_PROGRESS";
    base.legs[0].status = "IN_PROGRESS";
    base.status = "IN_PROGRESS";
    base.startedAt = "2026-10-22T08:10:00+07:00";
    base.arrivals = [{ executionId: base.id, checkpointId: "demo-stop-1", arrivedAt: "2026-10-22T09:05:00+07:00" }];
  }
  if (["destination", "completed"].includes(scenario)) {
    base.arrivals.push({ executionId: base.id, checkpointId: "demo-stop-2", arrivedAt: "2026-10-22T10:00:00+07:00" });
    base.status = scenario === "completed" ? "COMPLETED" : "DESTINATION";
    base.destinationArrivedAt = "2026-10-22T11:00:00+07:00";
    base.completedAt = scenario === "completed" ? "2026-10-22T11:10:00+07:00" : null;
  }
  if (scenario === "no-checkpoints") base.checkpoints = [];
  if (scenario === "empty") return [];
  return scenario === "locked" ? [locked, sibling] : [base, locked, sibling];
}

function withPermissions(work: DriverExecution): DriverExecution {
  const leg = work.legs.find((candidate) => candidate.id === work.legId);
  const current = work.currentLegId === work.legId && leg?.type === "ROAD";
  const activeOrder = ["READY_TO_SHIP", "IN_PROGRESS"].includes(work.order.status);
  const progressing = current && activeOrder && leg?.status === "IN_PROGRESS" && work.status === "IN_PROGRESS";
  const next = orderedCheckpoints(work).find((point) => !checkpointArrival(work, point.id));
  return { ...work, permissions: {
    canStart: Boolean(current && activeOrder && ["READY", "IN_PROGRESS"].includes(leg?.status ?? "") && work.status === "NOT_STARTED"),
    nextCheckpointId: progressing ? next?.id ?? null : null,
    canArriveAtDestination: Boolean(progressing && !next),
    blockedReason: work.permissions.blockedReason,
  } };
}

export function createPreviewDriverService(options: {
  driverId: string;
  initialWork?: DriverExecution[];
  scenario?: PreviewScenario;
  latency?: number;
  storage?: Pick<Storage, "getItem" | "setItem">;
}): DriverExecutionService {
  const { driverId, scenario = "ready", latency = 280, storage } = options;
  const storageKey = `ht-driver-preview-v1:${scenario}`;
  let work = structuredClone(options.initialWork ?? createPreviewWork(scenario));
  function read() {
    try {
      const saved = storage?.getItem(storageKey);
      if (saved) work = JSON.parse(saved) as DriverExecution[];
    } catch { /* Use in-memory preview if browser storage is unavailable. */ }
    return work;
  }
  function persist() {
    try { storage?.setItem(storageKey, JSON.stringify(work)); } catch { /* In-memory preview remains usable. */ }
  }
  async function pause(signal?: AbortSignal) {
    await new Promise((resolve) => setTimeout(resolve, latency));
    signal?.throwIfAborted();
    if (scenario === "error") throw new ExecutionError("Could not load your work. Check your connection and refresh.", "NETWORK_ERROR");
  }
  function own(id: string) {
    const execution = read().find((item) => item.id === id);
    if (!execution) throw new ExecutionError("This assignment is no longer available. Return to My ROAD work.", "NOT_FOUND");
    if (execution.driverId !== driverId) throw new ExecutionError("This vehicle is not assigned to you.", "FORBIDDEN");
    return execution;
  }
  function current(command: ExecutionCommand) {
    const execution = own(command.executionId);
    if (execution.revision !== command.expectedRevision) throw new ExecutionError("This journey has changed. Refresh and review it before trying again.", "STALE_STATE");
    return execution;
  }
  return {
    async listAssignedWork(signal) {
      await pause(signal);
      return structuredClone(read().filter((item) => item.driverId === driverId).map(withPermissions));
    },
    async getExecution(id, signal) {
      await pause(signal);
      return structuredClone(withPermissions(own(id)));
    },
    async startVehicle(command) {
      await pause();
      const execution = current(command);
      if (execution.status !== "NOT_STARTED") throw new ExecutionError("This vehicle has already started. Refresh to see its journey.", "ALREADY_RECORDED");
      if (nextDriverAction(withPermissions(execution), driverId)?.type !== "START") throw new ExecutionError("This leg cannot start yet. Refresh to check the current leg.", "OUT_OF_SEQUENCE");
      // One simulated commit: first Start propagates Order/leg once; additional
      // Drivers still start their own vehicles independently.
      for (const sibling of work.filter((item) => item.order.id === execution.order.id)) {
        sibling.order.status = "IN_PROGRESS";
        const leg = sibling.legs.find((item) => item.id === execution.legId);
        if (leg) leg.status = "IN_PROGRESS";
        sibling.revision++;
      }
      execution.status = "IN_PROGRESS";
      execution.startedAt = new Date().toISOString();
      persist();
    },
    async arriveAtCheckpoint(command) {
      await pause();
      const execution = current(command);
      if (checkpointArrival(execution, command.checkpointId)) throw new ExecutionError("This arrival is already recorded. Refresh to see the next stop.", "ALREADY_RECORDED");
      const action = nextDriverAction(withPermissions(execution), driverId);
      if (action?.type !== "CHECKPOINT" || action.checkpointId !== command.checkpointId) throw new ExecutionError("Only the next checkpoint for your current leg can be recorded. Refresh the journey.", "OUT_OF_SEQUENCE");
      execution.arrivals.push({ checkpointId: command.checkpointId, executionId: execution.id, arrivedAt: new Date().toISOString() });
      execution.revision++;
      persist();
    },
    async arriveAtDestination(command) {
      await pause();
      const execution = current(command);
      if (nextDriverAction(withPermissions(execution), driverId)?.type !== "DESTINATION") throw new ExecutionError("Destination arrival is not available. Refresh and check the remaining stops.", "OUT_OF_SEQUENCE");
      execution.destinationArrivedAt = new Date().toISOString();
      execution.status = "DESTINATION";
      execution.revision++;
      // Never infer completion, unlock a leg, or bypass welfare/PoD here.
      persist();
    },
  };
}

export function createPreviewDriverSession(query: URLSearchParams): DriverSession {
  const requested = query.get("scenario") as PreviewScenario;
  const scenario = previewScenarios.includes(requested) ? requested : "ready";
  const secondDriver = query.get("driver") === "jamie";
  const driverId = secondDriver ? "demo-driver-jamie" : "demo-driver-alex";
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* Browser storage may be disabled. */ }
  const previewQuery = `?${new URLSearchParams({ preview: "1", scenario, ...(secondDriver ? { driver: "jamie" } : {}) })}`;
  return {
    driverId, fullName: secondDriver ? "Jamie Rivera" : "Alex Morgan", preview: true, previewQuery,
    service: createPreviewDriverService({ driverId, scenario, storage }),
  };
}
