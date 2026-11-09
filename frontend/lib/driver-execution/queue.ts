import { currentExecutionLeg } from "./actions";
import type { DriverExecution } from "./types";
import type { QueueRecord } from "../execution-queue";

export function driverQueueRow(execution: DriverExecution): QueueRecord & { label: string; execution: DriverExecution } {
  const leg = currentExecutionLeg(execution);
  const inconsistent = !leg || leg.type !== "ROAD"
    || ["CANCELLED", "REJECTED"].includes(execution.order.status)
    || (execution.order.status === "DELIVERED" && execution.status !== "COMPLETED")
    || (execution.status === "NOT_STARTED" && leg.status === "COMPLETED")
    || (execution.status === "COMPLETED" && ["PLANNED", "READY"].includes(leg.status))
    || (["IN_PROGRESS", "DESTINATION"].includes(execution.status) && leg.status !== "IN_PROGRESS");
  const group = inconsistent ? null : execution.status === "NOT_STARTED" ? "upcoming"
    : execution.status === "COMPLETED" ? "completed" : "processing";
  const label = inconsistent ? "Check state" : execution.status === "NOT_STARTED"
    ? execution.currentLegId !== execution.legId || leg?.status === "PLANNED" ? (leg?.sequenceNo ?? 0) > 1 ? "Waiting for previous leg" : "Waiting for leg readiness"
      : leg?.status === "READY" ? "Not started · Ready leg" : "Not started · Current leg"
    : execution.status === "DESTINATION" ? "At destination"
    : execution.status === "COMPLETED" ? "Completed execution" : "In progress";
  return { key: execution.id, orderCode: execution.order.code, sequenceNo: leg?.sequenceNo ?? 0,
    origin: leg?.origin ?? "Origin unavailable", destination: leg?.destination ?? "Destination unavailable",
    vehicle: execution.vehicle.plateNumber, mode: "ROAD", departure: execution.plannedDepartureAt, group, label, execution };
}
