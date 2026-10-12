export type RouteReviewStatus = "PENDING_LM_REVIEW" | "RETURNED" | "APPROVED";

export type RouteReviewOrderStatus = "APPROVED" | "READY_TO_SHIP";

export type RouteReviewSummary = {
  orderId: string;
  orderCode: string;
  origin: string;
  destination: string;
  requestedDepartureAt: string;
  horseCount: number;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  routePlanStatus: RouteReviewStatus;
  submittedAt: string;
  reviewedAt: string | null;
  assignedFleetRouteCoordinatorName: string;
};

export type RouteReviewValidation = {
  code: string;
  label: string;
  message: string;
  status: "PASSED" | "FAILED";
};

export type ExecutionStaff = {
  id: string;
  fullName: string;
  email: string;
};

export type RouteReviewCheckpoint = {
  id: string;
  sequenceNo: number;
  name: string;
  checkpointType: "REST_STOP" | "BORDER" | "QUARANTINE" | "OTHER";
  countryCode: string | null;
  plannedStopDurationMinutes: number | null;
};

export type RouteReviewRoadVehicle = {
  id: string;
  plateNumber: string;
  vehicleName: string;
  horseCapacity: number;
  horseNames: string[];
  driver: ExecutionStaff | null;
  escort: ExecutionStaff | null;
};

export type RouteReviewLeg = {
  id: string;
  sequenceNo: number;
  legType: "ROAD" | "AIR";
  origin: string;
  destination: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  roadVehicles: RouteReviewRoadVehicle[];
  checkpoints: RouteReviewCheckpoint[];
  airProviderName: string | null;
  airReference: string | null;
  airCapacityHorses: number | null;
  airEscort: ExecutionStaff | null;
};

export type RouteReviewDetail = RouteReviewSummary & {
  customerName: string;
  orderStatus: RouteReviewOrderStatus;
  revision: number;
  lockedAt: string | null;
  returnReason: string | null;
  legs: RouteReviewLeg[];
  validations: RouteReviewValidation[];
};

export type RouteReviewQueues = {
  pending: RouteReviewSummary[];
  locked: RouteReviewSummary[];
};

export interface LogisticsRouteReviewService {
  listReviews(): Promise<RouteReviewQueues>;
  getReview(orderId: string): Promise<RouteReviewDetail>;
  returnPlan(orderId: string, reason: string): Promise<void>;
  confirmPlan(orderId: string): Promise<void>;
}

export type RouteReviewErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STALE_STATE"
  | "VALIDATION_FAILED"
  | "TRANSACTION_FAILED"
  | "REQUEST_FAILED"
  | "CONTRACT_UNAVAILABLE";

export class RouteReviewError extends Error {
  constructor(message: string, public readonly code: RouteReviewErrorCode) {
    super(message);
    this.name = "RouteReviewError";
  }
}

export function hasCompleteLockedStaffing(review: RouteReviewDetail) {
  if (review.routePlanStatus !== "APPROVED" || !review.lockedAt || review.orderStatus !== "READY_TO_SHIP") {
    return false;
  }

  return review.legs.every((leg) => {
    if (leg.legType === "AIR") {
      return Boolean(leg.airEscort);
    }
    return leg.roadVehicles.length > 0
      && leg.roadVehicles.every((vehicle) => Boolean(vehicle.driver && vehicle.escort));
  });
}
