import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { parseDriverRoadDetail, parseDriverRoadQueue } from "@/lib/escort-execution/read-contracts";
import { ExecutionError, type DriverExecutionService } from "./types";

type ErrorBody = { code?: string; message?: string };

function executionError(message: string, code: ConstructorParameters<typeof ExecutionError>[1]) {
  return new ExecutionError(message, code);
}

async function errorBody(response: Response): Promise<ErrorBody> {
  try {
    const value = await response.json() as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    return {
      code: typeof source.code === "string" ? source.code : undefined,
      message: typeof source.message === "string" ? source.message : undefined,
    };
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
): Promise<T> {
  const token = getAccessToken();
  if (!token) throw executionError("Your session has expired. Sign in again.", "FORBIDDEN");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  let response: Response;
  try {
    response = await apiFetch(path, { ...init, headers });
  } catch {
    throw executionError(
      init.method === "GET"
        ? "We couldn't load your assigned ROAD work. Check your connection and try again."
        : "We couldn't confirm whether the Driver update was saved. Refresh before trying again.",
      "NETWORK_ERROR",
    );
  }
  if (response.ok) {
    try { return parse(await response.json() as unknown); }
    catch (caught) {
      if (caught instanceof ExecutionError) throw caught;
      throw executionError("The Driver service returned an unreadable response.", "NETWORK_ERROR");
    }
  }
  const body = await errorBody(response);
  if (response.status === 401) {
    clearAccessToken();
    throw executionError("Your session has expired. Sign in again.", "FORBIDDEN");
  }
  if (response.status === 403) {
    throw executionError(body.message || "This ROAD execution is not available to your Driver account.", "FORBIDDEN");
  }
  if (response.status === 404) {
    throw executionError(body.message || "This ROAD execution is no longer assigned to you.", "NOT_FOUND");
  }
  if (response.status === 409) {
    throw executionError(body.message || "The journey state changed before this update could be saved.", "STALE_STATE");
  }
  if (response.status === 400 || response.status === 422) {
    throw executionError(body.message || "This Driver action is not valid for the current journey state.", "OUT_OF_SEQUENCE");
  }
  throw executionError(body.message || "The Driver service is unavailable. Try again.", "NETWORK_ERROR");
}

export function createProductionDriverExecutionService(driverId: string): DriverExecutionService {
  const roadVehicleIds = new Map<string, string>();

  async function detail(executionId: string, signal?: AbortSignal) {
    const value = await request(
      `/api/v1/road-executions/${encodeURIComponent(executionId)}`,
      { method: "GET", signal },
      (body) => parseDriverRoadDetail(body, driverId),
    );
    roadVehicleIds.set(value.id, value.vehicle.id);
    return value;
  }

  async function vehicleId(executionId: string) {
    return roadVehicleIds.get(executionId) ?? (await detail(executionId)).vehicle.id;
  }

  async function mutate(executionId: string, suffix: string) {
    const id = await vehicleId(executionId);
    await request(
      `/api/v1/road-executions/vehicles/${encodeURIComponent(id)}${suffix}`,
      { method: "POST" },
      (body) => body,
    );
  }

  return {
    async listAssignedWork(signal) {
      const work = await request(
        "/api/v1/road-executions/assigned",
        { method: "GET", signal },
        (body) => parseDriverRoadQueue(body, driverId),
      );
      work.forEach((execution) => roadVehicleIds.set(execution.id, execution.vehicle.id));
      return work;
    },
    getExecution: detail,
    startVehicle(command) {
      return mutate(command.executionId, "/start");
    },
    arriveAtCheckpoint(command) {
      return mutate(command.executionId, `/checkpoints/${encodeURIComponent(command.checkpointId)}/arrival`);
    },
    arriveAtDestination(command) {
      return mutate(command.executionId, "/destination");
    },
  };
}
