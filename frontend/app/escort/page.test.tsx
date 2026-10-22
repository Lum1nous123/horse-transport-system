import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignedAirExecutionSummary, AssignedRoadExecutionSummary } from "@/lib/escort-execution/types";
import EscortQueuePage from "./page";

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
      listAssignedAirWork: queueMocks.listAssignedAirWork,
      getAssignedAirExecution: vi.fn(),
      startAirExecution: vi.fn(),
      recordAirDestinationArrival: vi.fn(),
      recordAirWelfare: vi.fn(),
      completeAirExecution: vi.fn(),
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

function assignedExecution(): AssignedRoadExecutionSummary {
  return {
    executionId: "road-execution-2074-a",
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
    availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    ...overrides,
  };
}

describe("EscortQueuePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueMocks.access.current = {
      state: "allowed",
      preview: false,
      previewEscortId: "escort-mia",
      previewEscortName: "Mia Laurent",
      message: "",
      retryAccess: vi.fn(),
    };
    queueMocks.listAssignedAirWork.mockResolvedValue({ executions: [] });
  });

  it("shows loading before rendering the empty assigned-work state", async () => {
    const request = deferred<{ executions: AssignedRoadExecutionSummary[] }>();
    queueMocks.listAssignedRoadWork.mockReturnValueOnce(request.promise);
    render(<EscortQueuePage />);

    expect(await screen.findByLabelText("Loading assigned ROAD work")).toBeInTheDocument();
    await act(async () => request.resolve({ executions: [] }));

    expect(await screen.findByRole("heading", { name: "No ROAD welfare action is assigned" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No AIR execution is assigned" })).toBeInTheDocument();
  });

  it("retries a service error and renders the assigned Vehicle returned by the boundary", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    queueMocks.listAssignedRoadWork
      .mockRejectedValueOnce(new EscortExecutionError("Queue unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce({ executions: [assignedExecution()] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Queue unavailable.");
    await user.click(screen.getByRole("button", { name: "Try ROAD again" }));

    expect(await screen.findByRole("heading", { name: "TRK-101" })).toBeInTheDocument();
    expect(screen.getByText("Record checkpoint welfare")).toBeInTheDocument();
    expect(queueMocks.listAssignedRoadWork).toHaveBeenCalledTimes(2);
  });

  it("shows upcoming and actionable AIR assignments in a separate queue section", async () => {
    queueMocks.listAssignedRoadWork.mockResolvedValueOnce({ executions: [] });
    queueMocks.listAssignedAirWork.mockResolvedValueOnce({
      executions: [
        assignedAirExecution(),
        assignedAirExecution({
          executionId: "air-execution-ready",
          orderCode: "ORD-3002",
          routeLegStatus: "READY",
          availableActions: { start: true, arriveAtDestination: false, recordWelfare: false, complete: false },
        }),
      ],
    });
    render(<EscortQueuePage />);

    const airSection = (await screen.findByRole("heading", { name: "Assigned RouteLeg execution" })).closest("section");
    expect(airSection).not.toBeNull();
    expect(await within(airSection!).findByText("ORD-3001 · Leg 2")).toBeInTheDocument();
    expect(within(airSection!).getByText("View AIR details")).toBeInTheDocument();
    expect(within(airSection!).getByText("Start AIR execution")).toBeInTheDocument();
  });

  it("keeps ROAD results usable when the AIR queue fails and retries only AIR", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    queueMocks.listAssignedRoadWork.mockResolvedValueOnce({ executions: [assignedExecution()] });
    queueMocks.listAssignedAirWork
      .mockRejectedValueOnce(new EscortExecutionError("AIR queue unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce({ executions: [assignedAirExecution()] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);

    expect(await screen.findByRole("heading", { name: "TRK-101" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("AIR queue unavailable.");
    await user.click(screen.getByRole("button", { name: "Try AIR again" }));

    expect(await screen.findByText("ORD-3001 · Leg 2")).toBeInTheDocument();
    expect(queueMocks.listAssignedRoadWork).toHaveBeenCalledOnce();
    expect(queueMocks.listAssignedAirWork).toHaveBeenCalledTimes(2);
  });

  it("does not load work when Escort workspace access is forbidden", () => {
    queueMocks.access.current = {
      ...queueMocks.access.current,
      state: "forbidden",
      message: "You don't have permission to use this Escort workspace.",
    };
    render(<EscortQueuePage />);

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(queueMocks.listAssignedRoadWork).not.toHaveBeenCalled();
    expect(queueMocks.listAssignedAirWork).not.toHaveBeenCalled();
  });

  it("offers access verification retry without loading the queue early", async () => {
    const retryAccess = vi.fn();
    queueMocks.access.current = {
      ...queueMocks.access.current,
      state: "failed",
      message: "We couldn't verify your access.",
      retryAccess,
    };
    const user = userEvent.setup();
    render(<EscortQueuePage />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryAccess).toHaveBeenCalledOnce();
    expect(queueMocks.listAssignedRoadWork).not.toHaveBeenCalled();
    expect(queueMocks.listAssignedAirWork).not.toHaveBeenCalled();
  });
});
