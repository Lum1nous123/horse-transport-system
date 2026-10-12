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
  type RouteLegInput,
  type RoutePlanDetail,
  type RoutePlanStatus,
  type RoutePlanValidationIssue,
} from "./types";

type MockCoordinatorOrder = Omit<
  AssignedCoordinatorOrderDetail,
  "assignedFleetRouteCoordinatorId" | "assignedFleetRouteCoordinatorName" | "assignedAt" | "readiness" | "readOnly"
>;

const orders: MockCoordinatorOrder[] = [
  {
    id: "order-2046", orderCode: "ORD-2046", origin: "Aachen, Germany", destination: "Doha, Qatar",
    requestedDepartureAt: "2026-10-16T13:00:00+07:00", horseCount: 2, transportMode: "AIR",
    routePlanStatus: "NOT_STARTED", routePlanUpdatedAt: null, returnReason: null, customerName: "Casey Morgan",
    assignedTransportSpecialistName: "Brooke Mitchell", documentFinalConfirmedAt: "2026-10-09T11:20:00+07:00",
    remainingBalancePaidAt: "2026-10-10T09:14:00+07:00",
  },
  {
    id: "order-2074", orderCode: "ORD-2074", origin: "Lexington, United States", destination: "Brussels, Belgium",
    requestedDepartureAt: "2026-10-28T09:00:00+07:00", horseCount: 4, transportMode: "COMBINED",
    routePlanStatus: "DRAFT", routePlanUpdatedAt: "2026-10-10T15:26:00+07:00", returnReason: null,
    customerName: "Morgan Taylor", assignedTransportSpecialistName: "Daniel Kim",
    documentFinalConfirmedAt: "2026-10-08T16:30:00+07:00", remainingBalancePaidAt: "2026-10-09T10:05:00+07:00",
  },
  {
    id: "order-2093", orderCode: "ORD-2093", origin: "Wellington, New Zealand", destination: "Singapore, Singapore",
    requestedDepartureAt: "2026-11-03T07:00:00+07:00", horseCount: 2, transportMode: "AIR",
    routePlanStatus: "RETURNED", routePlanUpdatedAt: "2026-10-10T17:42:00+07:00",
    returnReason: "Adjust the ROAD transfer window before resubmitting the plan.", customerName: "Avery Bennett",
    assignedTransportSpecialistName: "Emily Ross", documentFinalConfirmedAt: "2026-10-07T14:12:00+07:00",
    remainingBalancePaidAt: "2026-10-08T08:30:00+07:00",
  },
];

const planStore: Record<string, RoutePlanDetail> = {
  "order-2046": { id: null, orderId: "order-2046", status: "NOT_STARTED", revision: 0, updatedAt: null, returnedReason: null, readOnly: false, legs: [], validationIssues: [] },
  "order-2074": {
    id: "plan-2074", orderId: "order-2074", status: "DRAFT", revision: 3,
    updatedAt: "2026-10-10T15:26:00+07:00", returnedReason: null, readOnly: false, validationIssues: [],
    legs: [
      { id: "leg-2074-1", sequenceNo: 1, legType: "ROAD", origin: "Lexington, United States", destination: "Chicago O'Hare Cargo Terminal", plannedDepartureAt: "2026-10-28T09:00:00-04:00", plannedArrivalAt: "2026-10-28T16:30:00-05:00", airProviderName: null, airReference: null, airCapacityHorses: null, equipmentDetails: "Climate-controlled horse van", notes: "Rest stop planned after four hours." },
      { id: "leg-2074-2", sequenceNo: 2, legType: "AIR", origin: "Chicago O'Hare Cargo Terminal", destination: "Brussels Airport Cargo", plannedDepartureAt: "2026-10-29T01:15:00-05:00", plannedArrivalAt: "2026-10-29T15:10:00+01:00", airProviderName: "SkyEquine Cargo", airReference: "SE-4821", airCapacityHorses: 6, equipmentDetails: "Four IATA horse stalls", notes: "Vet handover before loading." },
      { id: "leg-2074-3", sequenceNo: 3, legType: "ROAD", origin: "Brussels Airport Cargo", destination: "Brussels, Belgium", plannedDepartureAt: "2026-10-29T18:00:00+01:00", plannedArrivalAt: "2026-10-29T19:15:00+01:00", airProviderName: null, airReference: null, airCapacityHorses: null, equipmentDetails: "Local horse van", notes: null },
    ],
  },
  "order-2093": {
    id: "plan-2093", orderId: "order-2093", status: "RETURNED", revision: 5,
    updatedAt: "2026-10-10T17:42:00+07:00", returnedReason: "Adjust the ROAD transfer window before resubmitting the plan.", readOnly: false, validationIssues: [],
    legs: [
      { id: "leg-2093-1", sequenceNo: 1, legType: "ROAD", origin: "Wellington, New Zealand", destination: "Wellington Airport Cargo", plannedDepartureAt: "2026-11-03T07:00:00+13:00", plannedArrivalAt: "2026-11-03T08:15:00+13:00", airProviderName: null, airReference: null, airCapacityHorses: null, equipmentDetails: "Two-stall horse van", notes: "Revise transfer buffer before resubmitting." },
      { id: "leg-2093-2", sequenceNo: 2, legType: "AIR", origin: "Wellington Airport Cargo", destination: "Singapore Changi Cargo", plannedDepartureAt: "2026-11-03T12:30:00+13:00", plannedArrivalAt: "2026-11-03T19:45:00+08:00", airProviderName: "Pacific Livestock Air", airReference: "PLA-2093", airCapacityHorses: 4, equipmentDetails: "Two IATA horse stalls", notes: null },
    ],
  },
};

function pause(duration = 220) { return new Promise<void>((resolve) => window.setTimeout(resolve, duration)); }
function scenario() { return new URLSearchParams(window.location.search).get("scenario"); }
function currentCoordinator() { return typeof window === "undefined" ? { id: DEFAULT_PREVIEW_COORDINATOR_ID, name: "Jordan Ellis" } : getPreviewCoordinatorIdentity(window.location.search); }
function clonePlan(plan: RoutePlanDetail): RoutePlanDetail { return { ...plan, legs: plan.legs.map((leg) => ({ ...leg })), validationIssues: plan.validationIssues.map((issue) => ({ ...issue })) }; }
function maybeThrowReadFailure() { if (scenario() === "failure") throw new CoordinatorWorkspaceError("We couldn't load your assigned planning Orders. Check your connection and try again.", "REQUEST_FAILED"); }

function assignedOrder(orderId: string) {
  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order) throw new CoordinatorWorkspaceError("This assigned planning Order is no longer available.", "NOT_FOUND");
  const assignment = readPreviewAssignmentRecipients()[order.id];
  if (!assignment || assignment.fleetRouteCoordinatorId !== currentCoordinator().id) throw new CoordinatorWorkspaceError("This Order is assigned to another Fleet & Route Coordinator.", "FORBIDDEN");
  return { order, assignment };
}

function detailFor(order: MockCoordinatorOrder, statusOverride?: RoutePlanStatus) {
  const { assignment } = assignedOrder(order.id);
  const routePlanStatus = statusOverride ?? order.routePlanStatus;
  const readOnly = routePlanStatus === "PENDING_LM_REVIEW" || routePlanStatus === "APPROVED";
  return {
    ...order, routePlanStatus, routePlanUpdatedAt: statusOverride ? new Date().toISOString() : order.routePlanUpdatedAt,
    assignedAt: assignment.assignedAt, assignedTransportSpecialistName: assignment.transportSpecialistName,
    assignedFleetRouteCoordinatorId: assignment.fleetRouteCoordinatorId, assignedFleetRouteCoordinatorName: assignment.fleetRouteCoordinatorName,
    readOnly,
    readiness: [
      { id: "assignment", label: "Staff assigned", description: "The Order is assigned to you and a Transport Specialist.", state: "complete" as const },
      { id: "documents", label: "Documents Final Confirmed", description: "The Document Phase is approved and permanently locked.", state: "complete" as const },
      { id: "payment", label: "Remaining Balance paid", description: "The persisted payment record is confirmed as paid.", state: "complete" as const },
      { id: "route-plan", label: routePlanStatus === "NOT_STARTED" ? "Route Plan not started" : `Route Plan ${routePlanStatus.toLowerCase().replaceAll("_", " ")}`, description: readOnly ? routePlanStatus === "APPROVED" ? "The approved Route Plan is permanently locked." : "The plan is locked while Logistics Manager review is pending." : routePlanStatus === "RETURNED" ? "Review the Logistics Manager's return reason before revising the plan." : "Planning context is ready for Route Plan work.", state: readOnly ? "locked" as const : "current" as const },
    ],
  };
}

function summaryFor(order: MockCoordinatorOrder): AssignedCoordinatorOrderSummary { return { id: order.id, orderCode: order.orderCode, origin: order.origin, destination: order.destination, requestedDepartureAt: order.requestedDepartureAt, horseCount: order.horseCount, transportMode: order.transportMode, routePlanStatus: order.routePlanStatus, routePlanUpdatedAt: order.routePlanUpdatedAt, returnReason: order.returnReason }; }
function planFor(orderId: string) { assignedOrder(orderId); const plan = planStore[orderId]; if (!plan) throw new CoordinatorWorkspaceError("The Route Plan is no longer available.", "NOT_FOUND"); const override = scenario() === "readonly" ? "PENDING_LM_REVIEW" : scenario() === "approved" ? "APPROVED" : undefined; return clonePlan(override ? { ...plan, status: override, readOnly: true } : plan); }
function assertEditable(orderId: string) { const plan = planFor(orderId); if (scenario() === "locked" || plan.readOnly || !["NOT_STARTED", "DRAFT", "RETURNED"].includes(plan.status)) throw new CoordinatorWorkspaceError("This Route Plan is locked because its saved state changed. Refresh to see the latest result.", "LOCKED"); return planStore[orderId]; }
function persist(orderId: string, changes: Partial<RoutePlanDetail>) { const current = planStore[orderId]; const now = new Date().toISOString(); const next = { ...current, ...changes, id: current.id ?? `plan-${orderId.replace("order-", "")}`, revision: current.revision + 1, updatedAt: now }; planStore[orderId] = next; const order = orders.find((candidate) => candidate.id === orderId)!; order.routePlanStatus = next.status; order.routePlanUpdatedAt = now; order.returnReason = next.returnedReason; return clonePlan(next); }

export const mockFleetRouteCoordinatorService: FleetRouteCoordinatorService = {
  async listAssignedActionableOrders() { await pause(); maybeThrowReadFailure(); if (scenario() === "empty") return { orders: [] }; const assignments = readPreviewAssignmentRecipients(); const coordinator = currentCoordinator(); return { orders: orders.filter((order) => assignments[order.id]?.fleetRouteCoordinatorId === coordinator.id).filter((order) => ["NOT_STARTED", "DRAFT", "RETURNED"].includes(order.routePlanStatus)).map(summaryFor) }; },
  async getAssignedPlanningContext(orderId: string) { await pause(); maybeThrowReadFailure(); if (scenario() === "stale") throw new CoordinatorWorkspaceError("This Route Plan state changed while the page was open. Return to the queue and open the latest planning context.", "STALE_STATE"); if (orderId === "order-unassigned") throw new CoordinatorWorkspaceError("This Order is assigned to another Fleet & Route Coordinator.", "FORBIDDEN"); if (scenario() === "unavailable") throw new CoordinatorWorkspaceError("This assigned planning Order is no longer available.", "NOT_FOUND"); const { order } = assignedOrder(orderId); const statusOverride = scenario() === "readonly" ? "PENDING_LM_REVIEW" : scenario() === "approved" ? "APPROVED" : undefined; return detailFor(order, statusOverride); },
  async getRoutePlan(orderId: string) { await pause(); maybeThrowReadFailure(); if (scenario() === "plan-failure") throw new CoordinatorWorkspaceError("We couldn't load the saved Route Plan. Try again.", "REQUEST_FAILED"); return planFor(orderId); },
  async saveRouteLeg(orderId: string, input: RouteLegInput, legId?: string) { await pause(); const plan = assertEditable(orderId); const normalized = input.legType === "ROAD" ? { ...input, airProviderName: null, airReference: null, airCapacityHorses: null } : input; const legs = plan.legs.map((leg) => ({ ...leg })); if (legId) { const index = legs.findIndex((leg) => leg.id === legId); if (index < 0) throw new CoordinatorWorkspaceError("This leg changed while you were editing. Refresh the Route Plan.", "STALE_STATE"); legs[index] = { ...legs[index], ...normalized }; } else legs.push({ ...normalized, id: `leg-${orderId}-${Date.now()}`, sequenceNo: legs.length + 1 }); return persist(orderId, { status: plan.status === "NOT_STARTED" ? "DRAFT" : plan.status, legs, validationIssues: [] }); },
  async deleteRouteLeg(orderId: string, legId: string) { await pause(); const plan = assertEditable(orderId); if (!plan.legs.some((leg) => leg.id === legId)) throw new CoordinatorWorkspaceError("This leg was already removed. Refresh the Route Plan.", "STALE_STATE"); return persist(orderId, { legs: plan.legs.filter((leg) => leg.id !== legId).map((leg, index) => ({ ...leg, sequenceNo: index + 1 })), validationIssues: [] }); },
  async moveRouteLeg(orderId: string, legId: string, direction: "UP" | "DOWN") { await pause(); const plan = assertEditable(orderId); const legs = plan.legs.map((leg) => ({ ...leg })); const index = legs.findIndex((leg) => leg.id === legId); const target = direction === "UP" ? index - 1 : index + 1; if (index < 0) throw new CoordinatorWorkspaceError("This leg changed while you were reordering. Refresh the Route Plan.", "STALE_STATE"); if (target < 0 || target >= legs.length) return clonePlan(plan); [legs[index], legs[target]] = [legs[target], legs[index]]; return persist(orderId, { legs: legs.map((leg, position) => ({ ...leg, sequenceNo: position + 1 })), validationIssues: [] }); },
  async validateRoutePlan(orderId: string) { await pause(); const plan = assertEditable(orderId); let validationIssues: RoutePlanValidationIssue[] = plan.legs.length === 0 ? [{ code: "PLAN_REQUIRES_LEG", message: "Add at least one leg before submitting the Route Plan.", severity: "ERROR", legId: null, field: null }] : []; if (scenario() === "validation" && plan.legs[1]) validationIssues = [{ code: "AIR_CAPACITY_TOO_LOW", message: "AIR capacity must cover every horse on the Order.", severity: "ERROR", legId: plan.legs[1].id, field: "airCapacityHorses" }, { code: "LEG_CONTINUITY", message: "This leg origin must match the previous leg destination.", severity: "ERROR", legId: plan.legs[1].id, field: "origin" }]; return persist(orderId, { validationIssues }); },
  async submitRoutePlan(orderId: string) { await pause(); const plan = assertEditable(orderId); const issues: RoutePlanValidationIssue[] = plan.legs.length === 0 ? [{ code: "PLAN_REQUIRES_LEG", message: "Add at least one leg before submitting the Route Plan.", severity: "ERROR", legId: null, field: null }] : scenario() === "validation" && plan.legs[1] ? [{ code: "AIR_CAPACITY_TOO_LOW", message: "AIR capacity must cover every horse on the Order.", severity: "ERROR", legId: plan.legs[1].id, field: "airCapacityHorses" }] : []; if (issues.length) { persist(orderId, { validationIssues: issues }); throw new CoordinatorWorkspaceError("The saved Route Plan has validation errors. Review them and try again.", "VALIDATION_FAILED"); } return persist(orderId, { status: "PENDING_LM_REVIEW", readOnly: true, returnedReason: null, validationIssues: [] }); },
};
