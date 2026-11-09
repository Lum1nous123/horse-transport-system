import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignedAirExecutionSummary, AssignedRoadExecutionSummary } from "@/lib/escort-execution/types";
import EscortQueuePage from "./page";
import { airQueueRow, roadQueueRow } from "@/lib/escort-execution/queue";

const queueMocks = vi.hoisted(() => ({
  access: {
    current: {
      state: "allowed",
      preview: false,
      previewEscortId: "escort-mia",
      previewEscortName: "Mia Laurent",
      message: "",
      retryAccess: vi.fn(),
    },
  },
  listAssignedRoadWork: vi.fn(),
  listAssignedAirWork: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: queueMocks.replace }),
}));

vi.mock("@/lib/escort-execution/use-escort-access", () => ({
  useEscortAccess: () => queueMocks.access.current,
}));

vi.mock("@/lib/escort-execution/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/escort-execution/service")>(
    "@/lib/escort-execution/service",
  );
  return {
    ...actual,
    getEscortExecutionService: () => ({
      listAssignedRoadWork: queueMocks.listAssignedRoadWork,
      getAssignedRoadExecution: vi.fn(),
      recordRoadWelfare: vi.fn(),
      recordRoadProofOfDelivery: vi.fn(),
      listAssignedAirWork: queueMocks.listAssignedAirWork,
      getAssignedAirExecution: vi.fn(),
      startAirExecution: vi.fn(),
      recordAirDestinationArrival: vi.fn(),
      recordAirWelfare: vi.fn(),
      completeAirExecution: vi.fn(),
      recordAirProofOfDelivery: vi.fn(),
    }),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function assignedExecution(overrides: Partial<AssignedRoadExecutionSummary> = {}): AssignedRoadExecutionSummary {
  return {
    executionId: "road-execution-2074-a",
    roadLegVehicleId: "road-vehicle-2074-a",
    orderId: "order-2074",
    orderCode: "ORD-2074",
    routeLegId: "leg-2074-1",
    routeLegSequenceNo: 1,
    routeLegStatus: "IN_PROGRESS",
    isFinalLeg: false,
    origin: "Lexington",
    destination: "Chicago",
    plannedDepartureAt: "2026-10-28T09:00:00-04:00",
    vehiclePlateNumber: "TRK-101",
    vehicleName: "EquiMove 1",
    horseCount: 2,
    status: "IN_PROGRESS",
    reachedCheckpointCount: 1,
    pendingCheckpointWelfareCount: 1,
    destinationArrivedAt: null,
    finalWelfareRecorded: false,
    proofOfDeliveryRecorded: false,
    proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
    ...overrides,
  };
}

function assignedAirExecution(overrides: Partial<AssignedAirExecutionSummary> = {}): AssignedAirExecutionSummary {
  return {
    executionId: "air-execution-upcoming",
    orderId: "order-3001",
    orderCode: "ORD-3001",
    routeLegId: "air-leg-3001-2",
    routeLegSequenceNo: 2,
    routeLegStatus: "PLANNED",
    isFinalLeg: false,
    origin: "Chicago O'Hare Cargo Terminal",
    destination: "Liège Airport Cargo",
    plannedDepartureAt: "2026-11-02T09:00:00-06:00",
    plannedArrivalAt: "2026-11-02T23:10:00+01:00",
    status: "NOT_STARTED",
    welfareRecorded: false,
    proofOfDeliveryRecorded: false,
    proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "PLANNED", orderStatus: "IN_PROGRESS" },
    availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    ...overrides,
  };
}

describe("Escort queue presentation", () => {
  it("uses real reached/destination welfare metadata without inventing a Driver action", () => {
    expect(roadQueueRow(assignedExecution()).nextStep).toBe("Record checkpoint welfare");
    expect(roadQueueRow(assignedExecution({ pendingCheckpointWelfareCount: 0, status: "DESTINATION",
      destinationArrivedAt: "2026-11-01T10:00:00Z" }))).toMatchObject({ group: "processing", nextStep: "Record final welfare", label: "At destination" });
    expect(roadQueueRow(assignedExecution({ status: "NOT_STARTED", routeLegStatus: "READY",
      reachedCheckpointCount: 0, pendingCheckpointWelfareCount: 0 }))).toMatchObject({ group: "upcoming", nextStep: "View execution" });
  });
  it("keeps invalid PoD and lifecycle metadata visible in All without actionable labels", () => {
    expect(roadQueueRow(assignedExecution({ proofOfDeliveryAvailable: true }))).toMatchObject({ group: null, label: "Check state", nextStep: "View execution" });
    expect(roadQueueRow(assignedExecution({ status: "IN_PROGRESS", routeLegStatus: "PLANNED" })).group).toBeNull();
    expect(airQueueRow(assignedAirExecution({ handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "READY", orderStatus: "CANCELLED" } })).group).toBeNull();
  });
  it("does not blame a previous leg when the first leg has not become ready", () => {
    expect(airQueueRow(assignedAirExecution({ routeLegSequenceNo: 1 })).label).toBe("Waiting for leg readiness");
  });
  it("groups a completed non-final AIR leg but never confuses it with delivery of the whole Order", () => {
    const row = airQueueRow(assignedAirExecution({ status: "COMPLETED", routeLegStatus: "COMPLETED", welfareRecorded: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "COMPLETED", orderStatus: "IN_PROGRESS" } }));
    expect(row).toMatchObject({ group: "completed", label: "Completed execution", nextStep: "View execution" });
  });
  it("exposes non-final AIR Complete only through the existing lifecycle resolver", () => {
    expect(airQueueRow(assignedAirExecution({ routeLegStatus: "IN_PROGRESS", status: "DESTINATION", welfareRecorded: true,
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: true } })).nextStep).toBe("Complete AIR execution");
    expect(airQueueRow(assignedAirExecution({ isFinalLeg: true, routeLegStatus: "IN_PROGRESS", status: "DESTINATION", welfareRecorded: true,
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: true } }))).toMatchObject({ group: null, nextStep: "View execution" });
  });
});

describe("EscortQueuePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    queueMocks.access.current = { state: "allowed", preview: false, previewEscortId: "escort-mia", previewEscortName: "Mia Laurent", message: "", retryAccess: vi.fn() };
    queueMocks.listAssignedRoadWork.mockResolvedValue({ executions: [] });
    queueMocks.listAssignedAirWork.mockResolvedValue({ executions: [] });
  });

  it("shows loading, unknown counts and only a verified empty state", async () => {
    const request = deferred<{ executions: AssignedRoadExecutionSummary[] }>();
    queueMocks.listAssignedRoadWork.mockReturnValueOnce(request.promise);
    render(<EscortQueuePage />);
    expect(await screen.findByLabelText("Loading assigned ROAD work")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All assigned —" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("No assigned work in this view")).not.toBeInTheDocument();
    await act(async () => request.resolve({ executions: [] }));
    expect(await screen.findByRole("heading", { name: "No assigned work in this view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All assigned 0" })).toBeInTheDocument();
  });

  it("renders ROAD and upcoming/ready AIR in one table, without treating a ready leg as a new Order status", async () => {
    queueMocks.listAssignedRoadWork.mockResolvedValue({ executions: [assignedExecution()] });
    queueMocks.listAssignedAirWork.mockResolvedValue({ executions: [
      assignedAirExecution(), assignedAirExecution({ executionId: "air-ready", orderCode: "ORD-3002", routeLegStatus: "READY",
        availableActions: { start: true, arriveAtDestination: false, recordWelfare: false, complete: false } }),
    ] });
    render(<EscortQueuePage />);
    const table = await screen.findByRole("table", { name: "Assigned ROAD and AIR executions" });
    await screen.findByRole("button", { name: "All assigned 3" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    expect(within(table).getByText("TRK-101")).toBeVisible();
    expect(within(table).getByText("Waiting for previous leg")).toBeVisible();
    expect(within(table).getByText("Not started · Ready leg")).toBeVisible();
    expect(within(table).getByRole("link", { name: /Start AIR execution/ })).toHaveAttribute("href", "/escort/air-executions/air-ready");
  });

  it("combines mode, group, search and departure sort while keeping unfiltered group counts", async () => {
    queueMocks.listAssignedRoadWork.mockResolvedValue({ executions: [assignedExecution()] });
    queueMocks.listAssignedAirWork.mockResolvedValue({ executions: [assignedAirExecution()] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    await screen.findByRole("button", { name: "All assigned 2" });
    await user.selectOptions(screen.getByLabelText("Sort by departure"), "latest");
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("ORD-3001");
    await user.click(screen.getByRole("button", { name: "Not started 1" }));
    expect(screen.queryByText("TRK-101")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "no-match");
    expect(screen.getByText("No matching assignments")).toBeVisible();
    expect(screen.getByRole("button", { name: "Not started 1" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.selectOptions(screen.getByLabelText("Transport mode"), "ROAD");
    await user.type(screen.getByRole("searchbox"), "trk");
    expect(screen.getByText("TRK-101")).toBeVisible();
    expect(screen.queryByText("ORD-3001")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1 loaded ROAD assignments")).toBeVisible();
  });

  it("keeps successful ROAD rows usable on AIR failure and retries only AIR", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    queueMocks.listAssignedRoadWork.mockResolvedValue({ executions: [assignedExecution()] });
    queueMocks.listAssignedAirWork.mockRejectedValueOnce(new EscortExecutionError("AIR queue unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce({ executions: [assignedAirExecution()] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    expect(await screen.findByText("TRK-101")).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("AIR unavailable.");
    expect(screen.queryByText("No assigned work in this view")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All assigned —" })).toBeInTheDocument();
    expect(screen.getByText(/Partial data/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try AIR again" }));
    await screen.findByRole("button", { name: "All assigned 2" });
    expect(screen.getByText("ORD-3001")).toBeVisible();
    expect(queueMocks.listAssignedRoadWork).toHaveBeenCalledOnce();
    expect(queueMocks.listAssignedAirWork).toHaveBeenCalledTimes(2);
  });

  it("retries a ROAD error without inventing an empty result", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    queueMocks.listAssignedRoadWork.mockRejectedValueOnce(new EscortExecutionError("Queue unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce({ executions: [assignedExecution()] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("ROAD unavailable.");
    await user.click(screen.getByRole("button", { name: "Try ROAD again" }));
    expect(await screen.findByText("TRK-101")).toBeVisible();
    expect(screen.getByRole("link", { name: /Record checkpoint welfare/ })).toBeVisible();
  });

  it("keeps a completed ROAD execution requiring handover in progress and preserves the final AIR PoD boundary", async () => {
    queueMocks.listAssignedRoadWork.mockResolvedValue({ executions: [assignedExecution({
      isFinalLeg: true, status: "COMPLETED", finalWelfareRecorded: true, pendingCheckpointWelfareCount: 0,
      destinationArrivedAt: "2026-11-01T10:00:00Z", proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 1, requiredHandovers: 2, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
    })] });
    queueMocks.listAssignedAirWork.mockResolvedValue({ executions: [assignedAirExecution({
      isFinalLeg: true, routeLegStatus: "IN_PROGRESS", status: "DESTINATION", welfareRecorded: true,
      proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 1, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
    })] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    await screen.findByRole("button", { name: "All assigned 2" });
    await user.click(screen.getByRole("button", { name: "In progress 2" }));
    expect(screen.getAllByRole("link", { name: /Record Proof of Delivery/ })).toHaveLength(2);
    expect(screen.getByText("Handovers 1/2")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Complete AIR/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Completed execution/ })).not.toBeInTheDocument();
  });

  it("fails safe for contradictory AIR capabilities, but keeps the row discoverable in All", async () => {
    queueMocks.listAssignedAirWork.mockResolvedValue({ executions: [assignedAirExecution({
      routeLegStatus: "READY", availableActions: { start: true, arriveAtDestination: true, recordWelfare: false, complete: false },
    })] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    expect(await screen.findByText("Check state")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Start AIR/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Not started 0" }));
    expect(screen.queryByText("ORD-3001")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All assigned 1" }));
    expect(screen.getByRole("link", { name: /View execution/ })).toBeVisible();
  });

  it("clears stale actions when a refreshed source fails", async () => {
    queueMocks.listAssignedRoadWork.mockResolvedValueOnce({ executions: [assignedExecution()] }).mockRejectedValue(new Error("Revoked or unavailable"));
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    await screen.findByRole("button", { name: "All assigned 1" });
    await user.click(screen.getByRole("button", { name: "Refresh saved state" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ROAD unavailable");
    expect(screen.queryByText("TRK-101")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Record checkpoint welfare/ })).not.toBeInTheDocument();
  });
  it("offers Completed execution only for completed rows returned by the service, not full Order history", async () => {
    queueMocks.listAssignedRoadWork.mockResolvedValue({ executions: [assignedExecution({
      status: "COMPLETED", routeLegStatus: "COMPLETED", pendingCheckpointWelfareCount: 0, finalWelfareRecorded: true,
      destinationArrivedAt: "2026-11-01T10:00:00Z",
    })] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    await user.click(await screen.findByRole("button", { name: "Completed execution 1" }));
    expect(screen.getByRole("link", { name: /View execution/ })).toBeVisible();
    expect(screen.getByText(/This queue is not a full assignment history/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /Record Proof/ })).not.toBeInTheDocument();
  });

  it("ignores an older response after access is revoked and reverified", async () => {
    const old = deferred<{ executions: AssignedRoadExecutionSummary[] }>();
    queueMocks.listAssignedRoadWork.mockReturnValueOnce(old.promise).mockResolvedValue({ executions: [assignedExecution({ vehiclePlateNumber: "NEW-101" })] });
    const view = render(<EscortQueuePage />);
    await screen.findByLabelText("Loading assigned ROAD work");
    queueMocks.access.current = { ...queueMocks.access.current, state: "forbidden" };
    view.rerender(<EscortQueuePage />);
    queueMocks.access.current = { ...queueMocks.access.current, state: "allowed" };
    view.rerender(<EscortQueuePage />);
    await screen.findByText("NEW-101");
    await act(async () => old.resolve({ executions: [assignedExecution()] }));
    expect(screen.queryByText("TRK-101")).not.toBeInTheDocument();
    expect(screen.getByText("NEW-101")).toBeVisible();
  });

  it("does not load work when access is forbidden", () => {
    queueMocks.access.current = { ...queueMocks.access.current, state: "forbidden", message: "Not permitted." };
    render(<EscortQueuePage />);
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeVisible();
    expect(queueMocks.listAssignedRoadWork).not.toHaveBeenCalled();
    expect(queueMocks.listAssignedAirWork).not.toHaveBeenCalled();
  });

  it("retries failed access verification without loading work early", async () => {
    const retryAccess = vi.fn();
    queueMocks.access.current = { ...queueMocks.access.current, state: "failed", message: "Access unavailable.", retryAccess };
    const user = userEvent.setup();
    render(<EscortQueuePage />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryAccess).toHaveBeenCalledOnce();
    expect(queueMocks.listAssignedRoadWork).not.toHaveBeenCalled();
  });
});
