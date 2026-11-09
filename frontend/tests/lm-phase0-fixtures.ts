import type { RouteReviewDetail } from "@/lib/logistics-route-review/types";
import type { AssignmentOrderDetail } from "@/lib/staff-assignment/types";

export function reviewFixture(): RouteReviewDetail {
  return {
    orderId: "order-1", orderCode: "ORD-1", origin: "Origin", destination: "Destination",
    requestedDepartureAt: "2026-11-07T09:00:00Z", horseCount: 1, transportMode: "ROAD",
    routePlanStatus: "PENDING_LM_REVIEW", submittedAt: "2026-11-06T09:00:00Z",
    reviewedAt: null, assignedFleetRouteCoordinatorName: "Real FRC", orderStatus: "APPROVED",
    lockedAt: null, returnReason: null, validations: [],
    legs: [{
      id: "leg-1", sequenceNo: 1, legType: "ROAD", origin: "Origin", destination: "Destination",
      plannedDepartureAt: "2026-11-07T09:00:00Z", plannedArrivalAt: "2026-11-07T12:00:00Z",
      checkpoints: [], airProviderName: null, airReference: null, airCapacityHorses: null, airEscort: null,
      roadVehicles: [{
        id: "vehicle-1", plateNumber: "REAL-1", vehicleName: "Vehicle", horseCapacity: 2,
        horseNames: [], orderHorseIds: ["order-horse-1"], driver: null, escort: null,
      }],
    }],
  };
}

export function lockedFixture(): RouteReviewDetail {
  const result = reviewFixture();
  result.routePlanStatus = "APPROVED";
  result.orderStatus = "READY_TO_SHIP";
  result.lockedAt = "2026-11-06T10:00:00Z";
  result.legs[0].roadVehicles[0].driver = { id: "driver-id" };
  result.legs[0].roadVehicles[0].escort = { id: "escort-id" };
  return result;
}

export function assignmentFixture(): AssignmentOrderDetail {
  return {
    id: "order-1", orderCode: "ORD-1", origin: "Origin", destination: "Destination",
    requestedDepartureAt: "2026-11-07T09:00:00Z", horseCount: 1, transportMode: "ROAD",
    assignmentStatus: "NEEDS_ASSIGNMENT", customerName: "", assignedPair: null,
    candidates: {
      transportSpecialists: [{ id: "ts-1", fullName: "Real TS", email: "ts@example.com", role: "TRANSPORT_SPECIALIST", activeOrderCount: 1 }],
      fleetRouteCoordinators: [{ id: "frc-1", fullName: "Real FRC", email: "frc@example.com", role: "FLEET_ROUTE_COORDINATOR", activeOrderCount: 2 }],
    },
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
