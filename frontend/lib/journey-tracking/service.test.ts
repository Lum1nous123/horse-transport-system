import { afterEach, describe, expect, it, vi } from "vitest";
import { JourneyReadError, readJourneyNotifications, readJourneyTracking } from "./service";

afterEach(() => vi.unstubAllGlobals());

describe("journey read service", () => {
  it("sends the bearer token and reads tracking for the requested Order", async () => {
    const backendTracking = {
      orderId: "40000000-0000-0000-0000-000000000001",
      orderCode: "ORD-2068",
      orderStatus: "DELIVERED",
      originAddress: "Lexington",
      originCountry: "US",
      destinationAddress: "Brussels",
      destinationCountry: "BE",
      requestedDepartureAt: "2026-10-27T08:00:00",
      deliveredAt: "2026-10-27T15:30:00",
      routePlanId: "30000000-0000-0000-0000-000000000001",
      routePlanStatus: "APPROVED",
      routePlanApprovedAt: "2026-10-26T10:00:00",
      legs: [{
        routeLegId: "30000000-0000-0000-0000-000000000002",
        sequenceNo: 1,
        type: "ROAD",
        status: "COMPLETED",
        origin: "Lexington",
        destination: "JFK",
        plannedDepartureAt: "2026-10-27T08:00:00",
        plannedArrivalAt: "2026-10-27T15:00:00",
        startedAt: "2026-10-27T08:05:00",
        completedAt: "2026-10-27T15:30:00",
        airProviderName: null,
        airReference: null,
        roadVehicles: [{
          roadLegVehicleId: "20000000-0000-0000-0000-000000000001",
          vehicleId: "20000000-0000-0000-0000-000000000002",
          plateNumber: "51H-123.45",
          vehicleName: "Horse Van",
          vehicleType: "VAN",
          horseCapacity: 2,
          executionId: "10000000-0000-0000-0000-000000000001",
          executionStatus: "COMPLETED",
          startedAt: "2026-10-27T08:05:00",
          destinationArrivedAt: "2026-10-27T15:00:00",
          completedAt: "2026-10-27T15:30:00",
          driver: { fullName: "Dana Driver", phone: null },
          escort: { fullName: "Eli Escort", phone: "+1 555 0100" },
          horses: [{ transportOrderHorseId: "70000000-0000-0000-0000-000000000001", horseId: "60000000-0000-0000-0000-000000000001", name: "Silver Star" }],
          checkpoints: [{
            checkpointId: "80000000-0000-0000-0000-000000000001",
            sequenceNo: 1,
            name: "Rest Farm",
            type: "REST_STOP",
            countryCode: "US",
            minimumRequiredStopMinutes: 30,
            plannedStopDurationMinutes: 45,
            planningNote: null,
            reached: true,
            arrivedAt: "2026-10-27T11:00:00",
            welfare: { id: "90000000-0000-0000-0000-000000000001", eventType: "CHECKPOINT", photoUrl: "https://storage.example/welfare.jpg", note: "Calm", recordedAt: "2026-10-27T11:05:00" },
          }],
          finalWelfare: { id: "90000000-0000-0000-0000-000000000002", eventType: "FINAL_DESTINATION", photoUrl: "https://storage.example/final.jpg", note: "Fit", recordedAt: "2026-10-27T15:05:00" },
          proofOfDelivery: { id: "90000000-0000-0000-0000-000000000003", recipientName: "Receiver", proofPhotoUrl: "https://storage.example/pod.jpg", handoverNote: null, deliveredAt: "2026-10-27T15:30:00" },
        }],
        airExecution: null,
      }],
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => backendTracking });
    vi.stubGlobal("fetch", fetchMock);
    await expect(readJourneyTracking("order-2068", "token-for-test")).resolves.toMatchObject({
      orderCode: "ORD-2068",
      origin: "Lexington, US",
      updatedAt: "2026-10-27T15:30:00",
      legs: [{
        mode: "ROAD",
        status: "COMPLETED",
        vehicles: [{
          label: "51H-123.45",
          checkpoints: [{ reachedAt: "2026-10-27T11:00:00", note: "Calm" }],
        }],
      }],
      deliveryEvents: [{ label: "Proof of Delivery recorded for 51H-123.45" }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/orders/order-2068/tracking"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-for-test" }) }),
    );
  });

  it("does not turn a server authorization denial into empty tracking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(readJourneyTracking("another-order", "token-for-test")).rejects.toMatchObject({ status: 403 } satisfies Partial<JourneyReadError>);
  });

  it("reads Customer notifications without local fallback", async () => {
    const notices = [{ id: "n1", title: "Payment received", message: "Paid", createdAt: "2026-10-23T10:00:00Z", readAt: null }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => notices }));
    await expect(readJourneyNotifications("order-2068", "token-for-test")).resolves.toEqual(notices);
  });
});
