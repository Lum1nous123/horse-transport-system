import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiLogisticsRouteReviewService as service } from "./api-service";
import { apiFetch } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAccessToken: () => "test-token", clearAccessToken: vi.fn() }));

const raw = (status = "PENDING_LM_REVIEW") => ({
  routePlan: { id: "plan-1", transportOrderId: "order-1", status, lockedAt: status === "APPROVED" ? "2026-11-06T10:00:00Z" : null,
    legs: [{ id: "leg-1", sequenceNo: 1, legType: "ROAD", origin: "Origin", destination: "Destination",
      plannedDepartureAt: "2026-11-07T09:00:00Z", plannedArrivalAt: "2026-11-07T12:00:00Z", checkpoints: [] }] },
  review: { submittedAt: "2026-11-06T09:00:00Z", decidedAt: null, returnReason: status === "RETURNED" ? "Correct route" : null },
  roadAllocations: [{ routeLegId: "leg-1", vehicles: [{
    vehicleId: "vehicle-1", roadLegVehicleId: "allocation-1", plateNumber: "REAL-1", vehicleName: "Vehicle",
    horseCapacity: 2, orderHorseIds: ["order-horse-id"],
  }] }],
  executionStaffing: { roadVehicleExecutions: status === "APPROVED" ? [{
    roadLegVehicleId: "allocation-1", driverId: "driver-id", driverFullName: "Dana Driver", driverEmail: "dana.driver@example.com",
    escortId: "escort-id", escortFullName: "Eli Escort", escortEmail: "eli.escort@example.com",
  }] : [], airLegExecutions: [] },
  orderStatus: status === "APPROVED" ? "READY_TO_SHIP" : null,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    const url = String(path);
    if (url.endsWith("/staff-assignments")) return Response.json([{ role: "FLEET_ROUTE_COORDINATOR", fullName: "Real FRC" }]);
    if (url === "/api/v1/orders/order-1") return Response.json({ id: "order-1", orderCode: "ORD-1", originAddress: "Origin",
      destinationAddress: "Destination", requestedDeliveryDate: "2026-11-07", horseIds: ["horse-id"],
      transportMode: "ROAD", status: "APPROVED" });
    if (url.endsWith("/confirm") && init?.method === "POST") return Response.json(raw("APPROVED"));
    if (url.endsWith("/return") && init?.method === "POST") return Response.json(raw("RETURNED"));
    if (url.endsWith("/orders/order-1")) return Response.json(raw());
    if (url === "/api/v1/lm/route-plan-reviews") return Response.json([{ transportOrderId: "order-1" }]);
    throw new Error("Unexpected request: " + url);
  });
});

describe("real LM review adapter", () => {
  it("maps execution staff profiles without exposing IDs as display labels", async () => {
    const result = await service.confirmPlan("order-1");
    expect(result.customerName).toBeUndefined();
    expect(result.revision).toBeUndefined();
    expect(result.validations).toEqual([]);
    expect(result.legs[0].roadVehicles[0]).toMatchObject({
      horseNames: [], orderHorseIds: ["order-horse-id"],
      driver: { id: "driver-id", fullName: "Dana Driver", email: "dana.driver@example.com" },
      escort: { id: "escort-id", fullName: "Eli Escort", email: "eli.escort@example.com" },
    });
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/lm/route-plan-reviews/orders/order-1/confirm", expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
    }));
  });

  it("always performs GET instead of returning cached mutation responses", async () => {
    expect((await service.returnPlan("order-1", "Correct route")).routePlanStatus).toBe("RETURNED");
    expect((await service.getReview("order-1")).routePlanStatus).toBe("PENDING_LM_REVIEW");
    await service.getReview("order-1");
    expect(vi.mocked(apiFetch).mock.calls.filter(([url]) => url === "/api/v1/lm/route-plan-reviews/orders/order-1")).toHaveLength(2);
  });

  it("does not fabricate locked history", async () => {
    const result = await service.listReviews();
    expect(result.pending).toHaveLength(1);
    expect(result.locked).toEqual([]);
  });

  it.each([400, 403, 409, 500])("surfaces HTTP %s with no automatic mutation retry", async (status) => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ message: "Rejected" }, { status }));
    await expect(service.confirmPlan("order-1")).rejects.toThrow("Rejected");
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("clears expired authentication and fails closed", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(service.getReview("order-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(clearAccessToken).toHaveBeenCalledOnce();
  });
});
