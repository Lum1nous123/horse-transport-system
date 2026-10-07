import {
  AssignmentServiceError,
  type AssignedPair,
  type AssignmentCandidate,
  type AssignmentOrderDetail,
  type AssignmentQueues,
  type AssignStaffInput,
  type StaffAssignmentService,
} from "./types";
import { PREVIEW_ASSIGNMENTS_STORAGE_KEY } from "@/lib/preview-workflow/assignment-bridge";

const STORAGE_KEY = PREVIEW_ASSIGNMENTS_STORAGE_KEY;

const transportSpecialists: AssignmentCandidate[] = [
  { id: "ts-alex-carter", fullName: "Alex Carter", email: "alex.carter@hts.example", role: "TRANSPORT_SPECIALIST", activeOrderCount: 2 },
  { id: "ts-brooke-mitchell", fullName: "Brooke Mitchell", email: "brooke.mitchell@hts.example", role: "TRANSPORT_SPECIALIST", activeOrderCount: 4 },
  { id: "ts-daniel-kim", fullName: "Daniel Kim", email: "daniel.kim@hts.example", role: "TRANSPORT_SPECIALIST", activeOrderCount: 1 },
  { id: "ts-emily-ross", fullName: "Emily Ross", email: "emily.ross@hts.example", role: "TRANSPORT_SPECIALIST", activeOrderCount: 3 },
];

const fleetRouteCoordinators: AssignmentCandidate[] = [
  { id: "frc-jordan-ellis", fullName: "Jordan Ellis", email: "jordan.ellis@hts.example", role: "FLEET_ROUTE_COORDINATOR", activeOrderCount: 3 },
  { id: "frc-taylor-nguyen", fullName: "Taylor Nguyen", email: "taylor.nguyen@hts.example", role: "FLEET_ROUTE_COORDINATOR", activeOrderCount: 2 },
  { id: "frc-riley-thomas", fullName: "Riley Thomas", email: "riley.thomas@hts.example", role: "FLEET_ROUTE_COORDINATOR", activeOrderCount: 4 },
  { id: "frc-avery-wilson", fullName: "Avery Wilson", email: "avery.wilson@hts.example", role: "FLEET_ROUTE_COORDINATOR", activeOrderCount: 1 },
];

const baseOrders: Omit<AssignmentOrderDetail, "assignmentStatus" | "assignedPair">[] = [
  {
    id: "order-2058",
    orderCode: "ORD-2058",
    origin: "Lexington, United States",
    destination: "Brussels, Belgium",
    requestedDepartureAt: "2026-10-19T09:00:00+07:00",
    horseCount: 3,
    transportMode: "COMBINED",
    customerName: "Morgan Taylor",
    candidates: { transportSpecialists, fleetRouteCoordinators },
  },
  {
    id: "order-2061",
    orderCode: "ORD-2061",
    origin: "Saumur, France",
    destination: "Amsterdam, Netherlands",
    requestedDepartureAt: "2026-10-22T08:30:00+07:00",
    horseCount: 1,
    transportMode: "ROAD",
    customerName: "Jordan Lee",
    candidates: { transportSpecialists, fleetRouteCoordinators },
  },
  {
    id: "order-2046",
    orderCode: "ORD-2046",
    origin: "Aachen, Germany",
    destination: "Doha, Qatar",
    requestedDepartureAt: "2026-10-16T13:00:00+07:00",
    horseCount: 2,
    transportMode: "AIR",
    customerName: "Casey Morgan",
    candidates: { transportSpecialists, fleetRouteCoordinators },
  },
];

const initialAssignments: Record<string, AssignedPair> = {
  "order-2046": {
    transportSpecialist: transportSpecialists[1],
    fleetRouteCoordinator: fleetRouteCoordinators[0],
    assignedAt: "2026-10-04T10:15:00+07:00",
  },
};

function pause() {
  return new Promise((resolve) => window.setTimeout(resolve, 220));
}

function readAssignments(): Record<string, AssignedPair> {
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return { ...initialAssignments };

  try {
    return JSON.parse(saved) as Record<string, AssignedPair>;
  } catch {
    throw new AssignmentServiceError(
      "We couldn't read the saved assignment data. Refresh the page and try again.",
      "REQUEST_FAILED",
    );
  }
}

function writeAssignments(assignments: Record<string, AssignedPair>) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

function findOrder(orderId: string) {
  const order = baseOrders.find((candidate) => candidate.id === orderId);
  if (!order) {
    throw new AssignmentServiceError(
      "This order is no longer available in Staff Assignment.",
      "NOT_FOUND",
    );
  }
  return order;
}

function detailFor(orderId: string, assignments: Record<string, AssignedPair>): AssignmentOrderDetail {
  const order = findOrder(orderId);
  const assignedPair = assignments[orderId] ?? null;
  return {
    ...order,
    assignmentStatus: assignedPair ? "ASSIGNED" : "NEEDS_ASSIGNMENT",
    assignedPair,
  };
}

export const mockStaffAssignmentService: StaffAssignmentService = {
  async listOrders(): Promise<AssignmentQueues> {
    await pause();
    const assignments = readAssignments();
    const orders = baseOrders.map((order) => detailFor(order.id, assignments));
    return {
      needsAssignment: orders.filter((order) => order.assignmentStatus === "NEEDS_ASSIGNMENT"),
      assigned: orders.filter((order) => order.assignmentStatus === "ASSIGNED"),
    };
  },

  async getOrder(orderId: string): Promise<AssignmentOrderDetail> {
    await pause();
    return detailFor(orderId, readAssignments());
  },

  async assignStaff(orderId: string, input: AssignStaffInput): Promise<void> {
    await pause();
    const order = findOrder(orderId);
    const assignments = readAssignments();
    if (assignments[orderId]) {
      throw new AssignmentServiceError(
        "This order was assigned in another session. We refreshed the saved assignment.",
        "STALE_STATE",
      );
    }

    const transportSpecialist = order.candidates.transportSpecialists.find(
      (candidate) => candidate.id === input.transportSpecialistId,
    );
    const fleetRouteCoordinator = order.candidates.fleetRouteCoordinators.find(
      (candidate) => candidate.id === input.fleetRouteCoordinatorId,
    );

    if (!transportSpecialist || !fleetRouteCoordinator) {
      throw new AssignmentServiceError(
        "Choose one Transport Specialist and one Fleet & Route Coordinator from the available candidates.",
        "VALIDATION_ERROR",
      );
    }

    assignments[orderId] = {
      transportSpecialist,
      fleetRouteCoordinator,
      assignedAt: new Date().toISOString(),
    };
    writeAssignments(assignments);
  },
};
