import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignmentFixture, deferred } from "@/tests/lm-phase0-fixtures";
import { AssignmentServiceError } from "@/lib/staff-assignment/types";
import Page from "./page";

const mocks = vi.hoisted(() => ({
  access: { state: "allowed", preview: false, message: "" },
  getOrder: vi.fn(), assignStaff: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ orderId: "order-1" }), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/staff-assignment/use-logistics-access", () => ({ useLogisticsAccess: () => mocks.access }));
vi.mock("@/lib/staff-assignment/service", async (original) => ({
  ...await original<typeof import("@/lib/staff-assignment/service")>(),
  getStaffAssignmentService: () => mocks,
}));

function savedAssignment() {
  const detail = assignmentFixture();
  return { ...detail, assignmentStatus: "ASSIGNED", assignedPair: {
    transportSpecialist: detail.candidates.transportSpecialists[0],
    fleetRouteCoordinator: detail.candidates.fleetRouteCoordinators[0],
    assignedAt: "2026-11-06T10:00:00Z",
  } };
}

describe("LM assignment reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access = { state: "allowed", preview: false, message: "" };
    mocks.getOrder.mockResolvedValue(assignmentFixture());
    mocks.assignStaff.mockResolvedValue(undefined);
  });

  async function choosePair() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /Select Real TS/ }));
    await user.click(screen.getByRole("radio", { name: /Select Real FRC/ }));
    return user;
  }

  it("requires both selections and single-flights submission until persisted readback", async () => {
    const pending = deferred<void>();
    mocks.assignStaff.mockReturnValue(pending.promise);
    mocks.getOrder.mockResolvedValueOnce(assignmentFixture()).mockResolvedValue(savedAssignment());
    render(<Page />);
    await screen.findByRole("radio", { name: /Select Real TS/ });
    expect(screen.getByRole("button", { name: "Assign staff" })).toBeDisabled();
    await choosePair();
    const submit = screen.getByRole("button", { name: "Assign staff" });
    act(() => { fireEvent.click(submit); fireEvent.click(submit); });
    expect(mocks.assignStaff).toHaveBeenCalledOnce();
    expect(screen.getByRole("radio", { name: /Select Real TS/ })).toBeDisabled();
    await act(async () => pending.resolve());
    expect(await screen.findByRole("heading", { name: "Saved assignment" })).toBeVisible();
    expect(mocks.getOrder).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Assign staff" })).not.toBeInTheDocument();
  });

  it("retries failed readback without replaying POST, including repeated read failures", async () => {
    mocks.getOrder.mockResolvedValueOnce(assignmentFixture())
      .mockRejectedValueOnce(new Error("First read failed"))
      .mockRejectedValueOnce(new Error("Second read failed"))
      .mockResolvedValueOnce(savedAssignment());
    render(<Page />);
    const user = await choosePair();
    await user.click(screen.getByRole("button", { name: "Assign staff" }));
    await screen.findByText("First read failed");
    expect(screen.getByRole("button", { name: "Assign staff" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry read" }));
    await screen.findByText("Second read failed");
    expect(screen.getByRole("button", { name: "Assign staff" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry read" }));
    expect(await screen.findByRole("heading", { name: "Saved assignment" })).toBeVisible();
    expect(mocks.assignStaff).toHaveBeenCalledOnce();
  });

  it("reconciles stale assignment using GET without automatic replay", async () => {
    mocks.assignStaff.mockRejectedValue(new AssignmentServiceError("Already assigned", "STALE_STATE"));
    mocks.getOrder.mockResolvedValueOnce(assignmentFixture()).mockResolvedValueOnce(savedAssignment());
    render(<Page />);
    const user = await choosePair();
    await user.click(screen.getByRole("button", { name: "Assign staff" }));
    await screen.findByText("Already assigned");
    expect(screen.getByRole("button", { name: "Assign staff" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry read" }));
    expect(await screen.findByRole("heading", { name: "Saved assignment" })).toBeVisible();
    expect(mocks.assignStaff).toHaveBeenCalledOnce();
  });

  it("does not load candidates for unauthorized access", () => {
    mocks.access = { state: "forbidden", preview: false, message: "LM access denied" };
    render(<Page />);
    expect(screen.getByRole("alert")).toHaveTextContent("LM access denied");
    expect(mocks.getOrder).not.toHaveBeenCalled();
  });
});
