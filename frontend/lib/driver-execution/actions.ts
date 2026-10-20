import type { DriverExecution } from "./types";

export type DriverAction =
  | { type: "START"; label: "Start my vehicle" }
  | { type: "CHECKPOINT"; label: "Confirm checkpoint arrival"; checkpointId: string; name: string }
  | { type: "DESTINATION"; label: "Confirm destination arrival" };

export function currentExecutionLeg(execution: DriverExecution) {
  return execution.legs.find((leg) => leg.id === execution.legId);
}

export function orderedCheckpoints(execution: DriverExecution) {
  return execution.checkpoints
    .filter((checkpoint) => checkpoint.routeLegId === execution.legId)
    .toSorted((a, b) => a.sequenceNo - b.sequenceNo);
}

export function checkpointArrival(execution: DriverExecution, checkpointId: string) {
  return execution.arrivals.find((arrival) =>
    arrival.executionId === execution.id && arrival.checkpointId === checkpointId,
  );
}

// A second, conservative UI guard. The backend must enforce the same ownership
// and sequence rules; a visible/disabled button is not an authorization boundary.
export function nextDriverAction(execution: DriverExecution, driverId: string): DriverAction | null {
  const leg = currentExecutionLeg(execution);
  if (execution.driverId !== driverId || !leg || leg.type !== "ROAD"
    || execution.currentLegId !== leg.id
    || !["READY_TO_SHIP", "IN_PROGRESS"].includes(execution.order.status)) return null;

  if (execution.status === "NOT_STARTED"
    && ["READY", "IN_PROGRESS"].includes(leg.status)
    && execution.permissions.canStart) return { type: "START", label: "Start my vehicle" };

  if (execution.status !== "IN_PROGRESS" || leg.status !== "IN_PROGRESS"
    || execution.order.status !== "IN_PROGRESS") return null;

  const checkpoints = orderedCheckpoints(execution);
  const next = checkpoints.find((checkpoint) => !checkpointArrival(execution, checkpoint.id));
  if (next && execution.permissions.nextCheckpointId === next.id) {
    return { type: "CHECKPOINT", label: "Confirm checkpoint arrival", checkpointId: next.id, name: next.name };
  }
  if (!next && execution.permissions.canArriveAtDestination) {
    return { type: "DESTINATION", label: "Confirm destination arrival" };
  }
  return null;
}

export function executionStatusLabel(execution: DriverExecution) {
  if (execution.status === "COMPLETED") return "Completed";
  if (execution.status === "DESTINATION") return "At destination";
  if (execution.status === "IN_PROGRESS") return "In progress";
  if (execution.currentLegId !== execution.legId) return "Waiting for prior leg";
  return "Not started";
}

export function blockedMessage(execution: DriverExecution, driverId: string) {
  if (execution.driverId !== driverId) return "This vehicle is not assigned to you.";
  if (execution.status === "COMPLETED") return "Your vehicle execution is complete. No further Driver action is needed.";
  if (execution.status === "DESTINATION") return "Your destination arrival is recorded. The system will update completion when the remaining requirements are met.";
  if (execution.currentLegId !== execution.legId) return "This leg is not current. Wait for the previous leg to complete, then refresh.";
  return execution.permissions.blockedReason ?? "No Driver action is available. Refresh to check the latest journey state.";
}
