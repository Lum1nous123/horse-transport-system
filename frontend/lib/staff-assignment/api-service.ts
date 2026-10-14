import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import {
  AssignmentServiceError,
  type AssignedPair,
  type AssignmentCandidate,
  type AssignmentOrderDetail,
  type AssignmentOrderSummary,
  type AssignmentQueues,
  type AssignStaffInput,
  type StaffAssignmentService,
  type StaffRole,
} from "./types";

type ApiError = { message?: string };

type AssignmentInboxItem = {
  id: string;
  orderCode: string;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  requestedDepartureAt: string;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  horseCount: number;
};

type OrderResponse = AssignmentInboxItem & {
  horseIds: string[];
};

type StaffCandidateApiResponse = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  activeOrderCount: number;
};

type StaffAssignmentApiResponse = {
  role: StaffRole;
  userId: string;
  fullName: string;
  email: string;
  activeOrderCount: number;
  assignedAt: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new AssignmentServiceError("Your session has expired. Sign in again.", "FORBIDDEN");

  let response: Response;
  try {
    response = await apiFetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new AssignmentServiceError("We couldn't reach the assignment service. Try again.", "REQUEST_FAILED");
  }

  if (response.ok) return await response.json() as T;

  let message = "We couldn't complete the assignment request.";
  try {
    const error = await response.json() as ApiError;
    if (error.message) message = error.message;
  } catch {
    // Keep the stable fallback when the backend response has no JSON body.
  }

  if (response.status === 401) {
    clearAccessToken();
    throw new AssignmentServiceError("Your session has expired. Sign in again.", "FORBIDDEN");
  }
  if (response.status === 403) throw new AssignmentServiceError(message, "FORBIDDEN");
  if (response.status === 404) throw new AssignmentServiceError(message, "NOT_FOUND");
  if (response.status === 409) throw new AssignmentServiceError(message, "STALE_STATE");
  if (response.status === 400) throw new AssignmentServiceError(message, "VALIDATION_ERROR");
  throw new AssignmentServiceError(message, "REQUEST_FAILED");
}

function location(address: string | null, country: string | null): string {
  return [address, country].filter(Boolean).join(", ") || "Not provided";
}

function summary(item: AssignmentInboxItem, assignmentStatus: "NEEDS_ASSIGNMENT" | "ASSIGNED"): AssignmentOrderSummary {
  return {
    id: item.id,
    orderCode: item.orderCode,
    origin: location(item.originAddress, item.originCountry),
    destination: location(item.destinationAddress, item.destinationCountry),
    requestedDepartureAt: item.requestedDepartureAt,
    horseCount: item.horseCount,
    transportMode: item.transportMode,
    assignmentStatus,
  };
}

function candidate(response: StaffCandidateApiResponse): AssignmentCandidate {
  return { ...response };
}

function assignedPair(assignments: StaffAssignmentApiResponse[]): AssignedPair | null {
  const transportSpecialist = assignments.find((item) => item.role === "TRANSPORT_SPECIALIST");
  const fleetRouteCoordinator = assignments.find((item) => item.role === "FLEET_ROUTE_COORDINATOR");
  if (!transportSpecialist || !fleetRouteCoordinator) return null;

  return {
    transportSpecialist: {
      id: transportSpecialist.userId,
      fullName: transportSpecialist.fullName,
      email: transportSpecialist.email,
      role: transportSpecialist.role,
      activeOrderCount: transportSpecialist.activeOrderCount,
    },
    fleetRouteCoordinator: {
      id: fleetRouteCoordinator.userId,
      fullName: fleetRouteCoordinator.fullName,
      email: fleetRouteCoordinator.email,
      role: fleetRouteCoordinator.role,
      activeOrderCount: fleetRouteCoordinator.activeOrderCount,
    },
    assignedAt: assignments.map((item) => item.assignedAt).sort().at(-1) ?? transportSpecialist.assignedAt,
  };
}

export const apiStaffAssignmentService: StaffAssignmentService = {
  async listOrders(): Promise<AssignmentQueues> {
    const [needsAssignment, assigned] = await Promise.all([
      requestJson<AssignmentInboxItem[]>("/api/v1/orders/assignment-inbox?state=NEEDS_ASSIGNMENT"),
      requestJson<AssignmentInboxItem[]>("/api/v1/orders/assignment-inbox?state=ASSIGNED"),
    ]);
    return {
      needsAssignment: needsAssignment.map((item) => summary(item, "NEEDS_ASSIGNMENT")),
      assigned: assigned.map((item) => summary(item, "ASSIGNED")),
    };
  },

  async getOrder(orderId: string): Promise<AssignmentOrderDetail> {
    const [order, assignments] = await Promise.all([
      requestJson<OrderResponse>(`/api/v1/orders/${orderId}`),
      requestJson<StaffAssignmentApiResponse[]>(`/api/v1/orders/${orderId}/staff-assignments`),
    ]);
    const savedPair = assignedPair(assignments);
    const [transportSpecialists, fleetRouteCoordinators] = savedPair
      ? [[], []]
      : await Promise.all([
          requestJson<StaffCandidateApiResponse[]>(`/api/v1/orders/${orderId}/assignment-candidates?role=TRANSPORT_SPECIALIST`),
          requestJson<StaffCandidateApiResponse[]>(`/api/v1/orders/${orderId}/assignment-candidates?role=FLEET_ROUTE_COORDINATOR`),
        ]);

    return {
      ...summary({ ...order, horseCount: order.horseIds.length }, savedPair ? "ASSIGNED" : "NEEDS_ASSIGNMENT"),
      customerName: "",
      candidates: {
        transportSpecialists: transportSpecialists.map(candidate),
        fleetRouteCoordinators: fleetRouteCoordinators.map(candidate),
      },
      assignedPair: savedPair,
    };
  },

  async assignStaff(orderId: string, input: AssignStaffInput): Promise<void> {
    await requestJson<StaffAssignmentApiResponse[]>(`/api/v1/orders/${orderId}/staff-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
