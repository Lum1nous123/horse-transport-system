import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLogisticsAccess } from "./use-logistics-access";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() }, token: "test-token", getCurrentUser: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/auth", () => ({
  getAccessToken: () => mocks.token, getCurrentUser: mocks.getCurrentUser,
}));

describe("LM real versus preview authorization boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.token = "test-token";
    mocks.getCurrentUser.mockResolvedValue({ role: "LOGISTICS_MANAGER", status: "ACTIVE" });
    window.history.replaceState(null, "", "/logistics/route-reviews");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("verifies authenticated LM access before allowing the workspace", async () => {
    const { result } = renderHook(() => useLogisticsAccess());
    await waitFor(() => expect(result.current.state).toBe("allowed"));
    expect(result.current.preview).toBe(false);
    expect(mocks.getCurrentUser).toHaveBeenCalledOnce();
  });

  it("does not allow another role into LM views", async () => {
    mocks.getCurrentUser.mockResolvedValue({ role: "CUSTOMER" });
    const { result } = renderHook(() => useLogisticsAccess());
    await waitFor(() => expect(result.current.state).toBe("forbidden"));
  });

  it("does not activate preview from a production query parameter", async () => {
    vi.stubEnv("NODE_ENV", "production");
    window.history.replaceState(null, "", "/logistics/route-reviews?preview=1");
    mocks.getCurrentUser.mockResolvedValue({ role: "ESCORT" });
    const { result } = renderHook(() => useLogisticsAccess());
    await waitFor(() => expect(result.current.state).toBe("forbidden"));
    expect(result.current.preview).toBe(false);
    expect(mocks.getCurrentUser).toHaveBeenCalledOnce();
  });

  it("keeps explicit development preview usable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    window.history.replaceState(null, "", "/logistics/route-reviews?preview=1");
    const { result } = renderHook(() => useLogisticsAccess());
    await waitFor(() => expect(result.current.state).toBe("allowed"));
    expect(result.current.preview).toBe(true);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("redirects a missing session without calling identity APIs", async () => {
    mocks.token = "";
    renderHook(() => useLogisticsAccess());
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/login?next=%2Flogistics%2Froute-reviews"));
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });
});
