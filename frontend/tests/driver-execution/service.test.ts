import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { getDriverSession, productionDriverExecutionService } from "@/lib/driver-execution/service";

vi.mock("@/lib/auth", () => ({ getAccessToken: vi.fn(), getCurrentUser: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

describe("production access boundary", () => {
  it("does not honor preview query parameters in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(getAccessToken).mockReturnValue("test-token");
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "actual-driver", fullName: "Actual Driver", role: "DRIVER", status: "ACTIVE", email: "driver@example.test", phone: null });
    const session = await getDriverSession("?preview=1&driver=jamie");
    expect(session.driverId).toBe("actual-driver");
    expect(session.preview).toBe(false);
    expect(session.service).toBe(productionDriverExecutionService);
  });
  it("rejects a non-Driver and an inactive Driver", async () => {
    vi.mocked(getAccessToken).mockReturnValue("test-token");
    for (const profile of [{ role: "CUSTOMER", status: "ACTIVE" }, { role: "DRIVER", status: "INACTIVE" }]) {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "actual-user", fullName: "Account", email: "account@example.test", phone: null, ...profile });
      await expect(getDriverSession("")).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it("requires authentication before accessing production work", async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);
    await expect(getDriverSession("")).rejects.toThrow("SESSION_EXPIRED");
  });
  it("fails explicitly until the real contract is available instead of returning mock work", async () => {
    await expect(productionDriverExecutionService.listAssignedWork()).rejects.toMatchObject({ code: "CONTRACT_UNAVAILABLE" });
    await expect(productionDriverExecutionService.startVehicle({ executionId: "actual-execution", expectedRevision: 1 })).rejects.toMatchObject({ code: "CONTRACT_UNAVAILABLE" });
  });
});
