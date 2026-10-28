import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";

export type TrackingOrderSummary = {
  orderId: string;
  orderCode: string;
  status: "APPROVED" | "READY_TO_SHIP" | "IN_PROGRESS" | "DELIVERED";
  originAddress: string;
  originCountry: string | null;
  destinationAddress: string;
  destinationCountry: string | null;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  requestedDepartureAt: string;
  horseCount: number;
  createdAt: string;
  deliveredAt: string | null;
};

export class TrackingOrderListError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function listLogisticsTrackingOrders(): Promise<TrackingOrderSummary[]> {
  const token = getAccessToken();
  if (!token) throw new TrackingOrderListError("Your session has expired.", 401);
  let response: Response;
  try {
    response = await apiFetch("/api/v1/lm/tracking-orders", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    throw new TrackingOrderListError("We couldn't reach Order Tracking. Try again.", 0);
  }
  if (response.status === 401) { clearAccessToken(); throw new TrackingOrderListError("Your session has expired.", 401); }
  if (response.status === 403) throw new TrackingOrderListError("You don't have permission to list tracking Orders.", 403);
  if (!response.ok) throw new TrackingOrderListError("We couldn't load tracking Orders. Try again.", response.status);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TrackingOrderListError("Order Tracking returned an unreadable response.", 200);
  return value as TrackingOrderSummary[];
}
