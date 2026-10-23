export type JourneyCheckpoint = {
  id: string;
  label: string;
  reachedAt: string | null;
  photoUrl: string | null;
  note: string | null;
};

export type JourneyVehicle = {
  id: string;
  label: string;
  status: "UPCOMING" | "READY" | "IN_PROGRESS" | "COMPLETED";
  horses: string[];
  driver: { name: string; phone: string | null } | null;
  escort: { name: string; phone: string | null } | null;
  checkpoints: JourneyCheckpoint[];
};

export type JourneyLeg = {
  id: string;
  sequenceNo: number;
  mode: "ROAD" | "AIR";
  origin: string;
  destination: string;
  status: "UPCOMING" | "READY" | "IN_PROGRESS" | "COMPLETED";
  horses: string[];
  vehicles: JourneyVehicle[];
  events: { id: string; label: string; occurredAt: string | null }[];
  welfareEvidence: { id: string; recordedAt: string; note: string | null; photoUrl: string | null }[];
};

export type JourneyTracking = {
  orderId: string;
  orderCode: string;
  orderStatus: string;
  origin: string;
  destination: string;
  updatedAt: string | null;
  legs: JourneyLeg[];
  deliveryEvents: { id: string; label: string; occurredAt: string }[];
};

export type JourneyNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};
