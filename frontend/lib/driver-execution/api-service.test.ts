import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), getAccessToken: vi.fn(), clearAccessToken: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/lib/auth", () => ({ getAccessToken: mocks.getAccessToken, clearAccessToken: mocks.clearAccessToken }));

import { createProductionDriverExecutionService } from "./api-service";

const driverId = "50000000-0000-0000-0000-000000000001";
const executionId = "10000000-0000-0000-0000-000000000001";
const vehicleId = "20000000-0000-0000-0000-000000000001";
const legId = "30000000-0000-0000-0000-000000000001";
const orderId = "40000000-0000-0000-0000-000000000001";
const escortId = "50000000-0000-0000-0000-000000000002";
const checkpointId = "80000000-0000-0000-0000-000000000001";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function summary() {
  return {
    executionId,
    roadLegVehicleId: vehicleId,
    routeLegId: legId,
    orderId,
    orderCode: "ORD-S3-001",
    orderStatus: "READY_TO_SHIP",
    routeLegSequenceNo: 1,
    routeLegStatus: "READY",
    isFinalLeg: false,
    origin: "Lexington",
    destination: "JFK",
    plannedDepartureAt: "2026-10-27T08:00:00",
    vehiclePlateNumber: "51H-123.45",
    vehicleName: "Horse Van",
    horseCount: 2,
    status: "NOT_STARTED",
    reachedCheckpointCount: 0,
    pendingCheckpointWelfareCount: 0,
    destinationArrivedAt: null,
    finalWelfareRecorded: false,
    proofOfDeliveryRecorded: false,
    proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "READY", orderStatus: "READY_TO_SHIP" },
  };
}

function detail() {
  return {
    ...summary(),
    assignedAt: "2026-10-26T10:00:00",
    startedAt: null,
    completedAt: null,
    assignedDriver: { id: driverId, fullName: "Dana Driver" },
    assignedEscort: { id: escortId, fullName: "Eli Escort" },
    horses: [],
    checkpoints: [{ id: checkpointId, sequenceNo: 1, name: "Rest Farm", checkpointType: "REST_STOP", arrivedAt: null, welfareEvidence: null }],
    finalWelfareEvidence: null,
    proofOfDelivery: null,
    availableActions: { start: true, nextCheckpointId: null, arriveAtDestination: false, checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
    lastUpdatedAt: "2026-10-26T10:00:00",
  };
}

describe("production Driver execution service", () => {
  beforeEach(() => mocks.getAccessToken.mockReturnValue("driver-jwt"));

  it("reads assigned work and uses Backend availableActions on detail", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(response({ executions: [summary()] }))
      .mockResolvedValueOnce(response(detail()));
    const service = createProductionDriverExecutionService(driverId);
    await expect(service.listAssignedWork()).resolves.toEqual([
      expect.objectContaining({ id: executionId, driverId, permissions: { canStart: false, nextCheckpointId: null, canArriveAtDestination: false, blockedReason: null } }),
    ]);
    await expect(service.getExecution(executionId)).resolves.toMatchObject({
      permissions: { canStart: true },
      checkpoints: [{ id: checkpointId }],
    });
  });

  it("accepts the real NOT_STARTED detail DTO without the queue-only finalWelfareRecorded field", async () => {
    const actualBackendDetail = detail() as Record<string, unknown>;
    delete actualBackendDetail.finalWelfareRecorded;
    Object.assign(actualBackendDetail, {
      orderCode: "S3DEMO-AIR-NONFINAL",
      orderStatus: "IN_PROGRESS",
      routeLegSequenceNo: 2,
      routeLegStatus: "READY",
      isFinalLeg: true,
      horseCount: 1,
      status: "NOT_STARTED",
      reachedCheckpointCount: 0,
      pendingCheckpointWelfareCount: 0,
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      checkpoints: [],
      finalWelfareEvidence: null,
      proofOfDelivery: null,
      availableActions: {
        start: true,
        nextCheckpointId: null,
        arriveAtDestination: false,
        checkpointWelfareIds: [],
        finalWelfare: false,
        proofOfDelivery: false,
      },
    });
    mocks.apiFetch.mockResolvedValueOnce(response(actualBackendDetail));

    await expect(createProductionDriverExecutionService(driverId).getExecution(executionId)).resolves.toMatchObject({
      order: { code: "S3DEMO-AIR-NONFINAL", status: "IN_PROGRESS" },
      status: "NOT_STARTED",
      startedAt: null,
      destinationArrivedAt: null,
      completedAt: null,
      permissions: { canStart: true, nextCheckpointId: null },
    });
  });

  it("posts Driver mutations with the roadLegVehicleId learned from persisted reads", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(response(detail()))
      .mockResolvedValueOnce(response({ id: executionId }));
    const service = createProductionDriverExecutionService(driverId);
    await service.getExecution(executionId);
    await service.startVehicle({ executionId, expectedRevision: 0 });
    expect(mocks.apiFetch.mock.calls[1][0]).toBe(`/api/v1/road-executions/vehicles/${vehicleId}/start`);
    expect(mocks.apiFetch.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST" }));
  });

  it("maps 409 without replaying the write", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(response(detail()))
      .mockResolvedValueOnce(response({ code: "EXECUTION_CONFLICT", message: "Not ready" }, 409));
    const service = createProductionDriverExecutionService(driverId);
    await service.getExecution(executionId);
    await expect(service.startVehicle({ executionId, expectedRevision: 0 })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
  });
});
