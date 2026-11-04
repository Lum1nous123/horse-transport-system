import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignedAirExecutionDetail, ProofOfDelivery, WelfareEvidence } from "@/lib/escort-execution/types";
import AirExecutionDetailPage from "./page";

const detailMocks = vi.hoisted(() => ({
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
  getAssignedAirExecution: vi.fn(),
  startAirExecution: vi.fn(),
  recordAirDestinationArrival: vi.fn(),
  recordAirWelfare: vi.fn(),
  completeAirExecution: vi.fn(),
  recordAirProofOfDelivery: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ executionId: "air-execution-ready" }),
  useRouter: () => ({ replace: detailMocks.replace }),
}));

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: React.ComponentProps<"img"> & { unoptimized?: boolean }) => {
    void unoptimized;
    return createElement("img", props);
  },
}));

vi.mock("@/lib/escort-execution/use-escort-access", () => ({
  useEscortAccess: () => detailMocks.access.current,
}));

vi.mock("@/lib/escort-execution/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/escort-execution/service")>(
    "@/lib/escort-execution/service",
  );
  return {
    ...actual,
    getEscortExecutionService: () => ({
      listAssignedRoadWork: vi.fn(),
      getAssignedRoadExecution: vi.fn(),
      recordRoadWelfare: vi.fn(),
      listAssignedAirWork: vi.fn(),
      getAssignedAirExecution: detailMocks.getAssignedAirExecution,
      startAirExecution: detailMocks.startAirExecution,
      recordAirDestinationArrival: detailMocks.recordAirDestinationArrival,
      recordAirWelfare: detailMocks.recordAirWelfare,
      completeAirExecution: detailMocks.completeAirExecution,
      recordAirProofOfDelivery: detailMocks.recordAirProofOfDelivery,
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

function evidence(): WelfareEvidence {
  return {
    id: "welfare-air",
    eventType: "FINAL_DESTINATION",
    checkpointId: null,
    photoUrl: "data:image/png;base64,cGhvdG8=",
    photoName: "air-arrival.png",
    note: "Horses arrived alert and hydrated.",
    recordedAt: "2026-10-31T08:31:00Z",
  };
}

function proof(): ProofOfDelivery {
  return {
    id: "pod-air-1",
    mode: "AIR",
    airLegExecutionId: "air-execution-ready",
    routeLegId: "air-leg-3002-1",
    transportedOrderHorseIds: [],
    recipientName: "Aiko Tanaka",
    proofPhotoUrl: "data:image/png;base64,cHJvb2Y=",
    proofPhotoName: "air-proof.png",
    proofPhotoIsPreview: true,
    handoverNote: "Received safely.",
    confirmedByEscortId: "escort-mia",
    deliveredAt: "2026-11-01T06:10:00Z",
    completedHandovers: 1,
    requiredHandovers: 1,
    routeLegStatus: "COMPLETED",
    orderStatus: "DELIVERED",
  };
}

function execution(overrides: Partial<AssignedAirExecutionDetail> = {}): AssignedAirExecutionDetail {
  return {
    executionId: "air-execution-ready",
    orderId: "order-3002",
    orderCode: "ORD-3002",
    routeLegId: "air-leg-3002-1",
    routeLegSequenceNo: 1,
    routeLegStatus: "READY",
    isFinalLeg: false,
    origin: "Dallas Fort Worth Cargo",
    destination: "Amsterdam Schiphol Cargo",
    plannedDepartureAt: "2026-10-31T11:30:00-05:00",
    plannedArrivalAt: "2026-11-01T06:40:00+01:00",
    status: "NOT_STARTED",
    welfareRecorded: false,
    proofOfDeliveryRecorded: false,
    proofOfDeliveryAvailable: false,
    handoverProgress: { completedHandovers: 0, requiredHandovers: 0, routeLegStatus: "READY", orderStatus: "IN_PROGRESS" },
    availableActions: { start: true, arriveAtDestination: false, recordWelfare: false, complete: false },
    assignedEscortId: "escort-mia",
    assignedEscortName: "Mia Laurent",
    startedAt: null,
    destinationArrivedAt: null,
    completedAt: null,
    welfareEvidence: null,
    proofOfDelivery: null,
    lastUpdatedAt: "2026-10-30T10:00:00Z",
    ...overrides,
  };
}

describe("AirExecutionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detailMocks.access.current = {
      state: "allowed",
      preview: false,
      previewEscortId: "escort-mia",
      previewEscortName: "Mia Laurent",
      message: "",
      retryAccess: vi.fn(),
    };
  });

  it("shows loading and renders only service-authorized start action without Driver controls", async () => {
    const request = deferred<AssignedAirExecutionDetail>();
    detailMocks.getAssignedAirExecution.mockReturnValueOnce(request.promise);
    render(<AirExecutionDetailPage />);

    expect(await screen.findByLabelText("Loading AIR execution")).toBeInTheDocument();
    await act(async () => request.resolve(execution()));

    expect(await screen.findByRole("button", { name: "Start AIR execution" })).toBeEnabled();
    expect(screen.queryByText(/Assigned Driver/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /destination arrival/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Welfare photo/i)).not.toBeInTheDocument();
  });

  it("renders upcoming work as read-only until the RouteLeg becomes ready", async () => {
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(execution({
      routeLegStatus: "PLANNED",
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    }));
    render(<AirExecutionDetailPage />);

    expect(await screen.findByText("Waiting for RouteLeg readiness")).toBeInTheDocument();
    expect(screen.getByText(/No AIR action is currently available/i)).toBeInTheDocument();
  });

  it("prevents concurrent UI mutations and reads the persisted start result back", async () => {
    const mutation = deferred<void>();
    const started = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T16:35:00Z",
      availableActions: { start: false, arriveAtDestination: true, recordWelfare: false, complete: false },
    });
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(execution()).mockResolvedValueOnce(started);
    detailMocks.startAirExecution.mockReturnValueOnce(mutation.promise);
    render(<AirExecutionDetailPage />);

    const start = await screen.findByRole("button", { name: "Start AIR execution" });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();
    expect(start).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();

    await act(async () => mutation.resolve());
    expect(await screen.findByRole("button", { name: "Record destination arrival" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("started and read back");
  });

  it("records destination welfare with validation and renders persisted evidence", async () => {
    const atDestination = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      startedAt: "2026-10-31T16:35:00Z",
      destinationArrivedAt: "2026-11-01T05:45:00Z",
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: true, complete: false },
    });
    const saved = execution({
      ...atDestination,
      welfareRecorded: true,
      welfareEvidence: evidence(),
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: true },
    });
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(atDestination).mockResolvedValueOnce(saved);
    detailMocks.recordAirWelfare.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    await user.click(await screen.findByRole("button", { name: "Save AIR welfare" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a welfare photo");
    await user.upload(screen.getByLabelText("Welfare photo for ORD-3002 AIR destination"), new File(["photo"], "air-arrival.png", { type: "image/png" }));
    await user.type(screen.getByLabelText("Welfare note for ORD-3002 AIR destination"), "  Horses arrived alert and hydrated.  ");
    await user.click(screen.getByRole("button", { name: "Save AIR welfare" }));

    expect(await screen.findByText("Horses arrived alert and hydrated.")).toBeInTheDocument();
    expect(detailMocks.recordAirWelfare).toHaveBeenCalledWith("air-execution-ready", expect.objectContaining({ note: "Horses arrived alert and hydrated." }));
    expect(screen.getByRole("button", { name: "Complete AIR execution" })).toBeInTheDocument();
  });

  it("records destination arrival and exposes welfare only after service read-back", async () => {
    const inProgress = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T16:35:00Z",
      availableActions: { start: false, arriveAtDestination: true, recordWelfare: false, complete: false },
    });
    const atDestination = execution({
      ...inProgress,
      status: "DESTINATION",
      destinationArrivedAt: "2026-11-01T05:45:00Z",
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: true, complete: false },
    });
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(inProgress).mockResolvedValueOnce(atDestination);
    detailMocks.recordAirDestinationArrival.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    await user.click(await screen.findByRole("button", { name: "Record destination arrival" }));

    expect(await screen.findByLabelText("Welfare photo for ORD-3002 AIR destination")).toBeInTheDocument();
    expect(detailMocks.recordAirDestinationArrival).toHaveBeenCalledWith("air-execution-ready");
    expect(detailMocks.getAssignedAirExecution).toHaveBeenCalledTimes(2);
  });

  it("completes a non-final AIR execution only after persisted welfare", async () => {
    const readyToComplete = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      startedAt: "2026-10-31T16:35:00Z",
      destinationArrivedAt: "2026-11-01T05:45:00Z",
      welfareRecorded: true,
      welfareEvidence: evidence(),
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: true },
    });
    const completed = execution({
      ...readyToComplete,
      routeLegStatus: "COMPLETED",
      status: "COMPLETED",
      completedAt: "2026-11-01T06:01:00Z",
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    });
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(readyToComplete).mockResolvedValueOnce(completed);
    detailMocks.completeAirExecution.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    await user.click(await screen.findByRole("button", { name: "Complete AIR execution" }));

    expect(await screen.findByText("AIR execution completed", { selector: "strong" })).toBeInTheDocument();
    expect(detailMocks.completeAirExecution).toHaveBeenCalledWith("air-execution-ready");
    expect(detailMocks.getAssignedAirExecution).toHaveBeenCalledTimes(2);
  });

  it("shows final welfare as awaiting PoD and never offers completion", async () => {
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(execution({
      isFinalLeg: true,
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      startedAt: "2026-10-30T20:02:00Z",
      destinationArrivedAt: "2026-10-31T08:23:00Z",
      welfareRecorded: true,
      proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 1, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
      welfareEvidence: evidence(),
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    }));
    render(<AirExecutionDetailPage />);

    expect(await screen.findByRole("button", { name: "Confirm handover" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete AIR execution" })).not.toBeInTheDocument();
    expect(screen.getByText("air-arrival.png")).toBeInTheDocument();
  });

  it("single-flights final AIR PoD and renders service-confirmed delivery read-back", async () => {
    const ready = execution({
      isFinalLeg: true,
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      startedAt: "2026-10-30T20:02:00Z",
      destinationArrivedAt: "2026-10-31T08:23:00Z",
      welfareRecorded: true,
      proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 1, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
      welfareEvidence: evidence(),
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: false },
    });
    const delivered = execution({
      ...ready,
      routeLegStatus: "COMPLETED",
      status: "COMPLETED",
      completedAt: proof().deliveredAt,
      proofOfDeliveryRecorded: true,
      proofOfDeliveryAvailable: false,
      proofOfDelivery: proof(),
      handoverProgress: { completedHandovers: 1, requiredHandovers: 1, routeLegStatus: "COMPLETED", orderStatus: "DELIVERED" },
    });
    const mutation = deferred<ProofOfDelivery>();
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(ready).mockResolvedValueOnce(delivered);
    detailMocks.recordAirProofOfDelivery.mockReturnValueOnce(mutation.promise);
    const user = userEvent.setup();
    const { container } = render(<AirExecutionDetailPage />);

    await user.type(await screen.findByLabelText(/Recipient name/), "Aiko Tanaka");
    await user.upload(screen.getByLabelText(/Proof photo for/), new File(["proof"], "air-proof.png", { type: "image/png" }));
    await user.type(screen.getByLabelText(/Handover note/), "Received safely.");
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    expect(detailMocks.recordAirProofOfDelivery).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    fireEvent.submit(container.querySelector(".escort-pod-form")!);
    expect(detailMocks.recordAirProofOfDelivery).toHaveBeenCalledOnce();

    await act(async () => mutation.resolve(proof()));
    expect(await screen.findByText("Saved Proof of Delivery")).toBeInTheDocument();
    expect(screen.getByText("Aiko Tanaka")).toBeInTheDocument();
    expect(screen.getByText(/Preview image from original file/)).toBeInTheDocument();
    expect(detailMocks.recordAirProofOfDelivery).toHaveBeenCalledWith("air-leg-3002-1", expect.objectContaining({
      recipientName: "Aiko Tanaka",
      note: "Received safely.",
    }));
  });

  it("recovers persisted state after a stale mutation response", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    const started = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T16:35:00Z",
      availableActions: { start: false, arriveAtDestination: true, recordWelfare: false, complete: false },
    });
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(execution()).mockResolvedValueOnce(started);
    detailMocks.startAirExecution.mockRejectedValueOnce(new EscortExecutionError("AIR state changed while saving.", "STALE_STATE"));
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    await user.click(await screen.findByRole("button", { name: "Start AIR execution" }));
    expect(await screen.findByText(/latest persisted state was loaded/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Record destination arrival" })).toBeInTheDocument();
    expect(detailMocks.getAssignedAirExecution).toHaveBeenCalledTimes(2);
  });

  it("reconciles an uncertain network write through detail read-back without replay", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    const started = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T16:35:00Z",
      availableActions: { start: false, arriveAtDestination: true, recordWelfare: false, complete: false },
    });
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(execution()).mockResolvedValueOnce(started);
    detailMocks.startAirExecution.mockRejectedValueOnce(new EscortExecutionError(
      "The connection failed after submission.",
      "REQUEST_FAILED",
      { status: 0, apiCode: "NETWORK_ERROR" },
    ));
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    await user.click(await screen.findByRole("button", { name: "Start AIR execution" }));

    expect(await screen.findByRole("status")).toHaveTextContent("mutation was not replayed");
    expect(await screen.findByRole("button", { name: "Record destination arrival" })).toBeInTheDocument();
    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();
    expect(detailMocks.getAssignedAirExecution).toHaveBeenCalledTimes(2);
  });

  it("locks mutations when a successful write cannot be read back and reconciles without replay", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    const started = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T16:35:00Z",
      availableActions: { start: false, arriveAtDestination: true, recordWelfare: false, complete: false },
    });
    detailMocks.getAssignedAirExecution
      .mockResolvedValueOnce(execution())
      .mockRejectedValueOnce(new EscortExecutionError("Read-back unavailable.", "REQUEST_FAILED"))
      .mockRejectedValueOnce(new EscortExecutionError("Still unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce(started);
    detailMocks.startAirExecution.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    const start = await screen.findByRole("button", { name: "Start AIR execution" });
    await user.click(start);

    expect(await screen.findByRole("alert")).toHaveTextContent("persisted result could not be confirmed");
    expect(screen.getByText(/AIR mutations are locked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    fireEvent.click(start);
    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Retry saved-state read-back" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("failed again");
    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Retry saved-state read-back" }));
    expect(await screen.findByRole("button", { name: "Record destination arrival" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No mutation was sent again");
    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();
    expect(detailMocks.getAssignedAirExecution).toHaveBeenCalledTimes(4);
  });

  it("keeps stale actions locked when recovery read-back repeatedly fails", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    const started = execution({
      routeLegStatus: "IN_PROGRESS",
      status: "IN_PROGRESS",
      startedAt: "2026-10-31T16:35:00Z",
      availableActions: { start: false, arriveAtDestination: true, recordWelfare: false, complete: false },
    });
    detailMocks.getAssignedAirExecution
      .mockResolvedValueOnce(execution())
      .mockRejectedValueOnce(new EscortExecutionError("Recovery unavailable.", "REQUEST_FAILED"))
      .mockRejectedValueOnce(new EscortExecutionError("Recovery still unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce(started);
    detailMocks.startAirExecution.mockRejectedValueOnce(new EscortExecutionError("AIR state changed.", "STALE_STATE"));
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    const start = await screen.findByRole("button", { name: "Start AIR execution" });
    await user.click(start);
    expect(await screen.findByRole("alert")).toHaveTextContent("recovery read-back failed");
    fireEvent.click(start);
    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Retry saved-state read-back" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("failed again");
    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Retry saved-state read-back" }));
    expect(await screen.findByRole("button", { name: "Record destination arrival" })).toBeInTheDocument();
    expect(detailMocks.startAirExecution).toHaveBeenCalledOnce();
  });

  it("fails safely for contradictory capabilities, including final-leg Complete", async () => {
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(execution({
      isFinalLeg: true,
      routeLegStatus: "IN_PROGRESS",
      status: "DESTINATION",
      welfareRecorded: true,
      welfareEvidence: evidence(),
      destinationArrivedAt: "2026-11-01T05:45:00Z",
      availableActions: { start: false, arriveAtDestination: false, recordWelfare: false, complete: true },
    }));
    render(<AirExecutionDetailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("conflicts with the persisted lifecycle state");
    expect(screen.queryByRole("button", { name: "Complete AIR execution" })).not.toBeInTheDocument();
    expect(detailMocks.completeAirExecution).not.toHaveBeenCalled();
  });

  it("does not render multiple contradictory AIR actions", async () => {
    detailMocks.getAssignedAirExecution.mockResolvedValueOnce(execution({
      availableActions: { start: true, arriveAtDestination: true, recordWelfare: false, complete: false },
    }));
    render(<AirExecutionDetailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("multiple conflicting AIR actions");
    expect(screen.queryByRole("button", { name: "Start AIR execution" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record destination arrival" })).not.toBeInTheDocument();
  });

  it("retries request failures and blocks foreign assignments", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    detailMocks.getAssignedAirExecution
      .mockRejectedValueOnce(new EscortExecutionError("AIR execution unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce(execution());
    const user = userEvent.setup();
    const { unmount } = render(<AirExecutionDetailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("AIR execution unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Start AIR execution" })).toBeInTheDocument();
    unmount();

    detailMocks.getAssignedAirExecution.mockReset();
    detailMocks.getAssignedAirExecution.mockRejectedValueOnce(new EscortExecutionError("Assigned to another Escort.", "FORBIDDEN"));
    render(<AirExecutionDetailPage />);
    expect(await screen.findByRole("heading", { name: "This AIR RouteLeg isn't assigned to you" })).toBeInTheDocument();
    expect(detailMocks.startAirExecution).not.toHaveBeenCalled();
  });

  it("offers access verification retry without calling the AIR service", async () => {
    const retryAccess = vi.fn();
    detailMocks.access.current = {
      ...detailMocks.access.current,
      state: "failed",
      message: "We couldn't verify access.",
      retryAccess,
    };
    const user = userEvent.setup();
    render(<AirExecutionDetailPage />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryAccess).toHaveBeenCalledOnce();
    expect(detailMocks.getAssignedAirExecution).not.toHaveBeenCalled();
  });
});
