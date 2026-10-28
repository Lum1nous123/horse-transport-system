import { describe, expect, it } from "vitest";
import {
  parseAssignedAirDetail,
  parseAssignedAirQueue,
  parseAssignedRoadDetail,
  parseAssignedRoadQueue,
} from "./read-contracts";

const ids = {
  execution: "10000000-0000-0000-0000-000000000001",
  roadVehicle: "20000000-0000-0000-0000-000000000001",
  leg: "30000000-0000-0000-0000-000000000001",
  order: "40000000-0000-0000-0000-000000000001",
  driver: "50000000-0000-0000-0000-000000000001",
  escort: "50000000-0000-0000-0000-000000000002",
  horse: "60000000-0000-0000-0000-000000000001",
  orderHorse: "70000000-0000-0000-0000-000000000001",
  checkpoint: "80000000-0000-0000-0000-000000000001",
  evidence: "90000000-0000-0000-0000-000000000001",
};

function progress(orderStatus = "IN_PROGRESS") {
  return { completedHandovers: 0, requiredHandovers: 1, routeLegStatus: "IN_PROGRESS", orderStatus };
}

function roadSummary() {
  return {
    executionId: ids.execution,
    roadLegVehicleId: ids.roadVehicle,
    routeLegId: ids.leg,
    orderId: ids.order,
    orderCode: "ORD-S3-001",
    orderStatus: "IN_PROGRESS",
    routeLegSequenceNo: 1,
    routeLegStatus: "IN_PROGRESS",
    isFinalLeg: true,
    origin: "Lexington, KY",
    destination: "JFK Airport",
    plannedDepartureAt: "2026-10-27T08:00:00",
    vehiclePlateNumber: "51H-123.45",
    vehicleName: "Horse Van 1",
    horseCount: 1,
    status: "IN_PROGRESS",
    reachedCheckpointCount: 0,
    pendingCheckpointWelfareCount: 0,
    destinationArrivedAt: null,
    finalWelfareRecorded: false,
    proofOfDeliveryRecorded: false,
    proofOfDeliveryAvailable: false,
    handoverProgress: progress(),
  };
}

function roadDetail() {
  return {
    ...roadSummary(),
    assignedAt: "2026-10-26T10:00:00",
    startedAt: "2026-10-27T08:05:00",
    completedAt: null,
    assignedDriver: { id: ids.driver, fullName: "Dana Driver" },
    assignedEscort: { id: ids.escort, fullName: "Eli Escort" },
    horses: [{ id: ids.horse, transportOrderHorseId: ids.orderHorse, name: "Silver Star", microchipId: "MICRO-S3-001" }],
    checkpoints: [{
      id: ids.checkpoint,
      sequenceNo: 1,
      name: "Rest Farm",
      checkpointType: "REST_STOP",
      arrivedAt: null,
      welfareEvidence: null,
    }],
    finalWelfareEvidence: null,
    proofOfDelivery: null,
    availableActions: {
      start: false,
      nextCheckpointId: ids.checkpoint,
      arriveAtDestination: false,
      checkpointWelfareIds: [],
      finalWelfare: false,
      proofOfDelivery: false,
    },
    lastUpdatedAt: "2026-10-27T08:05:00",
  };
}

function airSummary() {
  return {
    executionId: ids.execution,
    routeLegId: ids.leg,
    orderId: ids.order,
    orderCode: "ORD-S3-001",
    orderStatus: "READY_TO_SHIP",
    routeLegSequenceNo: 2,
    routeLegStatus: "READY",
    isFinalLeg: false,
    origin: "JFK Airport",
    destination: "Brussels Airport",
    plannedDepartureAt: "2026-10-28T08:00:00",
    plannedArrivalAt: "2026-10-28T16:00:00",
    status: "NOT_STARTED",
    welfareRecorded: false,
    proofOfDeliveryRecorded: false,
    proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "READY", orderStatus: "READY_TO_SHIP" },
    availableActions: { start: true, arriveAtDestination: false, recordWelfare: false, complete: false },
  };
}

describe("Sprint 3 execution read contracts", () => {
  it("maps ROAD queue and detail without deriving actions", () => {
    expect(parseAssignedRoadQueue({ executions: [roadSummary()] }).executions[0]).toMatchObject({
      executionId: ids.execution,
      roadLegVehicleId: ids.roadVehicle,
    });
    expect(parseAssignedRoadDetail(roadDetail())).toMatchObject({
      assignedEscortId: ids.escort,
      driverName: "Dana Driver",
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
    });
  });

  it("preserves READY_TO_SHIP handover state and Backend AIR actions", () => {
    expect(parseAssignedAirQueue({ executions: [airSummary()] }).executions[0]).toMatchObject({
      handoverProgress: { orderStatus: "READY_TO_SHIP" },
      availableActions: { start: true },
    });
    expect(parseAssignedAirDetail({
      ...airSummary(),
      assignedAt: "2026-10-26T10:00:00",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      assignedEscort: { id: ids.escort, fullName: "Eli Escort" },
      horses: [{ id: ids.horse, transportOrderHorseId: ids.orderHorse, name: "Silver Star", microchipId: "MICRO-S3-001" }],
      welfareEvidence: null,
      proofOfDelivery: null,
      lastUpdatedAt: "2026-10-26T10:00:00",
    })).toMatchObject({ assignedEscortId: ids.escort, startedAt: null });
  });

  it("rejects contradictory persisted evidence flags", () => {
    expect(() => parseAssignedRoadDetail({ ...roadDetail(), finalWelfareRecorded: true }))
      .toThrow(/reviewed Backend contract/);
  });
});
