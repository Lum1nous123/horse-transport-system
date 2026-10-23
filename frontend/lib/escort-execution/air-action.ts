import type { AssignedAirExecutionDetail, AssignedAirExecutionSummary } from "./types";

export type AirExecutionAction =
  | { kind: "START" }
  | { kind: "ARRIVE_AT_DESTINATION" }
  | { kind: "RECORD_WELFARE" }
  | { kind: "COMPLETE" }
  | { kind: "AWAITING_POD" }
  | { kind: "NONE" }
  | { kind: "INVALID"; message: string };

function lifecycleIsConsistent(execution: AssignedAirExecutionSummary) {
  const detail = execution as AssignedAirExecutionSummary & Partial<AssignedAirExecutionDetail>;
  const hasDetailMetadata = "startedAt" in execution
    || "destinationArrivedAt" in execution
    || "completedAt" in execution
    || "welfareEvidence" in execution;

  if ("welfareEvidence" in execution && Boolean(detail.welfareEvidence) !== execution.welfareRecorded) {
    return false;
  }

  if (execution.status === "NOT_STARTED") {
    if (execution.routeLegStatus !== "PLANNED" && execution.routeLegStatus !== "READY") return false;
    if (execution.welfareRecorded) return false;
    return !hasDetailMetadata || (
      detail.startedAt === null
      && detail.destinationArrivedAt === null
      && detail.completedAt === null
      && detail.welfareEvidence === null
    );
  }

  if (execution.status === "IN_PROGRESS") {
    if (execution.routeLegStatus !== "IN_PROGRESS" || execution.welfareRecorded) return false;
    return !hasDetailMetadata || (
      Boolean(detail.startedAt)
      && detail.destinationArrivedAt === null
      && detail.completedAt === null
      && detail.welfareEvidence === null
    );
  }

  if (execution.status === "DESTINATION") {
    if (execution.routeLegStatus !== "IN_PROGRESS") return false;
    return !hasDetailMetadata || (
      Boolean(detail.startedAt)
      && Boolean(detail.destinationArrivedAt)
      && detail.completedAt === null
    );
  }

  if (execution.status === "COMPLETED") {
    if (execution.routeLegStatus !== "COMPLETED" || !execution.welfareRecorded) return false;
    return !hasDetailMetadata || (
      Boolean(detail.startedAt)
      && Boolean(detail.destinationArrivedAt)
      && Boolean(detail.completedAt)
      && Boolean(detail.welfareEvidence)
    );
  }

  return false;
}

export function resolveAirExecutionAction(execution: AssignedAirExecutionSummary): AirExecutionAction {
  const detail = execution as AssignedAirExecutionSummary & Partial<AssignedAirExecutionDetail>;
  if (!lifecycleIsConsistent(execution)) {
    return { kind: "INVALID", message: "The service returned AIR data that conflicts with the persisted lifecycle state. Refresh before continuing." };
  }
  const enabled = Object.entries(execution.availableActions)
    .filter(([, value]) => value)
    .map(([key]) => key);

  if (enabled.length > 1) {
    return { kind: "INVALID", message: "The service returned multiple conflicting AIR actions. Refresh before continuing." };
  }

  const selected = enabled[0];
  if (!selected) {
    if (execution.isFinalLeg && execution.welfareRecorded && execution.status === "DESTINATION") {
      return { kind: "AWAITING_POD" };
    }
    return { kind: "NONE" };
  }

  const valid = selected === "start"
    ? execution.routeLegStatus === "READY" && execution.status === "NOT_STARTED" && (!("startedAt" in execution) || detail.startedAt === null)
    : selected === "arriveAtDestination"
      ? execution.routeLegStatus === "IN_PROGRESS" && execution.status === "IN_PROGRESS" && (!("startedAt" in execution) || Boolean(detail.startedAt))
      : selected === "recordWelfare"
        ? execution.status === "DESTINATION" && !execution.welfareRecorded && (!("destinationArrivedAt" in execution) || Boolean(detail.destinationArrivedAt))
        : selected === "complete"
          ? !execution.isFinalLeg
            && execution.routeLegStatus === "IN_PROGRESS"
            && execution.status === "DESTINATION"
            && execution.welfareRecorded
            && (!("destinationArrivedAt" in execution) || Boolean(detail.destinationArrivedAt))
            && (!("welfareEvidence" in execution) || Boolean(detail.welfareEvidence))
          : false;

  if (!valid) {
    return { kind: "INVALID", message: "The service returned an AIR action that conflicts with the persisted lifecycle state. Refresh before continuing." };
  }

  if (selected === "start") return { kind: "START" };
  if (selected === "arriveAtDestination") return { kind: "ARRIVE_AT_DESTINATION" };
  if (selected === "recordWelfare") return { kind: "RECORD_WELFARE" };
  return { kind: "COMPLETE" };
}
