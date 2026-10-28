import { apiFetch } from "@/lib/api";
import type { JourneyLeg, JourneyNotification, JourneyTracking, JourneyVehicle } from "./types";

export class JourneyReadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type JsonObject = Record<string, unknown>;

function contractError(): never {
  throw new JourneyReadError("Journey tracking data is unavailable.", 200);
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return contractError();
  return value as JsonObject;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return contractError();
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value) return contractError();
  return value;
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return text(value);
}

function timestamp(value: unknown): string | null {
  const candidate = nullableText(value);
  if (candidate !== null && Number.isNaN(Date.parse(candidate))) return contractError();
  return candidate;
}

function executionStatus(value: unknown, ready: boolean): JourneyVehicle["status"] {
  if (value === null || value === undefined || value === "NOT_STARTED") return ready ? "READY" : "UPCOMING";
  if (value === "IN_PROGRESS" || value === "DESTINATION") return "IN_PROGRESS";
  if (value === "COMPLETED") return "COMPLETED";
  return contractError();
}

function legStatus(value: unknown): JourneyLeg["status"] {
  if (value === "PLANNED") return "UPCOMING";
  if (value === "READY" || value === "IN_PROGRESS" || value === "COMPLETED") return value;
  return contractError();
}

function contact(value: unknown): JourneyVehicle["driver"] {
  if (value === null || value === undefined) return null;
  const source = object(value);
  return { name: text(source.fullName), phone: nullableText(source.phone) };
}

function horseNames(value: unknown): string[] {
  return array(value).map((item) => text(object(item).name));
}

function welfare(value: unknown) {
  if (value === null || value === undefined) return null;
  const source = object(value);
  return {
    id: text(source.id),
    recordedAt: timestamp(source.recordedAt) ?? contractError(),
    note: nullableText(source.note),
    photoUrl: nullableText(source.photoUrl),
  };
}

function roadVehicle(value: unknown, ready: boolean): JourneyVehicle {
  const source = object(value);
  const plateNumber = text(source.plateNumber);
  return {
    id: text(source.roadLegVehicleId),
    label: plateNumber,
    status: executionStatus(source.executionStatus, ready),
    horses: horseNames(source.horses),
    driver: contact(source.driver),
    escort: contact(source.escort),
    checkpoints: array(source.checkpoints).map((item) => {
      const checkpoint = object(item);
      const evidence = welfare(checkpoint.welfare);
      return {
        id: text(checkpoint.checkpointId),
        label: text(checkpoint.name),
        reachedAt: timestamp(checkpoint.arrivedAt),
        photoUrl: evidence?.photoUrl ?? null,
        note: evidence?.note ?? null,
      };
    }),
  };
}

function event(id: string, label: string, occurredAt: string | null) {
  return { id, label, occurredAt };
}

function maxTimestamp(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).toSorted((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function mapTracking(value: unknown): JourneyTracking {
  const source = object(value);
  const rawLegs = array(source.legs).map(object);
  const allHorseNames = [...new Set(rawLegs.flatMap((leg) => array(leg.roadVehicles)
    .flatMap((vehicle) => horseNames(object(vehicle).horses))))];
  const deliveryEvents: JourneyTracking["deliveryEvents"] = [];
  const updateTimes: Array<string | null> = [timestamp(source.routePlanApprovedAt), timestamp(source.deliveredAt)];

  const legs: JourneyLeg[] = rawLegs.map((rawLeg) => {
    const id = text(rawLeg.routeLegId);
    const mode = rawLeg.type === "ROAD" || rawLeg.type === "AIR" ? rawLeg.type : contractError();
    const status = legStatus(rawLeg.status);
    const vehicles = array(rawLeg.roadVehicles).map((item) => roadVehicle(item, status === "READY"));
    const air = rawLeg.airExecution === null || rawLeg.airExecution === undefined ? null : object(rawLeg.airExecution);
    const events: JourneyLeg["events"] = [];
    const welfareEvidence: JourneyLeg["welfareEvidence"] = [];

    if (air) {
      const startedAt = timestamp(air.startedAt);
      const destinationArrivedAt = timestamp(air.destinationArrivedAt);
      const completedAt = timestamp(air.completedAt);
      updateTimes.push(startedAt, destinationArrivedAt, completedAt);
      if (startedAt) events.push(event(`${id}-started`, "AIR journey started", startedAt));
      if (destinationArrivedAt) events.push(event(`${id}-destination`, "AIR destination reached", destinationArrivedAt));
      if (completedAt) events.push(event(`${id}-completed`, "AIR execution completed", completedAt));
      const evidence = welfare(air.finalWelfare);
      if (evidence) {
        welfareEvidence.push(evidence);
        updateTimes.push(evidence.recordedAt);
      }
      if (air.proofOfDelivery) {
        const proof = object(air.proofOfDelivery);
        const deliveredAt = timestamp(proof.deliveredAt) ?? contractError();
        deliveryEvents.push({ id: text(proof.id), label: "Proof of Delivery recorded for AIR leg", occurredAt: deliveredAt });
        updateTimes.push(deliveredAt);
      }
    }

    array(rawLeg.roadVehicles).forEach((item) => {
      const vehicle = object(item);
      updateTimes.push(timestamp(vehicle.startedAt), timestamp(vehicle.destinationArrivedAt), timestamp(vehicle.completedAt));
      array(vehicle.checkpoints).forEach((point) => {
        const checkpoint = object(point);
        updateTimes.push(timestamp(checkpoint.arrivedAt));
        const evidence = welfare(checkpoint.welfare);
        if (evidence) updateTimes.push(evidence.recordedAt);
      });
      const finalWelfare = welfare(vehicle.finalWelfare);
      if (finalWelfare) {
        welfareEvidence.push(finalWelfare);
        updateTimes.push(finalWelfare.recordedAt);
      }
      if (vehicle.proofOfDelivery) {
        const proof = object(vehicle.proofOfDelivery);
        const deliveredAt = timestamp(proof.deliveredAt) ?? contractError();
        deliveryEvents.push({
          id: text(proof.id),
          label: `Proof of Delivery recorded for ${text(vehicle.plateNumber)}`,
          occurredAt: deliveredAt,
        });
        updateTimes.push(deliveredAt);
      }
    });

    return {
      id,
      sequenceNo: Number.isInteger(rawLeg.sequenceNo) ? rawLeg.sequenceNo as number : contractError(),
      mode,
      origin: text(rawLeg.origin),
      destination: text(rawLeg.destination),
      status,
      horses: mode === "ROAD" ? [...new Set(vehicles.flatMap((vehicle) => vehicle.horses))] : allHorseNames,
      vehicles,
      events,
      welfareEvidence,
    };
  });

  return {
    orderId: text(source.orderId),
    orderCode: text(source.orderCode),
    orderStatus: text(source.orderStatus),
    origin: [text(source.originAddress), nullableText(source.originCountry)].filter(Boolean).join(", "),
    destination: [text(source.destinationAddress), nullableText(source.destinationCountry)].filter(Boolean).join(", "),
    updatedAt: maxTimestamp(updateTimes),
    legs,
    deliveryEvents,
  };
}

async function read<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(path, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  } catch {
    throw new JourneyReadError("We couldn't reach the journey service. Try again.", 0);
  }
  if (response.status === 401) throw new JourneyReadError("Your session has expired.", 401);
  if (response.status === 403) throw new JourneyReadError("You can't view this journey.", 403);
  if (response.status === 404) throw new JourneyReadError("Journey tracking is not available yet for this Order.", 404);
  if (!response.ok) throw new JourneyReadError("We couldn't load journey tracking. Try again.", response.status);
  try { return await response.json() as T; }
  catch { throw new JourneyReadError("Journey tracking data is unavailable.", response.status); }
}

export async function readJourneyTracking(orderId: string, token: string): Promise<JourneyTracking> {
  const data = await read<unknown>(`/api/v1/orders/${encodeURIComponent(orderId)}/tracking`, token);
  return mapTracking(data);
}

export async function readJourneyNotifications(orderId: string, token: string): Promise<JourneyNotification[]> {
  const data = await read<JourneyNotification[]>(`/api/v1/orders/${encodeURIComponent(orderId)}/notifications`, token);
  if (!Array.isArray(data)) throw new JourneyReadError("In-app updates are unavailable.", 200);
  return data;
}
