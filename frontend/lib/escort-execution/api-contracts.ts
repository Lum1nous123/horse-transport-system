import {
  EscortExecutionError,
  type ExecutionStatus,
  type ProofOfDelivery,
  type RouteLegStatus,
  type WelfareEvidence,
  type WelfareEventType,
} from "./types";

export type ApiErrorDto = {
  code?: string;
  message?: string;
  timestamp?: string;
};

export type BackendOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "QUOTATION_SENT"
  | "APPROVED"
  | "READY_TO_SHIP"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

export type AirExecutionResponseDto = {
  id: string;
  routeLegId: string;
  escortId: string;
  status: ExecutionStatus;
  startedAt: string | null;
  destinationArrivedAt: string | null;
  completedAt: string | null;
};

export type WelfareEvidenceResponseDto = {
  id: string;
  roadVehicleExecutionId: string | null;
  airLegExecutionId: string | null;
  checkpointId: string | null;
  eventType: WelfareEventType;
  photoUrl: string;
  note: string;
  recordedByEscortId: string;
  recordedAt: string;
};

export type ProofOfDeliveryResponseDto = {
  id: string;
  roadVehicleExecutionId: string | null;
  airLegExecutionId: string | null;
  routeLegId: string;
  transportedOrderHorseIds: string[];
  recipientName: string;
  proofPhotoUrl: string;
  handoverNote: string | null;
  confirmedByEscortId: string;
  deliveredAt: string;
  createdAt: string;
  completedHandovers: number;
  requiredHandovers: number;
  routeLegStatus: RouteLegStatus;
  orderStatus: BackendOrderStatus;
};

type RecordValue = Record<string, unknown>;

function malformed(contract: string): never {
  throw new EscortExecutionError(
    `The ${contract} response did not match the reviewed Backend contract.`,
    "REQUEST_FAILED",
  );
}

function record(value: unknown, contract: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return malformed(contract);
  return value as RecordValue;
}

function stringValue(value: unknown, contract: string): string {
  if (typeof value !== "string" || !value) return malformed(contract);
  return value;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;

function uuidValue(value: unknown, contract: string): string {
  const candidate = stringValue(value, contract);
  if (!uuidPattern.test(candidate)) return malformed(contract);
  return candidate;
}

function nullableUuid(value: unknown, contract: string): string | null {
  if (value === null) return null;
  return uuidValue(value, contract);
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function localDateTimeValue(value: unknown, contract: string): string {
  const candidate = stringValue(value, contract);
  const match = localDateTimePattern.exec(candidate);
  if (!match) return malformed(contract);

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12
      || day < 1 || day > daysInMonth[month - 1]
      || hour > 23 || minute > 59 || second > 59) {
    return malformed(contract);
  }
  return candidate;
}

function nullableLocalDateTime(value: unknown, contract: string): string | null {
  if (value === null) return null;
  return localDateTimeValue(value, contract);
}

function mediaUrlValue(value: unknown, contract: string): string {
  const candidate = stringValue(value, contract);
  if (candidate.trim() !== candidate || /[\u0000-\u001f\u007f]/.test(candidate)) return malformed(contract);
  try {
    const parsed = new URL(candidate, "https://backend.invalid/");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return malformed(contract);
  } catch {
    return malformed(contract);
  }
  return candidate;
}

function nullableString(value: unknown, contract: string): string | null {
  if (value === null) return null;
  return stringValue(value, contract);
}

function nonNegativeInteger(value: unknown, contract: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) return malformed(contract);
  return value as number;
}

function stringArray(value: unknown, contract: string): string[] {
  if (!Array.isArray(value)) {
    return malformed(contract);
  }
  return value.map((item) => uuidValue(item, contract));
}

const executionStatuses: ExecutionStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DESTINATION", "COMPLETED"];
const routeLegStatuses: RouteLegStatus[] = ["PLANNED", "READY", "IN_PROGRESS", "COMPLETED"];
const welfareEventTypes: WelfareEventType[] = ["CHECKPOINT", "FINAL_DESTINATION"];
const orderStatuses: BackendOrderStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "QUOTATION_SENT",
  "APPROVED",
  "READY_TO_SHIP",
  "IN_PROGRESS",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
];

function enumValue<T extends string>(value: unknown, values: T[], contract: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) return malformed(contract);
  return value as T;
}

export function parseAirExecutionResponse(
  value: unknown,
  expectedRouteLegId: string,
): AirExecutionResponseDto {
  const contract = "AIR execution";
  const source = record(value, contract);
  const routeLegId = uuidValue(source.routeLegId, contract);
  if (routeLegId !== expectedRouteLegId) return malformed(contract);
  return {
    id: uuidValue(source.id, contract),
    routeLegId,
    escortId: uuidValue(source.escortId, contract),
    status: enumValue(source.status, executionStatuses, contract),
    startedAt: nullableLocalDateTime(source.startedAt, contract),
    destinationArrivedAt: nullableLocalDateTime(source.destinationArrivedAt, contract),
    completedAt: nullableLocalDateTime(source.completedAt, contract),
  };
}

type WelfareContext =
  | { mode: "ROAD"; eventType: WelfareEventType; checkpointId: string | null; originalPhotoName: string }
  | { mode: "AIR"; eventType: "FINAL_DESTINATION"; checkpointId: null; originalPhotoName: string };

export function parseWelfareEvidenceResponse(
  value: unknown,
  context: WelfareContext,
): WelfareEvidence {
  const contract = `${context.mode} welfare evidence`;
  const source = record(value, contract);
  const dto: WelfareEvidenceResponseDto = {
    id: uuidValue(source.id, contract),
    roadVehicleExecutionId: nullableUuid(source.roadVehicleExecutionId, contract),
    airLegExecutionId: nullableUuid(source.airLegExecutionId, contract),
    checkpointId: nullableUuid(source.checkpointId, contract),
    eventType: enumValue(source.eventType, welfareEventTypes, contract),
    photoUrl: mediaUrlValue(source.photoUrl, contract),
    note: stringValue(source.note, contract),
    recordedByEscortId: uuidValue(source.recordedByEscortId, contract),
    recordedAt: localDateTimeValue(source.recordedAt, contract),
  };

  const correctExecutionOwner = context.mode === "ROAD"
    ? Boolean(dto.roadVehicleExecutionId) && dto.airLegExecutionId === null
    : dto.roadVehicleExecutionId === null && Boolean(dto.airLegExecutionId);
  if (!correctExecutionOwner || dto.eventType !== context.eventType || dto.checkpointId !== context.checkpointId) {
    return malformed(contract);
  }

  return {
    id: dto.id,
    eventType: dto.eventType,
    checkpointId: dto.checkpointId,
    photoUrl: dto.photoUrl,
    photoName: context.originalPhotoName,
    note: dto.note,
    recordedAt: dto.recordedAt,
  };
}

type ProofContext =
  | { mode: "ROAD"; roadLegVehicleId: string; originalPhotoName: string }
  | { mode: "AIR"; routeLegId: string; originalPhotoName: string };

export function parseProofOfDeliveryResponse(
  value: unknown,
  context: ProofContext,
): ProofOfDelivery {
  const contract = `${context.mode} Proof of Delivery`;
  const source = record(value, contract);
  const dto: ProofOfDeliveryResponseDto = {
    id: uuidValue(source.id, contract),
    roadVehicleExecutionId: nullableUuid(source.roadVehicleExecutionId, contract),
    airLegExecutionId: nullableUuid(source.airLegExecutionId, contract),
    routeLegId: uuidValue(source.routeLegId, contract),
    transportedOrderHorseIds: stringArray(source.transportedOrderHorseIds, contract),
    recipientName: stringValue(source.recipientName, contract),
    proofPhotoUrl: mediaUrlValue(source.proofPhotoUrl, contract),
    handoverNote: nullableString(source.handoverNote, contract),
    confirmedByEscortId: uuidValue(source.confirmedByEscortId, contract),
    deliveredAt: localDateTimeValue(source.deliveredAt, contract),
    createdAt: localDateTimeValue(source.createdAt, contract),
    completedHandovers: nonNegativeInteger(source.completedHandovers, contract),
    requiredHandovers: nonNegativeInteger(source.requiredHandovers, contract),
    routeLegStatus: enumValue(source.routeLegStatus, routeLegStatuses, contract),
    orderStatus: enumValue(source.orderStatus, orderStatuses, contract),
  };

  if (dto.completedHandovers > dto.requiredHandovers
      || (dto.orderStatus !== "IN_PROGRESS" && dto.orderStatus !== "DELIVERED")) {
    return malformed(contract);
  }

  const base = {
    id: dto.id,
    routeLegId: dto.routeLegId,
    transportedOrderHorseIds: dto.transportedOrderHorseIds,
    recipientName: dto.recipientName,
    proofPhotoUrl: dto.proofPhotoUrl,
    proofPhotoName: context.originalPhotoName,
    handoverNote: dto.handoverNote,
    confirmedByEscortId: dto.confirmedByEscortId,
    deliveredAt: dto.deliveredAt,
    completedHandovers: dto.completedHandovers,
    requiredHandovers: dto.requiredHandovers,
    routeLegStatus: dto.routeLegStatus,
    orderStatus: dto.orderStatus,
  };

  if (context.mode === "ROAD") {
    if (!dto.roadVehicleExecutionId || dto.airLegExecutionId !== null) return malformed(contract);
    return {
      ...base,
      mode: "ROAD",
      roadLegVehicleId: context.roadLegVehicleId,
      roadVehicleExecutionId: dto.roadVehicleExecutionId,
    };
  }

  if (!dto.airLegExecutionId || dto.roadVehicleExecutionId !== null || dto.routeLegId !== context.routeLegId) {
    return malformed(contract);
  }
  return {
    ...base,
    mode: "AIR",
    airLegExecutionId: dto.airLegExecutionId,
  };
}
