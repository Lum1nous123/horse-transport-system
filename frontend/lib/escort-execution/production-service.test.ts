import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), getAccessToken: vi.fn(), clearAccessToken: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/lib/auth", () => ({ getAccessToken: mocks.getAccessToken, clearAccessToken: mocks.clearAccessToken }));

import { productionEscortExecutionService } from "./production-service";

const executionId = "a0000000-0000-0000-0000-000000000001";
const routeLegId = "a0000000-0000-0000-0000-000000000002";
const orderId = "40000000-0000-0000-0000-000000000001";
const escortId = "50000000-0000-0000-0000-000000000002";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function summary() {
  return {
    executionId,
    routeLegId,
    orderId,
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

function mutation(status: "IN_PROGRESS" | "COMPLETED") {
  return {
    id: executionId,
    routeLegId,
    escortId,
    status,
    startedAt: "2026-10-28T08:01:00",
    destinationArrivedAt: status === "COMPLETED" ? "2026-10-28T16:02:00" : null,
    completedAt: status === "COMPLETED" ? "2026-10-28T16:15:00" : null,
  };
}

describe("production Escort execution service", () => {
  beforeEach(() => mocks.getAccessToken.mockReturnValue("escort-jwt"));

  it("uses the queue's routeLegId for AIR lifecycle writes", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(response({ executions: [summary()] }))
      .mockResolvedValueOnce(response(mutation("IN_PROGRESS")))
      .mockResolvedValueOnce(response(mutation("COMPLETED")));

    await productionEscortExecutionService.listAssignedAirWork();
    await productionEscortExecutionService.startAirExecution(executionId);
    await productionEscortExecutionService.completeAirExecution(executionId);

    expect(mocks.apiFetch.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/air-executions/assigned",
      `/api/v1/air-executions/legs/${routeLegId}/start`,
      `/api/v1/air-executions/legs/${routeLegId}/complete`,
    ]);
    expect(new Headers(mocks.apiFetch.mock.calls[1][1].headers).get("Authorization")).toBe("Bearer escort-jwt");
  });
});
