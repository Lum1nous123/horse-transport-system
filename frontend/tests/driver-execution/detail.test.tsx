import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DriverExecutionDetail from "@/components/execution/DriverExecutionDetail";
import { createPreviewDriverService, createPreviewWork } from "@/lib/driver-execution/preview-service";
import { ExecutionError, type DriverExecution, type DriverSession } from "@/lib/driver-execution/types";
import { useExecutionController } from "@/lib/driver-execution/use-execution-controller";

function setup(scenario: Parameters<typeof createPreviewDriverService>[0]["scenario"] = "ready") {
  const service = createPreviewDriverService({ driverId: "demo-driver-alex", scenario, latency: 0 });
  const session: DriverSession = { service, driverId: "demo-driver-alex", fullName: "Alex Morgan", preview: true, previewQuery: "?preview=1" };
  return { service, session };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Driver execution components", () => {
  it("shows loading before the saved assignment is available", async () => {
    const { session, service } = setup();
    const pending = deferred<DriverExecution>();
    vi.spyOn(service, "getExecution").mockReturnValue(pending.promise);
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" onStarted={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your assigned vehicle");
    expect(screen.queryByRole("button", { name: "Start my vehicle" })).not.toBeInTheDocument();
    await act(async () => pending.resolve(createPreviewWork()[0]));
  });
  it("does not navigate or infer success until the post-Start read-back confirms it", async () => {
    const { session, service } = setup();
    const onStarted = vi.fn();
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" onStarted={onStarted} />);
    const start = await screen.findByRole("button", { name: "Start my vehicle" });
    const saved = deferred<DriverExecution>();
    vi.spyOn(service, "getExecution").mockReturnValue(saved.promise);
    const startSpy = vi.spyOn(service, "startVehicle");
    await userEvent.dblClick(start);
    await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
    expect(onStarted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
    const persisted = createPreviewWork("in-progress")[0];
    await act(async () => saved.resolve(persisted));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(persisted));
  });
  it("blocks actions if Start succeeded but read-back failed, then allows reconciliation", async () => {
    const { session, service } = setup();
    const onStarted = vi.fn();
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" onStarted={onStarted} />);
    const start = await screen.findByRole("button", { name: "Start my vehicle" });
    vi.spyOn(service, "getExecution").mockRejectedValue(new Error("Connection lost"));
    await userEvent.click(start);
    expect(await screen.findByRole("alert")).toHaveTextContent("saved result could not be confirmed");
    expect(screen.getByRole("button", { name: "Start my vehicle" })).toBeDisabled();
    expect(onStarted).not.toHaveBeenCalled();
  });
  it("does not open the journey if read-back fails to confirm all Start transitions", async () => {
    const { session, service } = setup();
    const onStarted = vi.fn();
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" onStarted={onStarted} />);
    const start = await screen.findByRole("button", { name: "Start my vehicle" });
    const inconsistent = createPreviewWork()[0];
    inconsistent.status = "IN_PROGRESS";
    vi.spyOn(service, "getExecution").mockResolvedValue(inconsistent);
    await userEvent.click(start);
    expect(await screen.findByRole("alert")).toHaveTextContent("saved result could not be confirmed");
    expect(onStarted).not.toHaveBeenCalled();
  });
  it("shows an actionable stale error and reads state again without retrying the write", async () => {
    const { session, service } = setup();
    vi.spyOn(service, "startVehicle").mockRejectedValue(new ExecutionError("Journey changed. Refresh and review before retrying.", "STALE_STATE"));
    const read = vi.spyOn(service, "getExecution");
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" onStarted={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Start my vehicle" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Journey changed");
    expect(read).toHaveBeenCalledTimes(2);
    expect(service.startVehicle).toHaveBeenCalledTimes(1);
  });
  it("never renders a foreign assignment's details or Start action", async () => {
    const { session, service } = setup();
    const foreign = createPreviewWork()[2];
    vi.spyOn(service, "getExecution").mockResolvedValue(foreign);
    render(<DriverExecutionDetail session={session} executionId={foreign.id} onStarted={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("not assigned to you");
    expect(screen.queryByRole("button", { name: "Start my vehicle" })).not.toBeInTheDocument();
    expect(screen.queryByText("HT-205")).not.toBeInTheDocument();
  });
  it("does not show an action for a later leg", async () => {
    const { session } = setup();
    render(<DriverExecutionDetail session={session} executionId="demo-execution-119" onStarted={vi.fn()} />);
    expect(await screen.findByText("This leg is not current. Wait for the previous leg to complete, then refresh.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start my vehicle" })).not.toBeInTheDocument();
  });
  it("the focused journey records only the selected eligible checkpoint for this vehicle", async () => {
    const { session, service } = setup("in-progress");
    const arrival = vi.spyOn(service, "arriveAtCheckpoint");
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" journey onStarted={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Confirm checkpoint arrival" }));
    await waitFor(() => expect(arrival).toHaveBeenCalledWith({ executionId: "demo-execution-204", expectedRevision: 1, checkpointId: "demo-stop-2" }));
    expect(await screen.findByRole("button", { name: "Confirm destination arrival" })).toBeInTheDocument();
  });
  it("selecting an unreached destination does not expose a premature arrival action", async () => {
    const { session } = setup("in-progress");
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" journey onStarted={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: /Destination: Ayutthaya/ }));
    expect(screen.queryByRole("button", { name: "Confirm destination arrival" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open next stop" })).toBeInTheDocument();
  });
  it("destination does not expose a Complete leg or handover action", async () => {
    const { session } = setup("destination");
    render(<DriverExecutionDetail session={session} executionId="demo-execution-204" journey onStarted={vi.fn()} />);
    expect(await screen.findByText(/Your destination arrival is recorded/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirm.*arrival|Complete|Start my vehicle/ })).not.toBeInTheDocument();
  });
});

describe("response ordering", () => {
  it("discards an older read that resolves after a newer refresh", async () => {
    const { service } = setup();
    const old = deferred<DriverExecution>();
    vi.spyOn(service, "getExecution").mockReturnValueOnce(old.promise).mockResolvedValue(createPreviewWork("in-progress")[0]);
    const { result } = renderHook(() => useExecutionController(service, "demo-execution-204", "demo-driver-alex"));
    await waitFor(() => expect(service.getExecution).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.execution?.status).toBe("IN_PROGRESS");
    await act(async () => old.resolve(createPreviewWork()[0]));
    expect(result.current.execution?.status).toBe("IN_PROGRESS");
  });
});
