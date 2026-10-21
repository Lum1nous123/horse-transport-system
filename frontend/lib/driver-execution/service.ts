import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { ExecutionError, type DriverExecutionService, type DriverSession } from "./types";

function contractUnavailable(): never {
  throw new ExecutionError(
    "Your assigned ROAD work is not available right now. Refresh to try again. No execution action has been sent.",
    "CONTRACT_UNAVAILABLE",
  );
}

// Issues #111/#112 and #116 define behavior but currently publish no endpoint,
// DTO, or error contract. Do not guess URLs or silently fall back to demo data.
// Replace this adapter after the approved BE-23/BE-24 contract is available.
export const productionDriverExecutionService: DriverExecutionService = {
  async listAssignedWork() { return contractUnavailable(); },
  async getExecution() { return contractUnavailable(); },
  async startVehicle() { return contractUnavailable(); },
  async arriveAtCheckpoint() { return contractUnavailable(); },
  async arriveAtDestination() { return contractUnavailable(); },
};

export async function getDriverSession(search: string): Promise<DriverSession> {
  const query = new URLSearchParams(search);
  if (process.env.NODE_ENV === "development" && query.get("preview") === "1") {
    const { createPreviewDriverSession } = await import("./preview-service");
    return createPreviewDriverSession(query);
  }
  if (!getAccessToken()) throw new Error("SESSION_EXPIRED");
  const user = await getCurrentUser();
  if (user.role !== "DRIVER" || user.status !== "ACTIVE") {
    throw new ExecutionError("Only an active Driver can open this workspace.", "FORBIDDEN");
  }
  return {
    driverId: user.id, fullName: user.fullName, preview: false, previewQuery: "",
    service: productionDriverExecutionService,
  };
}
