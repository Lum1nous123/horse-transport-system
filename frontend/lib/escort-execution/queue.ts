import { resolveAirExecutionAction } from "./air-action";
import type { AssignedAirExecutionSummary, AssignedRoadExecutionSummary } from "./types";
import type { QueueRecord } from "../execution-queue";

type QueuePresentation = QueueRecord & {
  executionId: string; label: string; nextStep: string; attention: boolean;
  handover: { completed: number; required: number } | null;
};

function common(execution: AssignedRoadExecutionSummary | AssignedAirExecutionSummary, mode: "ROAD" | "AIR"): QueueRecord {
  return { key: mode + ":" + execution.executionId, orderCode: execution.orderCode,
    sequenceNo: execution.routeLegSequenceNo, origin: execution.origin, destination: execution.destination,
    vehicle: "vehiclePlateNumber" in execution ? execution.vehiclePlateNumber : "AIR RouteLeg",
    mode, departure: execution.plannedDepartureAt,
    group: execution.status === "NOT_STARTED" ? "upcoming" : execution.status === "COMPLETED" ? "completed" : "processing" };
}

function handover(execution: AssignedRoadExecutionSummary | AssignedAirExecutionSummary) {
  return execution.isFinalLeg && execution.handoverProgress.requiredHandovers > 0
    ? { completed: execution.handoverProgress.completedHandovers, required: execution.handoverProgress.requiredHandovers } : null;
}

export function roadQueueRow(execution: AssignedRoadExecutionSummary): QueuePresentation {
  const inconsistent = (execution.proofOfDeliveryAvailable && (!execution.isFinalLeg || execution.proofOfDeliveryRecorded
    || !execution.finalWelfareRecorded || !execution.destinationArrivedAt
    || !["DESTINATION", "COMPLETED"].includes(execution.status)
    || execution.handoverProgress.orderStatus !== "IN_PROGRESS"))
    || (execution.status === "NOT_STARTED" && (execution.routeLegStatus === "COMPLETED"
      || execution.destinationArrivedAt !== null || execution.pendingCheckpointWelfareCount > 0))
    || (["IN_PROGRESS", "DESTINATION"].includes(execution.status) && execution.routeLegStatus !== "IN_PROGRESS")
    || (execution.status === "COMPLETED" && ["PLANNED", "READY"].includes(execution.routeLegStatus))
    || ["CANCELLED", "REJECTED"].includes(execution.handoverProgress.orderStatus)
    || (execution.handoverProgress.orderStatus === "DELIVERED" && execution.status !== "COMPLETED")
    || (execution.proofOfDeliveryRecorded && (!execution.isFinalLeg || execution.status !== "COMPLETED"));
  const row = common(execution, "ROAD");
  if (inconsistent) return { ...row, executionId: execution.executionId, group: null,
    label: "Check state", nextStep: "View execution", attention: true, handover: handover(execution) };
  const nextStep = execution.proofOfDeliveryAvailable ? "Record Proof of Delivery"
    : execution.proofOfDeliveryRecorded ? "View saved handover"
    : execution.pendingCheckpointWelfareCount > 0 ? "Record checkpoint welfare"
    : execution.destinationArrivedAt && !execution.finalWelfareRecorded ? "Record final welfare" : "View execution";
  const label = execution.status === "NOT_STARTED"
    ? execution.routeLegStatus === "PLANNED" ? execution.routeLegSequenceNo > 1 ? "Waiting for previous leg" : "Waiting for leg readiness"
      : execution.routeLegStatus === "READY" ? "Not started · Ready leg" : "Not started · Current leg"
    : execution.status === "DESTINATION" ? "At destination"
    : execution.status === "COMPLETED" ? "Completed execution" : "In progress";
  return { ...row, group: execution.proofOfDeliveryAvailable ? "processing" : row.group,
    executionId: execution.executionId, label, nextStep, attention: nextStep.startsWith("Record"), handover: handover(execution) };
}

export function airQueueRow(execution: AssignedAirExecutionSummary): QueuePresentation {
  const action = resolveAirExecutionAction(execution);
  const invalid = action.kind === "INVALID" || ["CANCELLED", "REJECTED"].includes(execution.handoverProgress.orderStatus)
    || (execution.handoverProgress.orderStatus === "DELIVERED" && execution.status !== "COMPLETED");
  const row = common(execution, "AIR");
  const nextStep = invalid ? "View execution"
    : execution.proofOfDeliveryAvailable && action.kind === "AWAITING_POD" ? "Record Proof of Delivery"
    : execution.proofOfDeliveryRecorded ? "View saved handover"
    : action.kind === "START" ? "Start AIR execution"
    : action.kind === "ARRIVE_AT_DESTINATION" ? "Record destination arrival"
    : action.kind === "RECORD_WELFARE" ? "Record AIR welfare"
    : action.kind === "COMPLETE" ? "Complete AIR execution" : "View execution";
  const label = invalid ? "Check state"
    : execution.status === "NOT_STARTED" ? execution.routeLegStatus === "PLANNED" ? execution.routeLegSequenceNo > 1 ? "Waiting for previous leg" : "Waiting for leg readiness" : "Not started · Ready leg"
    : execution.status === "DESTINATION" ? "At destination"
    : execution.status === "COMPLETED" ? "Completed execution" : "In progress";
  return { ...row, group: invalid ? null : row.group, executionId: execution.executionId,
    label, nextStep, attention: invalid || !["NONE", "AWAITING_POD"].includes(action.kind)
      || execution.proofOfDeliveryAvailable, handover: handover(execution) };
}
