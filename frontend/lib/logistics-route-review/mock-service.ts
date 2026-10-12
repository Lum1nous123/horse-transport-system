import {
  RouteReviewError,
  type ExecutionStaff,
  type LogisticsRouteReviewService,
  type RouteReviewDetail,
  type RouteReviewRoadVehicle,
} from "./types";

const drivers: ExecutionStaff[] = [
  { id: "driver-amelia", fullName: "Amelia Hart", email: "amelia.hart@example.com" },
  { id: "driver-noah", fullName: "Noah Bennett", email: "noah.bennett@example.com" },
  { id: "driver-ethan", fullName: "Ethan Cole", email: "ethan.cole@example.com" },
];

const escorts: ExecutionStaff[] = [
  { id: "escort-sofia", fullName: "Sofia Ramirez", email: "sofia.ramirez@example.com" },
  { id: "escort-liam", fullName: "Liam Foster", email: "liam.foster@example.com" },
  { id: "escort-emma", fullName: "Emma Dubois", email: "emma.dubois@example.com" },
  { id: "escort-mia", fullName: "Mia Laurent", email: "mia.laurent@example.com" },
];

const pendingReview: RouteReviewDetail = {
  orderId: "order-2074",
  orderCode: "ORD-2074",
  origin: "Lexington, United States",
  destination: "Brussels, Belgium",
  requestedDepartureAt: "2026-10-28T09:00:00-04:00",
  horseCount: 4,
  transportMode: "COMBINED",
  routePlanStatus: "PENDING_LM_REVIEW",
  submittedAt: "2026-10-12T15:26:00+07:00",
  reviewedAt: null,
  assignedFleetRouteCoordinatorName: "Jordan Ellis",
  customerName: "Morgan Taylor",
  orderStatus: "APPROVED",
  revision: 4,
  lockedAt: null,
  returnReason: null,
  validations: [
    { code: "LEG_CONTINUITY", label: "Route continuity", message: "Every leg connects in order from origin to destination.", status: "PASSED" },
    { code: "PLANNED_TIME_ORDER", label: "Planned times", message: "All departures and arrivals are ordered correctly.", status: "PASSED" },
    { code: "ROAD_ALLOCATION", label: "ROAD allocation", message: "Every Horse is allocated exactly once per ROAD leg.", status: "PASSED" },
    { code: "CAPACITY_AVAILABILITY", label: "Capacity and availability", message: "Vehicle and AIR capacity checks passed.", status: "PASSED" },
  ],
  legs: [
    {
      id: "leg-2074-1", sequenceNo: 1, legType: "ROAD",
      origin: "Lexington, United States", destination: "Chicago O'Hare Cargo Terminal",
      plannedDepartureAt: "2026-10-28T09:00:00-04:00", plannedArrivalAt: "2026-10-28T16:30:00-05:00",
      airProviderName: null, airReference: null, airCapacityHorses: null, airEscort: null,
      roadVehicles: [
        { id: "vehicle-trk-101", plateNumber: "TRK-101", vehicleName: "EquiMove 1", horseCapacity: 3, horseNames: ["Apollo", "Bella"], driver: null, escort: null },
        { id: "vehicle-trk-102", plateNumber: "TRK-102", vehicleName: "Stallion Express", horseCapacity: 4, horseNames: ["Commander", "Dakota"], driver: null, escort: null },
      ],
      checkpoints: [
        { id: "checkpoint-1", sequenceNo: 1, name: "Bluegrass rest area", checkpointType: "REST_STOP", countryCode: "US", plannedStopDurationMinutes: 45 },
        { id: "checkpoint-2", sequenceNo: 2, name: "Illinois veterinary checkpoint", checkpointType: "QUARANTINE", countryCode: "US", plannedStopDurationMinutes: null },
      ],
    },
    {
      id: "leg-2074-2", sequenceNo: 2, legType: "AIR",
      origin: "Chicago O'Hare Cargo Terminal", destination: "Brussels Airport Cargo",
      plannedDepartureAt: "2026-10-29T01:15:00-05:00", plannedArrivalAt: "2026-10-29T15:10:00+01:00",
      roadVehicles: [], checkpoints: [], airProviderName: "SkyEquine Cargo", airReference: "SE-4821",
      airCapacityHorses: 6, airEscort: null,
    },
    {
      id: "leg-2074-3", sequenceNo: 3, legType: "ROAD",
      origin: "Brussels Airport Cargo", destination: "Brussels, Belgium",
      plannedDepartureAt: "2026-10-29T18:00:00+01:00", plannedArrivalAt: "2026-10-29T19:15:00+01:00",
      airProviderName: null, airReference: null, airCapacityHorses: null, airEscort: null,
      roadVehicles: [
        { id: "vehicle-be-210", plateNumber: "BE-210", vehicleName: "Brussels Equine Van", horseCapacity: 4, horseNames: ["Apollo", "Bella", "Commander", "Dakota"], driver: null, escort: null },
      ],
      checkpoints: [],
    },
  ],
};

function withAssignedStaff(review: RouteReviewDetail): RouteReviewDetail {
  let roadIndex = 0;
  let escortIndex = 0;
  return {
    ...review,
    routePlanStatus: "APPROVED",
    orderStatus: "READY_TO_SHIP",
    reviewedAt: "2026-10-12T18:45:00+07:00",
    lockedAt: "2026-10-12T18:45:00+07:00",
    legs: review.legs.map((leg) => {
      if (leg.legType === "AIR") {
        const airEscort = escorts[escortIndex++];
        return { ...leg, airEscort };
      }
      const roadVehicles: RouteReviewRoadVehicle[] = leg.roadVehicles.map((vehicle) => ({
        ...vehicle,
        driver: drivers[roadIndex++ % drivers.length],
        escort: escorts[escortIndex++ % escorts.length],
      }));
      return { ...leg, roadVehicles };
    }),
  };
}

const lockedReview: RouteReviewDetail = withAssignedStaff({
  ...pendingReview,
  orderId: "order-2068",
  orderCode: "ORD-2068",
  requestedDepartureAt: "2026-10-28T09:00:00-04:00",
  submittedAt: "2026-10-11T14:20:00+07:00",
  assignedFleetRouteCoordinatorName: "Avery Chen",
  customerName: "Taylor Morgan",
  revision: 2,
});

const store = new Map<string, RouteReviewDetail>([
  [pendingReview.orderId, pendingReview],
  [lockedReview.orderId, lockedReview],
]);

function pause(duration = 220) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

function scenario() {
  return new URLSearchParams(window.location.search).get("scenario");
}

function cloneReview(review: RouteReviewDetail): RouteReviewDetail {
  return {
    ...review,
    validations: review.validations.map((validation) => ({ ...validation })),
    legs: review.legs.map((leg) => ({
      ...leg,
      roadVehicles: leg.roadVehicles.map((vehicle) => ({
        ...vehicle,
        horseNames: [...vehicle.horseNames],
        driver: vehicle.driver ? { ...vehicle.driver } : null,
        escort: vehicle.escort ? { ...vehicle.escort } : null,
      })),
      checkpoints: leg.checkpoints.map((checkpoint) => ({ ...checkpoint })),
      airEscort: leg.airEscort ? { ...leg.airEscort } : null,
    })),
  };
}

function getStoredReview(orderId: string) {
  if (orderId === "order-forbidden" || scenario() === "forbidden") {
    throw new RouteReviewError("You don't have permission to review this Route Plan.", "FORBIDDEN");
  }
  const review = store.get(orderId);
  if (!review) throw new RouteReviewError("This Route Plan is no longer available.", "NOT_FOUND");
  return review;
}

function maybeThrowReadFailure() {
  if (scenario() === "failure") {
    throw new RouteReviewError("We couldn't load Route Reviews. Check your connection and try again.", "REQUEST_FAILED");
  }
}

export const mockLogisticsRouteReviewService: LogisticsRouteReviewService = {
  async listReviews() {
    await pause();
    maybeThrowReadFailure();
    if (scenario() === "empty") return { pending: [], locked: [] };
    const reviews = [...store.values()];
    return {
      pending: reviews.filter((review) => review.routePlanStatus === "PENDING_LM_REVIEW").map(cloneReview),
      locked: reviews.filter((review) => review.routePlanStatus === "APPROVED").map(cloneReview),
    };
  },

  async getReview(orderId) {
    await pause();
    maybeThrowReadFailure();
    if (scenario() === "stale") {
      throw new RouteReviewError("This Route Plan changed while it was open. Refresh before reviewing it.", "STALE_STATE");
    }
    const review = cloneReview(getStoredReview(orderId));
    if (scenario() === "invalid") {
      review.validations[1] = { ...review.validations[1], status: "FAILED", message: "Leg 2 departs before Leg 1 arrives." };
    }
    return review;
  },

  async returnPlan(orderId, reason) {
    await pause(320);
    const review = getStoredReview(orderId);
    if (!reason.trim()) throw new RouteReviewError("Enter a reason before returning this Route Plan.", "VALIDATION_FAILED");
    if (scenario() === "stale-action" || review.routePlanStatus !== "PENDING_LM_REVIEW") {
      throw new RouteReviewError("This Route Plan is no longer pending review. Refresh to see its latest state.", "STALE_STATE");
    }
    if (scenario() === "transaction-failure") {
      throw new RouteReviewError("The Return transaction failed. No changes were saved.", "TRANSACTION_FAILED");
    }
    store.set(orderId, { ...review, routePlanStatus: "RETURNED", returnReason: reason.trim(), reviewedAt: new Date().toISOString() });
  },

  async confirmPlan(orderId) {
    await pause(420);
    const review = getStoredReview(orderId);
    if (review.validations.some((validation) => validation.status === "FAILED") || scenario() === "invalid") {
      throw new RouteReviewError("This Route Plan has validation failures and cannot be confirmed.", "VALIDATION_FAILED");
    }
    if (scenario() === "stale-action" || review.routePlanStatus !== "PENDING_LM_REVIEW") {
      throw new RouteReviewError("This Route Plan is no longer pending review. Refresh to see its latest state.", "STALE_STATE");
    }
    if (scenario() === "transaction-failure") {
      throw new RouteReviewError("Confirmation failed. The Route Plan was not locked and no staff assignments were saved.", "TRANSACTION_FAILED");
    }
    const locked = withAssignedStaff(review);
    if (scenario() === "partial-readback") {
      locked.orderStatus = "APPROVED";
      locked.legs[0].roadVehicles[0].escort = null;
    }
    store.set(orderId, locked);
  },
};
