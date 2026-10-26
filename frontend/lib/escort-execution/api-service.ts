import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import {
  parseAirExecutionResponse,
  parseProofOfDeliveryResponse,
  parseWelfareEvidenceResponse,
  type AirExecutionResponseDto,
  type ApiErrorDto,
} from "./api-contracts";
import { assertValidEvidencePhoto } from "./media-validation";
import {
  EscortExecutionError,
  type ProofOfDelivery,
  type ProofOfDeliveryInput,
  type RecordAirWelfareInput,
  type RecordRoadWelfareInput,
  type WelfareEvidence,
} from "./types";

type JsonParser<T> = (value: unknown) => T;

function error(
  message: string,
  code: ConstructorParameters<typeof EscortExecutionError>[1],
  status?: number,
  apiCode?: string,
) {
  return new EscortExecutionError(message, code, { status, apiCode });
}

async function readApiError(response: Response): Promise<ApiErrorDto> {
  try {
    const value = await response.json() as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    return {
      code: typeof source.code === "string" ? source.code : undefined,
      message: typeof source.message === "string" ? source.message : undefined,
      timestamp: typeof source.timestamp === "string" ? source.timestamp : undefined,
    };
  } catch {
    return {};
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  parse: JsonParser<T>,
): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw error("Your session has expired. Sign in again.", "FORBIDDEN", 401, "SESSION_EXPIRED");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body instanceof FormData) headers.delete("Content-Type");

  let response: Response;
  try {
    response = await apiFetch(path, { ...init, headers });
  } catch {
    // Mutations are intentionally never retried: the server may have committed before the
    // client observed a network failure. A future GET contract must reconcile that state.
    throw error(
      "We couldn't confirm whether the Escort update was saved. Refresh the execution before trying again.",
      "REQUEST_FAILED",
      0,
      "NETWORK_ERROR",
    );
  }

  if (response.ok) {
    let value: unknown;
    try {
      value = await response.json() as unknown;
    } catch {
      throw error(
        "The Escort service returned an unreadable response.",
        "REQUEST_FAILED",
        response.status,
        "MALFORMED_RESPONSE",
      );
    }
    return parse(value);
  }

  const apiError = await readApiError(response);
  const status = response.status;
  const apiCode = apiError.code;
  if (status === 401) {
    clearAccessToken();
    throw error("Your session has expired. Sign in again.", "FORBIDDEN", status, apiCode);
  }
  if (status === 403) {
    throw error(
      apiError.message || "This execution is not assigned to your Escort account.",
      "FORBIDDEN",
      status,
      apiCode,
    );
  }
  if (status === 404) {
    throw error(
      apiError.message || "This execution is no longer available.",
      "NOT_FOUND",
      status,
      apiCode,
    );
  }
  if (status === 400 || status === 413 || status === 422) {
    throw error(
      apiError.message || "The Escort update was rejected. Check the submitted information.",
      "VALIDATION_ERROR",
      status,
      apiCode,
    );
  }
  if (status === 409) {
    throw error(
      apiError.message || "The execution changed before this update could be saved.",
      "STALE_STATE",
      status,
      apiCode,
    );
  }
  throw error(
    apiError.message || "We couldn't complete the Escort update.",
    "REQUEST_FAILED",
    status,
    apiCode,
  );
}

function locator(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw error(`${label} is unavailable. Refresh the execution.`, "STALE_STATE");
  return encodeURIComponent(normalized);
}

function welfareFormData(input: { photo: File; note: string }): FormData {
  assertValidEvidencePhoto(input.photo, "welfare");
  const note = input.note.trim();
  if (!note) throw error("Enter a welfare note before saving.", "VALIDATION_ERROR");
  const body = new FormData();
  body.append("photo", input.photo);
  body.append("note", note);
  return body;
}

function proofFormData(input: ProofOfDeliveryInput): FormData {
  assertValidEvidencePhoto(input.photo, "proof");
  const recipientName = input.recipientName.trim();
  if (!recipientName) {
    throw error("Enter the recipient name before confirming handover.", "VALIDATION_ERROR");
  }
  if (recipientName.length > 150) {
    throw error("Recipient name must be 150 characters or fewer.", "VALIDATION_ERROR");
  }
  const body = new FormData();
  body.append("recipientName", recipientName);
  body.append("photo", input.photo);
  const note = input.note?.trim();
  if (note) body.append("note", note);
  return body;
}

export const escortExecutionMutationApi = {
  recordRoadWelfare(
    roadLegVehicleId: string,
    input: RecordRoadWelfareInput,
  ): Promise<WelfareEvidence> {
    const vehicleId = locator(roadLegVehicleId, "ROAD Vehicle identifier");
    const checkpointId = input.eventType === "CHECKPOINT"
      ? locator(input.checkpointId, "Checkpoint identifier")
      : null;
    const path = input.eventType === "CHECKPOINT"
      ? `/api/v1/road-executions/vehicles/${vehicleId}/checkpoints/${checkpointId}/welfare`
      : `/api/v1/road-executions/vehicles/${vehicleId}/destination/welfare`;
    return requestJson(path, { method: "POST", body: welfareFormData(input) }, (value) =>
      parseWelfareEvidenceResponse(value, {
        mode: "ROAD",
        eventType: input.eventType,
        checkpointId: input.eventType === "CHECKPOINT" ? input.checkpointId.trim() : null,
        originalPhotoName: input.photo.name,
      }));
  },

  startAirExecution(routeLegId: string): Promise<AirExecutionResponseDto> {
    const id = routeLegId.trim();
    const pathId = locator(id, "AIR RouteLeg identifier");
    return requestJson(
      `/api/v1/air-executions/legs/${pathId}/start`,
      { method: "POST" },
      (value) => parseAirExecutionResponse(value, id),
    );
  },

  recordAirDestinationArrival(routeLegId: string): Promise<AirExecutionResponseDto> {
    const id = routeLegId.trim();
    const pathId = locator(id, "AIR RouteLeg identifier");
    return requestJson(
      `/api/v1/air-executions/legs/${pathId}/destination`,
      { method: "POST" },
      (value) => parseAirExecutionResponse(value, id),
    );
  },

  recordAirWelfare(routeLegId: string, input: RecordAirWelfareInput): Promise<WelfareEvidence> {
    const id = locator(routeLegId, "AIR RouteLeg identifier");
    return requestJson(
      `/api/v1/air-executions/legs/${id}/destination/welfare`,
      { method: "POST", body: welfareFormData(input) },
      (value) => parseWelfareEvidenceResponse(value, {
        mode: "AIR",
        eventType: "FINAL_DESTINATION",
        checkpointId: null,
        originalPhotoName: input.photo.name,
      }),
    );
  },

  recordRoadProofOfDelivery(
    roadLegVehicleId: string,
    input: ProofOfDeliveryInput,
  ): Promise<ProofOfDelivery> {
    const id = roadLegVehicleId.trim();
    const pathId = locator(id, "ROAD Vehicle identifier");
    return requestJson(
      `/api/v1/road-executions/vehicles/${pathId}/proof-of-delivery`,
      { method: "POST", body: proofFormData(input) },
      (value) => parseProofOfDeliveryResponse(value, {
        mode: "ROAD",
        roadLegVehicleId: id,
        originalPhotoName: input.photo.name,
      }),
    );
  },

  recordAirProofOfDelivery(
    routeLegId: string,
    input: ProofOfDeliveryInput,
  ): Promise<ProofOfDelivery> {
    const id = routeLegId.trim();
    const pathId = locator(id, "AIR RouteLeg identifier");
    return requestJson(
      `/api/v1/air-executions/legs/${pathId}/proof-of-delivery`,
      { method: "POST", body: proofFormData(input) },
      (value) => parseProofOfDeliveryResponse(value, {
        mode: "AIR",
        routeLegId: id,
        originalPhotoName: input.photo.name,
      }),
    );
  },
};
