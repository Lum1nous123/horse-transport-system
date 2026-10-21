import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignedRoadExecutionSummary } from "@/lib/escort-execution/types";
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
  });

  it("shows loading before rendering the empty assigned-work state", async () => {
    const request = deferred<{ executions: AssignedRoadExecutionSummary[] }>();
    queueMocks.listAssignedRoadWork.mockReturnValueOnce(request.promise);
    render(<EscortQueuePage />);

    expect(await screen.findByLabelText("Loading assigned ROAD work")).toBeInTheDocument();
    await act(async () => request.resolve({ executions: [] }));

    expect(await screen.findByRole("heading", { name: "No ROAD welfare action is assigned" })).toBeInTheDocument();
  });

  it("retries a service error and renders the assigned Vehicle returned by the boundary", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    queueMocks.listAssignedRoadWork
      .mockRejectedValueOnce(new EscortExecutionError("Queue unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce({ executions: [assignedExecution()] });
    const user = userEvent.setup();
    render(<EscortQueuePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Queue unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "TRK-101" })).toBeInTheDocument();
    expect(screen.getByText("Record checkpoint welfare")).toBeInTheDocument();
    expect(queueMocks.listAssignedRoadWork).toHaveBeenCalledTimes(2);
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
  });
});
