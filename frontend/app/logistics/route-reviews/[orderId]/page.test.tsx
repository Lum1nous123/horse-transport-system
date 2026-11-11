import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, lockedFixture, reviewFixture } from "@/tests/lm-phase0-fixtures";
import type { RouteReviewDetail } from "@/lib/logistics-route-review/types";
import Page from "./page";

const mocks = vi.hoisted(() => ({
  access: { state: "allowed", preview: false, message: "" },
  getReview: vi.fn(), confirmPlan: vi.fn(), returnPlan: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ orderId: "order-1" }), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/staff-assignment/use-logistics-access", () => ({ useLogisticsAccess: () => mocks.access }));
vi.mock("@/lib/logistics-route-review/service", async (original) => ({
  ...await original<typeof import("@/lib/logistics-route-review/service")>(),
  getLogisticsRouteReviewService: () => mocks,
}));

describe("LM review decisions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access = { state: "allowed", preview: false, message: "" };
    mocks.getReview.mockImplementation(async () => reviewFixture());
    mocks.confirmPlan.mockImplementation(async () => lockedFixture());
  });

  async function openConfirm() {
    await screen.findByRole("heading", { name: "Ordered Route Plan" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm & lock" }));
    return screen.getAllByRole("button", { name: "Confirm & lock" })[0];
  }

  it("does not label missing results or individual legs Passed; confirmation still reaches server", async () => {
    render(<Page />);
    const confirm = await openConfirm();
    expect(screen.getByText("Not supplied")).toBeVisible();
    expect(screen.queryByText(/Passed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Revision/)).not.toBeInTheDocument();
    fireEvent.click(confirm);
    expect(await screen.findByText(/decision response confirms staffing/)).toBeVisible();
    expect(mocks.confirmPlan).toHaveBeenCalledOnce();
    expect(mocks.getReview).toHaveBeenCalledOnce();
    expect(screen.getByText(/Saved decision response from this session/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("Dana Driver")).toBeVisible();
    expect(screen.getByText("Username / email: dana.driver@example.com")).toBeVisible();
    expect(screen.queryByText(/Staff ID:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Order Horse IDs: order-horse-1/)).toBeVisible();
  });

  it("blocks duplicate and opposing actions synchronously during a deferred mutation", async () => {
    const pending = deferred<RouteReviewDetail>();
    mocks.confirmPlan.mockReturnValue(pending.promise);
    render(<Page />);
    const confirm = await openConfirm();
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(mocks.confirmPlan).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Return plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    await act(async () => pending.resolve(lockedFixture()));
    expect(mocks.returnPlan).not.toHaveBeenCalled();
  });

  it("keeps repeated failed recovery reads locked and never replays an uncertain action", async () => {
    mocks.confirmPlan.mockRejectedValue(new Error("Connection lost after POST"));
    mocks.getReview.mockResolvedValueOnce(reviewFixture())
      .mockRejectedValueOnce(new Error("Read failed once"))
      .mockRejectedValueOnce(new Error("Read failed twice"))
      .mockResolvedValueOnce(reviewFixture());
    render(<Page />);
    fireEvent.click(await openConfirm());
    await screen.findByText("Connection lost after POST");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry read" }));
    await screen.findByText("Read failed once");
    expect(screen.getByRole("button", { name: "Return plan" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry read" }));
    await screen.findByText("Read failed twice");
    expect(screen.getByRole("button", { name: "Return plan" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry read" }));
    await screen.findByText("Pending Route Plan fetched from the server.");
    expect(screen.getByRole("button", { name: "Return plan" })).toBeEnabled();
    expect(mocks.confirmPlan).toHaveBeenCalledOnce();
  });

  it("requires a return reason and displays the saved Return response without a pending-only GET", async () => {
    const saved = { ...reviewFixture(), routePlanStatus: "RETURNED", returnReason: "Correct route" };
    mocks.returnPlan.mockResolvedValue(saved);
    render(<Page />);
    await screen.findByRole("heading", { name: "Ordered Route Plan" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Return plan" }));
    await user.click(screen.getByRole("button", { name: "Return to FRC" }));
    expect(mocks.returnPlan).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: "Return reason" }), "Correct route");
    await user.click(screen.getByRole("button", { name: "Return to FRC" }));
    expect(await screen.findByText("Returned to FRC")).toBeVisible();
    expect(mocks.returnPlan).toHaveBeenCalledWith("order-1", "Correct route");
    expect(mocks.getReview).toHaveBeenCalledOnce();
  });

  it("preserves supplied validation failures as a confirmation gate", async () => {
    const result = reviewFixture();
    result.validations = [{ code: "CAPACITY", label: "Capacity", message: "Insufficient capacity", status: "FAILED" }];
    mocks.getReview.mockResolvedValue(result);
    render(<Page />);
    await screen.findByText("Insufficient capacity");
    expect(screen.getByRole("button", { name: "Confirm & lock" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Return plan" })).toBeEnabled();
  });

  it("locks on an incomplete decision response", async () => {
    mocks.confirmPlan.mockResolvedValue({ ...lockedFixture(), legs: [] });
    render(<Page />);
    fireEvent.click(await openConfirm());
    await screen.findByText(/decision response could not verify/);
    expect(screen.getByRole("button", { name: "Return plan" })).toBeDisabled();
  });

  it("does not fetch or mutate when LM access is forbidden", () => {
    mocks.access = { state: "forbidden", preview: false, message: "LM access denied" };
    render(<Page />);
    expect(screen.getByRole("alert")).toHaveTextContent("LM access denied");
    expect(mocks.getReview).not.toHaveBeenCalled();
    expect(mocks.confirmPlan).not.toHaveBeenCalled();
  });
});
