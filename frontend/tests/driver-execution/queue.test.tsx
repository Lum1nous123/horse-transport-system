import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DriverWorkspace from "@/components/execution/DriverWorkspace";
import { createPreviewWork } from "@/lib/driver-execution/preview-service";
import type { DriverExecution, DriverSession } from "@/lib/driver-execution/types";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// Test the dashboard/service boundary and child identity; the real detail
// controller's action/readback behavior is covered in detail.test.tsx.
vi.mock("@/components/execution/DriverExecutionDetail", () => ({
  default: ({ executionId, onPendingChange }: { executionId: string; onPendingChange?: (value: boolean) => void }) =>
    <section aria-label={"Detail " + executionId}><input aria-label="Local detail state" />
      <button type="button" onClick={() => onPendingChange?.(true)}>Begin pending action</button>
      <button type="button" onClick={() => onPendingChange?.(false)}>Finish pending action</button></section>,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const first = createPreviewWork()[0];
  first.plannedDepartureAt = "2026-11-11T10:00:00Z";
  const second = createPreviewWork("in-progress")[0];
  second.id = "second-vehicle";
  second.vehicle.plateNumber = "TRK-SECOND";
  second.plannedDepartureAt = "2026-11-12T10:00:00Z";
  const service = {
    listAssignedWork: vi.fn().mockResolvedValue([first, second, { ...first, id: "foreign", driverId: "another-driver" }]),
    getExecution: vi.fn(), startVehicle: vi.fn(), arriveAtCheckpoint: vi.fn(), arriveAtDestination: vi.fn(),
  };
  const session: DriverSession = { service, driverId: first.driverId, fullName: "Driver test", preview: false, previewQuery: "" };
  return { first, second, service, session };
}

describe("Driver assigned-work dashboard", () => {
  it("shows all owned vehicle executions, including two for the same Order, without advertising Start from queue data", async () => {
    const { first, service, session } = setup();
    first.permissions.canStart = false;
    render(<DriverWorkspace session={session} />);
    expect(await screen.findByRole("button", { name: "All assigned 2" })).toHaveAttribute("aria-pressed", "true");
    const queue = screen.getByRole("complementary", { name: "Assigned ROAD executions" });
    expect(within(queue).getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByText("foreign")).not.toBeInTheDocument();
    expect(within(queue).getByText("Not started · Ready leg")).toBeVisible();
    expect(within(queue).queryByRole("button", { name: /Start my vehicle/ })).not.toBeInTheDocument();
    expect(service.startVehicle).not.toHaveBeenCalled();
    expect(service.getExecution).not.toHaveBeenCalled();
  });

  it("preserves selected detail state outside search/groups and sorts without selecting another vehicle", async () => {
    const { first, session } = setup();
    const user = userEvent.setup();
    render(<DriverWorkspace session={session} />);
    await screen.findByRole("button", { name: "All assigned 2" });
    await user.type(screen.getByLabelText("Local detail state"), "keep this");
    await user.click(screen.getByRole("button", { name: "In progress 1" }));
    expect(screen.getByText(/The selected execution is outside your filters/)).toBeVisible();
    expect(screen.getByLabelText("Local detail state")).toHaveValue("keep this");
    await user.click(screen.getByRole("button", { name: "All assigned 2" }));
    await user.selectOptions(screen.getByLabelText("Sort by departure"), "latest");
    const queue = screen.getByRole("complementary");
    expect(within(queue).getAllByRole("button")[0]).toHaveTextContent("TRK-SECOND");
    expect(screen.getByRole("region", { name: "Detail " + first.id })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "nothing");
    expect(screen.getByText("No matching assignments")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(screen.getByLabelText("Local detail state")).toHaveValue("keep this");
  });

  it("locks switching, filters and refresh during a child mutation", async () => {
    const { session } = setup();
    const user = userEvent.setup();
    render(<DriverWorkspace session={session} />);
    await screen.findByRole("button", { name: "All assigned 2" });
    await user.click(screen.getByRole("button", { name: "Begin pending action" }));
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Not started 1" })).toBeDisabled();
    expect(within(screen.getByRole("complementary")).getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Finish pending action" }));
    expect(screen.getByRole("searchbox")).toBeEnabled();
  });

  it("ignores aborted older refreshes even when the service ignores AbortSignal", async () => {
    const { session, service } = setup();
    const old = deferred<DriverExecution[]>();
    service.listAssignedWork.mockReturnValueOnce(old.promise).mockResolvedValue([]);
    const user = userEvent.setup();
    const view = render(<DriverWorkspace session={session} />);
    await screen.findByText("Loading your assigned ROAD work…");
    // Replacing the session invalidates the prior request.
    view.rerender(<DriverWorkspace session={{ ...session }} />);
    await screen.findByText("No assigned ROAD work");
    await act(async () => old.resolve(createPreviewWork()));
    expect(screen.getByText("No assigned ROAD work")).toBeVisible();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("No assigned ROAD work")).toBeVisible();
  });

  it("clears revoked assignments on refresh failure and retries reads only", async () => {
    const { session, service } = setup();
    service.listAssignedWork.mockResolvedValueOnce(createPreviewWork()).mockRejectedValueOnce(new Error("Assignments unavailable")).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<DriverWorkspace session={session} />);
    await screen.findByRole("complementary");
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Assignments unavailable");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All assigned —" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No assigned ROAD work")).toBeVisible();
    expect(service.startVehicle).not.toHaveBeenCalled();
  });
});
