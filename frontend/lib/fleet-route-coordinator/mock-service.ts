import {
  DEFAULT_PREVIEW_COORDINATOR_ID,
  getPreviewCoordinatorIdentity,
  readPreviewAssignmentRecipients,
} from "@/lib/preview-workflow/assignment-bridge";
import {
  CoordinatorWorkspaceError,
  type AssignedCoordinatorOrderDetail,
  type AssignedCoordinatorOrderSummary,
  type FleetRouteCoordinatorService,
  type RoutePlanStatus,
} from "./types";

type MockCoordinatorOrder = Omit<
  AssignedCoordinatorOrderDetail,
  "assignedFleetRouteCoordinatorId" | "assignedFleetRouteCoordinatorName" | "assignedAt" | "readiness" | "readOnly"
>;

const orders: MockCoordinatorOrder[] = [
  {
    id: "order-2046",
    orderCode: "ORD-2046",
    origin: "Aachen, Germany",
    destination: "Doha, Qatar",
    requestedDepartureAt: "2026-10-16T13:00:00+07:00",
    horseCount: 2,
    transportMode: "AIR",
    routePlanStatus: "NOT_STARTED",
    routePlanUpdatedAt: null,
    returnReason: null,
    customerName: "Casey Morgan",
    assignedTransportSpecialistName: "Brooke Mitchell",
    documentFinalConfirmedAt: "2026-10-09T11:20:00+07:00",
    remainingBalancePaidAt: "2026-10-10T09:14:00+07:00",
  },
  {
    id: "order-2074",
    orderCode: "ORD-2074",
    origin: "Lexington, United States",
    destination: "Brussels, Belgium",
    requestedDepartureAt: "2026-10-28T09:00:00+07:00",
    horseCount: 4,
    transportMode: "COMBINED",
    routePlanStatus: "DRAFT",
    routePlanUpdatedAt: "2026-10-10T15:26:00+07:00",
    returnReason: null,
    customerName: "Morgan Taylor",
    assignedTransportSpecialistName: "Daniel Kim",
    documentFinalConfirmedAt: "2026-10-08T16:30:00+07:00",
    remainingBalancePaidAt: "2026-10-09T10:05:00+07:00",
  },
  {
    id: "order-2093",
    orderCode: "ORD-2093",
    origin: "Wellington, New Zealand",
    destination: "Singapore, Singapore",
    requestedDepartureAt: "2026-11-03T07:00:00+07:00",
    horseCount: 2,
    transportMode: "AIR",
    routePlanStatus: "RETURNED",
    routePlanUpdatedAt: "2026-10-10T17:42:00+07:00",
    returnReason: "Adjust the ROAD transfer window before resubmitting the plan.",
    customerName: "Avery Bennett",
    assignedTransportSpecialistName: "Emily Ross",
    documentFinalConfirmedAt: "2026-10-07T14:12:00+07:00",
    remainingBalancePaidAt: "2026-10-08T08:30:00+07:00",
  },
];

function pause(duration = 260) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

function scenario() {
  return new URLSearchParams(window.location.search).get("scenario");
}

function currentCoordinator() {
  return typeof window === "undefined"
    ? { id: DEFAULT_PREVIEW_COORDINATOR_ID, name: "Jordan Ellis" }
    : getPreviewCoordinatorIdentity(window.location.search);
}

function maybeThrowReadFailure() {
  if (scenario() === "failure") {
    throw new CoordinatorWorkspaceError(
      "We couldn't load your assigned planning Orders. Check your connection and try again.",
      "REQUEST_FAILED",
    );
  }
}

function detailFor(order: MockCoordinatorOrder, statusOverride?: RoutePlanStatus) {
  const assignments = readPreviewAssignmentRecipients();
  const assignment = assignments[order.id];
  const coordinator = currentCoordinator();
  if (!assignment || assignment.fleetRouteCoordinatorId !== coordinator.id) {
    throw new CoordinatorWorkspaceError(
      "This Order is assigned to another Fleet & Route Coordinator.",
      "FORBIDDEN",
    );
  }
  const routePlanStatus = statusOverride ?? order.routePlanStatus;
  const readOnly = routePlanStatus === "PENDING_LM_REVIEW" || routePlanStatus === "APPROVED";
  return {
    ...order,
    routePlanStatus,
    routePlanUpdatedAt: statusOverride ? new Date().toISOString() : order.routePlanUpdatedAt,
    assignedAt: assignment.assignedAt,
    assignedTransportSpecialistName: assignment.transportSpecialistName,
    assignedFleetRouteCoordinatorId: assignment.fleetRouteCoordinatorId,
    assignedFleetRouteCoordinatorName: assignment.fleetRouteCoordinatorName,
    readOnly,
    readiness: [
      { id: "assignment", label: "Staff assigned", description: "The Order is assigned to you and a Transport Specialist.", state: "complete" as const },
      { id: "documents", label: "Documents Final Confirmed", description: "The Document Phase is approved and permanently locked.", state: "complete" as const },
      { id: "payment", label: "Remaining Balance paid", description: "The persisted payment record is confirmed as paid.", state: "complete" as const },
      {
        id: "route-plan",
        label: routePlanStatus === "NOT_STARTED" ? "Route Plan not started" : `Route Plan ${routePlanStatus.toLowerCase().replaceAll("_", " ")}`,
        description: readOnly
          ? routePlanStatus === "APPROVED" ? "The approved Route Plan is permanently locked." : "The plan is locked while Logistics Manager review is pending."
          : routePlanStatus === "RETURNED" ? "Review the Logistics Manager's return reason before revising the plan." : "Planning context is ready for Route Plan work.",
        state: readOnly ? "locked" as const : "current" as const,
      },
    ],
  };
}

function summaryFor(order: MockCoordinatorOrder): AssignedCoordinatorOrderSummary {
  return {
    id: order.id,
    orderCode: order.orderCode,
    origin: order.origin,
    destination: order.destination,
    requestedDepartureAt: order.requestedDepartureAt,
    horseCount: order.horseCount,
    transportMode: order.transportMode,
    routePlanStatus: order.routePlanStatus,
    routePlanUpdatedAt: order.routePlanUpdatedAt,
    returnReason: order.returnReason,
  };
}

export const mockFleetRouteCoordinatorService: FleetRouteCoordinatorService = {
  async listAssignedActionableOrders() {
    await pause();
    maybeThrowReadFailure();
    if (scenario() === "empty") return { orders: [] };
    const assignments = readPreviewAssignmentRecipients();
    const coordinator = currentCoordinator();
    return {
      orders: orders
        .filter((order) => assignments[order.id]?.fleetRouteCoordinatorId === coordinator.id)
        .filter((order) => ["NOT_STARTED", "DRAFT", "RETURNED"].includes(order.routePlanStatus))
        .map(summaryFor),
    };
  },

  async getAssignedPlanningContext(orderId: string) {
    await pause();
    maybeThrowReadFailure();
    if (scenario() === "stale") {
      throw new CoordinatorWorkspaceError(
        "This Route Plan state changed while the page was open. Return to the queue and open the latest planning context.",
        "STALE_STATE",
      );
    }
    if (orderId === "order-unassigned") {
      throw new CoordinatorWorkspaceError(
        "This Order is assigned to another Fleet & Route Coordinator.",
        "FORBIDDEN",
      );
    }
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order || scenario() === "unavailable") {
      throw new CoordinatorWorkspaceError(
        "This assigned planning Order is no longer available.",
        "NOT_FOUND",
      );
    }
    const statusOverride = scenario() === "readonly"
      ? "PENDING_LM_REVIEW"
      : scenario() === "approved"
        ? "APPROVED"
        : undefined;
    return detailFor(order, statusOverride);
  },
};
