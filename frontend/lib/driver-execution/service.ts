import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { ExecutionError, type DriverSession } from "./types";
import { createProductionDriverExecutionService } from "./api-service";

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
    service: createProductionDriverExecutionService(user.id),
  };
}
