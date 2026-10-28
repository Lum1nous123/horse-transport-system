import { parseProofOfDeliveryResponse, parseWelfareEvidenceResponse } from "./api-contracts";
import {
  EscortExecutionError,
  type AirExecutionAvailableActions,
  type AssignedAirExecutionDetail,
  type AssignedAirExecutionSummary,
  type AssignedAirWorkQueue,
  type AssignedHorse,
  type AssignedRoadExecutionDetail,
  type AssignedRoadExecutionSummary,
  type AssignedRoadWorkQueue,
  type ExecutionOrderStatus,
  type ExecutionStatus,
  type HandoverProgress,
  type RoadCheckpointProgress,
  type RoadCheckpointType,
  type RouteLegStatus,
} from "./types";
import type { DriverExecution } from "../driver-execution/types";

type JsonObject = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;
const executionStatuses: ExecutionStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DESTINATION", "COMPLETED"];
const routeLegStatuses: RouteLegStatus[] = ["PLANNED", "READY", "IN_PROGRESS", "COMPLETED"];
const checkpointTypes: RoadCheckpointType[] = ["REST_STOP", "BORDER", "QUARANTINE", "OTHER"];
const orderStatuses: ExecutionOrderStatus[] = [
  "DRAFT", "SUBMITTED", "QUOTATION_SENT", "APPROVED", "READY_TO_SHIP",
  "IN_PROGRESS", "DELIVERED", "REJECTED", "CANCELLED",
];

function malformed(contract: string): never {
  throw new EscortExecutionError(
    `The ${contract} response did not match the reviewed Backend contract.`,
    "REQUEST_FAILED",
  );
}

function object(value: unknown, contract: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return malformed(contract);
  return value as JsonObject;
}

function array(value: unknown, contract: string): unknown[] {
  if (!Array.isArray(value)) return malformed(contract);
  return value;
}

function text(value: unknown, contract: string): string {
  if (typeof value !== "string" || !value) return malformed(contract);
  return value;
}

function uuid(value: unknown, contract: string): string {
  const candidate = text(value, contract);
  if (!uuidPattern.test(candidate)) return malformed(contract);
  return candidate;
}

function dateTime(value: unknown, contract: string): string {
  const candidate = text(value, contract);
  if (!localDateTimePattern.test(candidate) || Number.isNaN(Date.parse(candidate))) return malformed(contract);
  return candidate;
}

function nullableDateTime(value: unknown, contract: string): string | null {
  return value === null ? null : dateTime(value, contract);
}

function integer(value: unknown, contract: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) return malformed(contract);
  return value as number;
}

function bool(value: unknown, contract: string): boolean {
  if (typeof value !== "boolean") return malformed(contract);
  return value;
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], contract: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) return malformed(contract);
  return value as T;
}

function handover(value: unknown, contract: string): HandoverProgress {
  const source = object(value, contract);
  const completedHandovers = integer(source.completedHandovers, contract);
  const requiredHandovers = integer(source.requiredHandovers, contract);
  if (completedHandovers > requiredHandovers) return malformed(contract);
  return {
    completedHandovers,
    requiredHandovers,
    routeLegStatus: enumeration(source.routeLegStatus, routeLegStatuses, contract),
    orderStatus: enumeration(source.orderStatus, orderStatuses, contract),
  };
}

function horse(value: unknown, contract: string): AssignedHorse {
  const source = object(value, contract);
  uuid(source.transportOrderHorseId, contract);
  return {
    id: uuid(source.id, contract),
    name: text(source.name, contract),
    microchipId: text(source.microchipId, contract),
  };
}

function staff(value: unknown, contract: string) {
  const source = object(value, contract);
  return { id: uuid(source.id, contract), fullName: text(source.fullName, contract) };
}

function roadSummary(
  value: unknown,
  contract = "ROAD execution",
  deriveFinalWelfareFromDetail = false,
): AssignedRoadExecutionSummary {
  const source = object(value, contract);
  enumeration(source.orderStatus, orderStatuses, contract);
  let finalWelfareRecorded: boolean;
  if (deriveFinalWelfareFromDetail) {
    if (!("finalWelfareEvidence" in source)) return malformed(contract);
    finalWelfareRecorded = source.finalWelfareEvidence !== null;
    if (source.finalWelfareRecorded !== undefined
        && bool(source.finalWelfareRecorded, contract) !== finalWelfareRecorded) return malformed(contract);
  } else {
    finalWelfareRecorded = bool(source.finalWelfareRecorded, contract);
  }
  return {
    executionId: uuid(source.executionId, contract),
    roadLegVehicleId: uuid(source.roadLegVehicleId, contract),
    routeLegId: uuid(source.routeLegId, contract),
    orderId: uuid(source.orderId, contract),
    orderCode: text(source.orderCode, contract),
    routeLegSequenceNo: integer(source.routeLegSequenceNo, contract),
    routeLegStatus: enumeration(source.routeLegStatus, routeLegStatuses, contract),
    isFinalLeg: bool(source.isFinalLeg, contract),
    origin: text(source.origin, contract),
    destination: text(source.destination, contract),
    plannedDepartureAt: dateTime(source.plannedDepartureAt, contract),
    vehiclePlateNumber: text(source.vehiclePlateNumber, contract),
    vehicleName: text(source.vehicleName, contract),
    horseCount: integer(source.horseCount, contract),
    status: enumeration(source.status, executionStatuses, contract),
    reachedCheckpointCount: integer(source.reachedCheckpointCount, contract),
    pendingCheckpointWelfareCount: integer(source.pendingCheckpointWelfareCount, contract),
    destinationArrivedAt: nullableDateTime(source.destinationArrivedAt, contract),
    finalWelfareRecorded,
    proofOfDeliveryRecorded: bool(source.proofOfDeliveryRecorded, contract),
    proofOfDeliveryAvailable: bool(source.proofOfDeliveryAvailable, contract),
    handoverProgress: handover(source.handoverProgress, contract),
  };
}

function checkpoint(value: unknown, executionId: string, contract: string): RoadCheckpointProgress {
  const source = object(value, contract);
  const id = uuid(source.id, contract);
  const welfareEvidence = source.welfareEvidence === null
    ? null
    : parseWelfareEvidenceResponse(source.welfareEvidence, {
      mode: "ROAD", eventType: "CHECKPOINT", checkpointId: id,
    });
  if (welfareEvidence) {
    const evidenceSource = object(source.welfareEvidence, contract);
    if (uuid(evidenceSource.roadVehicleExecutionId, contract).toLowerCase() !== executionId.toLowerCase()) {
      return malformed(contract);
    }
  }
  return {
    id,
    sequenceNo: integer(source.sequenceNo, contract),
    name: text(source.name, contract),
    checkpointType: enumeration(source.checkpointType, checkpointTypes, contract),
    arrivedAt: nullableDateTime(source.arrivedAt, contract),
    welfareEvidence,
  };
}

function airActions(value: unknown, contract: string): AirExecutionAvailableActions {
  const source = object(value, contract);
  return {
    start: bool(source.start, contract),
    arriveAtDestination: bool(source.arriveAtDestination, contract),
    recordWelfare: bool(source.recordWelfare, contract),
    complete: bool(source.complete, contract),
  };
}

function airSummary(value: unknown, contract = "AIR execution"): AssignedAirExecutionSummary {
  const source = object(value, contract);
  enumeration(source.orderStatus, orderStatuses, contract);
  return {
    executionId: uuid(source.executionId, contract),
    routeLegId: uuid(source.routeLegId, contract),
    orderId: uuid(source.orderId, contract),
    orderCode: text(source.orderCode, contract),
    routeLegSequenceNo: integer(source.routeLegSequenceNo, contract),
    routeLegStatus: enumeration(source.routeLegStatus, routeLegStatuses, contract),
    isFinalLeg: bool(source.isFinalLeg, contract),
    origin: text(source.origin, contract),
    destination: text(source.destination, contract),
    plannedDepartureAt: dateTime(source.plannedDepartureAt, contract),
    plannedArrivalAt: dateTime(source.plannedArrivalAt, contract),
    status: enumeration(source.status, executionStatuses, contract),
    welfareRecorded: bool(source.welfareRecorded, contract),
    proofOfDeliveryRecorded: bool(source.proofOfDeliveryRecorded, contract),
    proofOfDeliveryAvailable: bool(source.proofOfDeliveryAvailable, contract),
    handoverProgress: handover(source.handoverProgress, contract),
    availableActions: airActions(source.availableActions, contract),
  };
}

export function parseAssignedRoadQueue(value: unknown): AssignedRoadWorkQueue {
  const contract = "assigned ROAD queue";
  const source = object(value, contract);
  return { executions: array(source.executions, contract).map((item) => roadSummary(item, contract)) };
}

export function parseAssignedRoadDetail(value: unknown): AssignedRoadExecutionDetail {
  const contract = "ROAD execution detail";
  const source = object(value, contract);
  const summary = roadSummary(source, contract, true);
  const assignedDriver = staff(source.assignedDriver, contract);
  const assignedEscort = staff(source.assignedEscort, contract);
  const actionSource = object(source.availableActions, contract);
  bool(actionSource.start, contract);
  if (actionSource.nextCheckpointId !== null) uuid(actionSource.nextCheckpointId, contract);
  bool(actionSource.arriveAtDestination, contract);
  const finalWelfareEvidence = source.finalWelfareEvidence === null
    ? null
    : parseWelfareEvidenceResponse(source.finalWelfareEvidence, {
      mode: "ROAD", eventType: "FINAL_DESTINATION", checkpointId: null,
    });
  const proofOfDelivery = source.proofOfDelivery === null
    ? null
    : parseProofOfDeliveryResponse(source.proofOfDelivery, {
      mode: "ROAD", roadLegVehicleId: summary.roadLegVehicleId,
    });
  if (finalWelfareEvidence) {
    const evidence = object(source.finalWelfareEvidence, contract);
    if (uuid(evidence.roadVehicleExecutionId, contract).toLowerCase() !== summary.executionId.toLowerCase()) {
      return malformed(contract);
    }
  }
  if (proofOfDelivery) {
    const proof = object(source.proofOfDelivery, contract);
    if (uuid(proof.roadVehicleExecutionId, contract).toLowerCase() !== summary.executionId.toLowerCase()
        || proofOfDelivery.routeLegId.toLowerCase() !== summary.routeLegId.toLowerCase()) {
      return malformed(contract);
    }
  }
  if (Boolean(finalWelfareEvidence) !== summary.finalWelfareRecorded
      || Boolean(proofOfDelivery) !== summary.proofOfDeliveryRecorded) return malformed(contract);
  return {
    ...summary,
    assignedEscortId: assignedEscort.id,
    assignedEscortName: assignedEscort.fullName,
    driverName: assignedDriver.fullName,
    horses: array(source.horses, contract).map((item) => horse(item, contract)),
    checkpoints: array(source.checkpoints, contract).map((item) => checkpoint(item, summary.executionId, contract)),
    finalWelfareEvidence,
    proofOfDelivery,
    availableActions: {
      checkpointWelfareIds: array(actionSource.checkpointWelfareIds, contract).map((item) => uuid(item, contract)),
      finalWelfare: bool(actionSource.finalWelfare, contract),
      proofOfDelivery: bool(actionSource.proofOfDelivery, contract),
    },
    lastUpdatedAt: dateTime(source.lastUpdatedAt, contract),
  };
}

export function parseAssignedAirQueue(value: unknown): AssignedAirWorkQueue {
  const contract = "assigned AIR queue";
  const source = object(value, contract);
  return { executions: array(source.executions, contract).map((item) => airSummary(item, contract)) };
}

export function parseAssignedAirDetail(value: unknown): AssignedAirExecutionDetail {
  const contract = "AIR execution detail";
  const source = object(value, contract);
  const summary = airSummary(source, contract);
  const assignedEscort = staff(source.assignedEscort, contract);
  array(source.horses, contract).forEach((item) => horse(item, contract));
  const welfareEvidence = source.welfareEvidence === null
    ? null
    : parseWelfareEvidenceResponse(source.welfareEvidence, {
      mode: "AIR", eventType: "FINAL_DESTINATION", checkpointId: null,
    });
  const proofOfDelivery = source.proofOfDelivery === null
    ? null
    : parseProofOfDeliveryResponse(source.proofOfDelivery, {
      mode: "AIR", routeLegId: summary.routeLegId,
    });
  if (welfareEvidence) {
    const evidence = object(source.welfareEvidence, contract);
    if (uuid(evidence.airLegExecutionId, contract).toLowerCase() !== summary.executionId.toLowerCase()) {
      return malformed(contract);
    }
  }
  if (proofOfDelivery) {
    const proof = object(source.proofOfDelivery, contract);
    if (uuid(proof.airLegExecutionId, contract).toLowerCase() !== summary.executionId.toLowerCase()) {
      return malformed(contract);
    }
  }
  if (Boolean(welfareEvidence) !== summary.welfareRecorded
      || Boolean(proofOfDelivery) !== summary.proofOfDeliveryRecorded) return malformed(contract);
  return {
    ...summary,
    assignedEscortId: assignedEscort.id,
    assignedEscortName: assignedEscort.fullName,
    startedAt: nullableDateTime(source.startedAt, contract),
    destinationArrivedAt: nullableDateTime(source.destinationArrivedAt, contract),
    completedAt: nullableDateTime(source.completedAt, contract),
    welfareEvidence,
    proofOfDelivery,
    lastUpdatedAt: dateTime(source.lastUpdatedAt, contract),
  };
}

function driverOrderStatus(value: unknown, contract: string): DriverExecution["order"]["status"] {
  const status = enumeration(value, orderStatuses, contract);
  if (!["READY_TO_SHIP", "IN_PROGRESS", "DELIVERED", "CANCELLED", "REJECTED"].includes(status)) {
    return malformed(contract);
  }
  return status as DriverExecution["order"]["status"];
}

function driverBase(source: JsonObject, driverId: string, includeActions: boolean): DriverExecution {
  const contract = includeActions ? "Driver ROAD execution detail" : "Driver assigned ROAD queue";
  const summary = roadSummary(source, contract, includeActions);
  const leg = {
    id: summary.routeLegId,
    sequenceNo: summary.routeLegSequenceNo,
    type: "ROAD" as const,
    origin: summary.origin,
    originAddress: null,
    destination: summary.destination,
    destinationAddress: null,
    status: summary.routeLegStatus,
  };
  const checkpoints = includeActions
    ? array(source.checkpoints, contract).map((item) => {
      const point = checkpoint(item, summary.executionId, contract);
      return { id: point.id, routeLegId: summary.routeLegId, sequenceNo: point.sequenceNo, name: point.name, address: null };
    })
    : [];
  const arrivals = includeActions
    ? array(source.checkpoints, contract).flatMap((item) => {
      const point = object(item, contract);
      const checkpointId = uuid(point.id, contract);
      const arrivedAt = nullableDateTime(point.arrivedAt, contract);
      return arrivedAt ? [{ checkpointId, executionId: summary.executionId, arrivedAt }] : [];
    })
    : [];
  let canStart = false;
  let nextCheckpointId: string | null = null;
  let canArriveAtDestination = false;
  if (includeActions) {
    const actions = object(source.availableActions, contract);
    canStart = bool(actions.start, contract);
    nextCheckpointId = actions.nextCheckpointId === null ? null : uuid(actions.nextCheckpointId, contract);
    canArriveAtDestination = bool(actions.arriveAtDestination, contract);
  }
  return {
    id: summary.executionId,
    driverId,
    revision: 0,
    order: {
      id: summary.orderId,
      code: summary.orderCode,
      status: driverOrderStatus(source.orderStatus, contract),
    },
    currentLegId: summary.routeLegStatus === "PLANNED" ? null : summary.routeLegId,
    legId: summary.routeLegId,
    legs: [leg],
    vehicle: {
      id: summary.roadLegVehicleId,
      plateNumber: summary.vehiclePlateNumber,
      horseCount: summary.horseCount,
    },
    status: summary.status,
    checkpoints,
    arrivals,
    startedAt: includeActions ? nullableDateTime(source.startedAt, contract) : null,
    destinationArrivedAt: summary.destinationArrivedAt,
    completedAt: includeActions ? nullableDateTime(source.completedAt, contract) : null,
    permissions: { canStart, nextCheckpointId, canArriveAtDestination, blockedReason: null },
  };
}

export function parseDriverRoadQueue(value: unknown, driverId: string): DriverExecution[] {
  const contract = "Driver assigned ROAD queue";
  const source = object(value, contract);
  return array(source.executions, contract).map((item) => driverBase(object(item, contract), driverId, false));
}

export function parseDriverRoadDetail(value: unknown, expectedDriverId: string): DriverExecution {
  const contract = "Driver ROAD execution detail";
  const source = object(value, contract);
  const assignedDriver = staff(source.assignedDriver, contract);
  if (assignedDriver.id !== expectedDriverId) return malformed(contract);
  return driverBase(source, assignedDriver.id, true);
}
