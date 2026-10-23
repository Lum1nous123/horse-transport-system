import type { JourneyNotification, JourneyTracking } from "./types";

// Development-only sample. Never returned by a production service path.
export const previewTracking: JourneyTracking = {
  orderId: "order-2068",
  orderCode: "ORD-2068",
  orderStatus: "IN_PROGRESS",
  origin: "Lexington, United States",
  destination: "Brussels, Belgium",
  updatedAt: "2026-10-23T15:10:00+07:00",
  legs: [
    {
      id: "road-outbound", sequenceNo: 1, mode: "ROAD", origin: "Lexington, United States", destination: "Chicago O'Hare Cargo Terminal",
      status: "COMPLETED", horses: ["Apollo", "Bella", "Commander", "Dakota"], events: [], welfareEvidence: [],
      vehicles: [{
        id: "vehicle-27", label: "TRK-101", status: "COMPLETED", horses: ["Apollo", "Bella"],
        driver: { name: "Daniel Foster", phone: "+31 6 1234 5678" },
        escort: { name: "Maya Chen", phone: null },
        checkpoints: [
          { id: "departure", label: "Departed stable", reachedAt: "2026-10-22T08:15:00+07:00", photoUrl: null, note: null },
          { id: "welfare-a", label: "Welfare stop A", reachedAt: "2026-10-22T10:42:00+07:00", photoUrl: null, note: "Welfare check recorded" },
          { id: "airport", label: "Arrived Chicago", reachedAt: "2026-10-22T12:30:00+07:00", photoUrl: null, note: null },
        ],
      }, {
        id: "vehicle-28", label: "TRK-102", status: "COMPLETED", horses: ["Commander", "Dakota"],
        driver: { name: "Alex Rivera", phone: null }, escort: { name: "Sam Lee", phone: "+1 555 0188" },
        checkpoints: [
          { id: "departure-2", label: "Departed stable", reachedAt: "2026-10-22T08:32:00+07:00", photoUrl: null, note: null },
          { id: "welfare-2", label: "Welfare stop A", reachedAt: "2026-10-22T11:05:00+07:00", photoUrl: null, note: "Welfare check recorded" },
          { id: "airport-2", label: "Arrived Chicago", reachedAt: "2026-10-22T13:00:00+07:00", photoUrl: null, note: null },
        ],
      }],
    },
    {
      id: "air", sequenceNo: 2, mode: "AIR", origin: "Chicago O'Hare Cargo Terminal", destination: "Brussels Airport Cargo",
      status: "IN_PROGRESS", horses: ["Apollo", "Bella", "Commander", "Dakota"], vehicles: [], welfareEvidence: [
        { id: "air-welfare", recordedAt: "2026-10-23T15:10:00+07:00", note: "Air leg welfare check recorded", photoUrl: null },
      ],
      events: [{ id: "flight-start", label: "Flight leg started", occurredAt: "2026-10-23T14:35:00+07:00" }],
    },
    {
      id: "road-final", sequenceNo: 3, mode: "ROAD", origin: "Brussels Airport Cargo", destination: "Brussels, Belgium",
      status: "UPCOMING", horses: ["Apollo", "Bella", "Commander", "Dakota"], events: [], welfareEvidence: [],
      vehicles: [{
        id: "vehicle-final", label: "BE-210", status: "UPCOMING", horses: ["Apollo", "Bella", "Commander", "Dakota"],
        driver: { name: "Assigned driver", phone: null }, escort: { name: "Assigned escort", phone: null },
        checkpoints: [
          { id: "airport-departure", label: "Departed Brussels Airport", reachedAt: null, photoUrl: null, note: null },
          { id: "welfare-b", label: "Welfare stop B", reachedAt: null, photoUrl: null, note: null },
          { id: "destination", label: "Arrived Brussels", reachedAt: null, photoUrl: null, note: null },
        ],
      }],
    },
  ],
  deliveryEvents: [],
};

export const previewNotifications: JourneyNotification[] = [
  { id: "air-welfare", title: "Welfare evidence added", message: "An air leg welfare check was recorded.", createdAt: "2026-10-23T15:10:00+07:00", readAt: null },
  { id: "flight", title: "Flight leg started", message: "The air leg is in progress.", createdAt: "2026-10-23T14:35:00+07:00", readAt: null },
  { id: "welfare", title: "Welfare evidence added", message: "A welfare check was recorded for Apollo and Bella.", createdAt: "2026-10-22T10:42:00+07:00", readAt: null },
  { id: "payment", title: "Remaining balance paid", message: "Your remaining balance payment was received.", createdAt: "2026-10-22T09:18:00+07:00", readAt: null },
];

export function previewJourneyScenario(scenario: string | null): { tracking: JourneyTracking; notifications: JourneyNotification[] } {
  if (scenario === "empty") return { tracking: { ...previewTracking, legs: [], deliveryEvents: [] }, notifications: [] };
  if (scenario === "refund") return {
    tracking: { ...previewTracking, orderStatus: "CANCELLED", legs: [], deliveryEvents: [], updatedAt: "2026-10-23T16:00:00+07:00" },
    notifications: [{ id: "refund", title: "Deposit refunded", message: "Your full deposit refund has been recorded.", createdAt: "2026-10-23T16:00:00+07:00", readAt: null }],
  };
  if (scenario === "delivered") {
    const deliveredAt = "2026-10-23T18:00:00+07:00";
    return {
      tracking: {
        ...previewTracking, orderStatus: "DELIVERED", updatedAt: deliveredAt,
        legs: previewTracking.legs.map((leg) => ({
          ...leg, status: "COMPLETED",
          vehicles: leg.vehicles.map((vehicle) => ({
            ...vehicle, status: "COMPLETED",
            checkpoints: vehicle.checkpoints.map((point) => ({ ...point, reachedAt: point.reachedAt ?? deliveredAt })),
          })),
          events: leg.mode === "AIR" ? [...leg.events, { id: "air-arrival", label: "Arrived Brussels Airport", occurredAt: "2026-10-23T16:30:00+07:00" }] : leg.events,
        })),
        deliveryEvents: [{ id: "pod-be-210", label: "Proof of Delivery recorded for BE-210", occurredAt: deliveredAt }],
      },
      notifications: [{ id: "delivered", title: "Order delivered", message: "Final handover is complete.", createdAt: deliveredAt, readAt: null }, ...previewNotifications],
    };
  }
  return { tracking: previewTracking, notifications: previewNotifications };
}
