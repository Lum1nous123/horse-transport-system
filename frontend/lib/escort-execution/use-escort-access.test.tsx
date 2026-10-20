import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEscortAccess } from "./use-escort-access";

const accessMocks = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    getAccessToken: vi.fn(),
    getCurrentUser: vi.fn(),
    replace,
    router: { replace },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => accessMocks.router,
}));

vi.mock("@/lib/auth", () => ({
  getAccessToken: accessMocks.getAccessToken,
  getCurrentUser: accessMocks.getCurrentUser,
}));

function AccessProbe() {
  const access = useEscortAccess();
  return (
    <div>
      <p>{access.state}:{access.message}</p>
      {access.state === "failed" && <button type="button" onClick={access.retryAccess}>Retry access</button>}
    </div>
  );
}

describe("useEscortAccess", () => {
  beforeEach(() => {
    accessMocks.getAccessToken.mockReset();
    accessMocks.getCurrentUser.mockReset();
    accessMocks.replace.mockReset();
    window.history.replaceState({}, "", "/escort");
    accessMocks.getAccessToken.mockReturnValue("access-token");
  });

  it("allows an authenticated ESCORT", async () => {
    accessMocks.getCurrentUser.mockResolvedValue({ role: "ESCORT" });
    render(<AccessProbe />);

    expect(await screen.findByText("allowed:")).toBeInTheDocument();
  });

  it("renders a forbidden state for another authenticated role", async () => {
    accessMocks.getCurrentUser.mockResolvedValue({ role: "CUSTOMER" });
    render(<AccessProbe />);

    expect(await screen.findByText(/forbidden:You don't have permission/)).toBeInTheDocument();
  });

  it("redirects a missing session to login with the requested path", async () => {
    accessMocks.getAccessToken.mockReturnValue(null);
    render(<AccessProbe />);

    await waitFor(() => expect(accessMocks.replace).toHaveBeenCalledWith("/login?next=%2Fescort"));
    expect(accessMocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("retries a transient profile failure", async () => {
    accessMocks.getCurrentUser
      .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
      .mockResolvedValueOnce({ role: "ESCORT" });
    render(<AccessProbe />);

    expect(await screen.findByText(/failed:We couldn't verify your access/)).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry access" }).click();

    expect(await screen.findByText("allowed:")).toBeInTheDocument();
    expect(accessMocks.getCurrentUser).toHaveBeenCalledTimes(2);
  });
});
