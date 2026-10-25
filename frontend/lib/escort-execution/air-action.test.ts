import { describe, expect, it } from "vitest";
import { resolveAirExecutionAction } from "./air-action";
import type { AssignedAirExecutionDetail, AssignedAirExecutionSummary, WelfareEvidence } from "./types";

const noActions = { start: false, arriveAtDestination: false, recordWelfare: false, complete: false };

function summary(overrides: Partial<AssignedAirExecutionSummary> = {}): AssignedAirExecutionSummary {
  return {
    executionId: "air-execution",
    orderId: "order-1",
    orderCode: "ORD-1",
    routeLegId: "air-leg-1",
    routeLegSequenceNo: 1,
    routeLegStatus: "READY",
    isFinalLeg: false,
    origin: "Origin",
    destination: "Destination",
    plannedDepartureAt: "2026-10-31T08:00:00Z",
    plannedArrivalAt: "2026-10-31T12:00:00Z",
    status: "NOT_STARTED",
    welfareRecorded: false,
    proofOfDeliveryRecorded: false,
    proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "READY", orderStatus: "IN_PROGRESS" },
    availableActions: noActions,
    ...overrides,
  };
}

const evidence: WelfareEvidence = {
  id: "welfare-1",
  eventType: "FINAL_DESTINATION",
  checkpointId: null,
  photoUrl: "data:image/png;base64,cGhvdG8=",
  photoName: "arrival.png",
  note: "Horses are calm.",
  recordedAt: "2026-10-31T12:05:00Z",
};

function detail(overrides: Partial<AssignedAirExecutionDetail> = {}): AssignedAirExecutionDetail {
  return {
    ...summary(),
    assignedEscortId: "escort-mia",
    assignedEscortName: "Mia Laurent",
    startedAt: null,
    destinationArrivedAt: null,
    completedAt: null,
    welfareEvidence: null,
    proofOfDelivery: null,
    lastUpdatedAt: "2026-10-31T07:00:00Z",
    ...overrides,
  };
}

describe("resolveAirExecutionAction", () => {
  it.each([
    ["START", summary({ availableActions: { ...noActions, start: true } })],
    ["ARRIVE_AT_DESTINATION", detail({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T08:02:00Z",
      availableActions: { ...noActions, arriveAtDestination: true },
    })],
    ["RECORD_WELFARE", detail({
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      availableActions: { ...noActions, recordWelfare: true },
    })],
    ["COMPLETE", detail({
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      welfareRecorded: true,
      welfareEvidence: evidence,
      availableActions: { ...noActions, complete: true },
    })],
    ["AWAITING_POD", detail({
      routeLegStatus: "IN_PROGRESS",
      isFinalLeg: true,
      status: "DESTINATION",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      welfareRecorded: true,
      welfareEvidence: evidence,
    })],
    ["NONE", summary({ routeLegStatus: "PLANNED" })],
    ["COMPLETE", summary({
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      welfareRecorded: true,
      availableActions: { ...noActions, complete: true },
    })],
    ["NONE", summary({
      routeLegStatus: "COMPLETED",
      isFinalLeg: true,
      status: "COMPLETED",
      welfareRecorded: true,
      proofOfDeliveryRecorded: true,
      handoverProgress: { completedHandovers: 1, requiredHandovers: 1, routeLegStatus: "COMPLETED", orderStatus: "DELIVERED" },
    })],
  ])("resolves valid %s lifecycle data", (kind, execution) => {
    expect(resolveAirExecutionAction(execution).kind).toBe(kind);
  });

  it.each([
    ["Start while the RouteLeg is planned", summary({ routeLegStatus: "PLANNED", availableActions: { ...noActions, start: true } })],
    ["Arrival after arrival was already recorded", detail({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      availableActions: { ...noActions, arriveAtDestination: true },
    })],
    ["Complete while the RouteLeg is planned", detail({
      routeLegStatus: "PLANNED",
      status: "DESTINATION",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      welfareRecorded: true,
      welfareEvidence: evidence,
      availableActions: { ...noActions, complete: true },
    })],
    ["Complete on a final AIR leg", detail({
      routeLegStatus: "IN_PROGRESS",
      isFinalLeg: true,
      status: "DESTINATION",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      welfareRecorded: true,
      welfareEvidence: evidence,
      availableActions: { ...noActions, complete: true },
    })],
    ["Completed execution without completion metadata", detail({
      routeLegStatus: "COMPLETED",
      status: "COMPLETED",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      welfareRecorded: true,
      welfareEvidence: evidence,
      completedAt: null,
    })],
    ["Welfare flag without evidence", detail({
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      startedAt: "2026-10-31T08:02:00Z",
      destinationArrivedAt: "2026-10-31T12:00:00Z",
      welfareRecorded: true,
      welfareEvidence: null,
    })],
    ["Multiple simultaneous capabilities", summary({
      availableActions: { ...noActions, start: true, arriveAtDestination: true },
    })],
    ["Completed final AIR leg without Proof of Delivery", summary({
      routeLegStatus: "COMPLETED",
      isFinalLeg: true,
      status: "COMPLETED",
      welfareRecorded: true,
    })],
    ["Proof of Delivery on a non-final AIR leg", summary({
      routeLegStatus: "COMPLETED",
      status: "COMPLETED",
      welfareRecorded: true,
      proofOfDeliveryRecorded: true,
      handoverProgress: { completedHandovers: 1, requiredHandovers: 1, routeLegStatus: "COMPLETED", orderStatus: "DELIVERED" },
    })],
  ])("fails safely for %s", (_label, execution) => {
    expect(resolveAirExecutionAction(execution).kind).toBe("INVALID");
  });
});
