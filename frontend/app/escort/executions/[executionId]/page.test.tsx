import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AssignedRoadExecutionDetail,
  ProofOfDelivery,
  WelfareEvidence,
} from "@/lib/escort-execution/types";
import RoadExecutionDetailPage from "./page";

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
  getAssignedRoadExecution: vi.fn(),
  recordRoadWelfare: vi.fn(),
  recordRoadProofOfDelivery: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ executionId: "road-execution-2074-a" }),
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
      getAssignedRoadExecution: detailMocks.getAssignedRoadExecution,
      recordRoadWelfare: detailMocks.recordRoadWelfare,
      recordRoadProofOfDelivery: detailMocks.recordRoadProofOfDelivery,
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

function evidence(note: string, checkpointId: string | null = "checkpoint-1"): WelfareEvidence {
  return {
    id: `evidence-${checkpointId ?? "final"}`,
    eventType: checkpointId ? "CHECKPOINT" : "FINAL_DESTINATION",
    checkpointId,
    photoUrl: "data:image/png;base64,cGhvdG8=",
    photoName: "welfare.png",
    note,
    recordedAt: "2026-10-28T14:30:00-04:00",
  };
}

function proof(): ProofOfDelivery {
  return {
    id: "pod-road-1",
    mode: "ROAD",
    roadLegVehicleId: "road-vehicle-2074-a",
    roadVehicleExecutionId: "road-execution-2074-a",
    routeLegId: "leg-2074-1",
    transportedOrderHorseIds: ["horse-1"],
    recipientName: "Camille Martin",
    proofPhotoUrl: "data:image/png;base64,cHJvb2Y=",
    proofPhotoName: "proof.png",
    proofPhotoIsPreview: true,
    handoverNote: null,
    confirmedByEscortId: "escort-mia",
    deliveredAt: "2026-10-28T19:00:00-04:00",
    completedHandovers: 1,
    requiredHandovers: 1,
    routeLegStatus: "COMPLETED",
    orderStatus: "DELIVERED",
  };
}

function execution(overrides: Partial<AssignedRoadExecutionDetail> = {}): AssignedRoadExecutionDetail {
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
    assignedEscortId: "escort-mia",
    assignedEscortName: "Mia Laurent",
    driverName: "Noah Williams",
    horses: [{ id: "horse-1", name: "Apollo", microchipId: "985141000120101" }],
    checkpoints: [
      {
        id: "checkpoint-1",
        sequenceNo: 1,
        name: "Bluegrass rest area",
        checkpointType: "REST_STOP",
        arrivedAt: "2026-10-28T14:18:00-04:00",
        welfareEvidence: null,
      },
      {
        id: "checkpoint-2",
        sequenceNo: 2,
        name: "Chicago cargo gate",
        checkpointType: "OTHER",
        arrivedAt: null,
        welfareEvidence: null,
      },
    ],
    finalWelfareEvidence: null,
    proofOfDelivery: null,
    availableActions: { checkpointWelfareIds: ["checkpoint-1"], finalWelfare: false, proofOfDelivery: false },
    lastUpdatedAt: "2026-10-28T14:18:00-04:00",
    ...overrides,
  };
}

describe("RoadExecutionDetailPage", () => {
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

  it("shows loading and gates checkpoint/final actions from service capabilities", async () => {
    const request = deferred<AssignedRoadExecutionDetail>();
    detailMocks.getAssignedRoadExecution.mockReturnValueOnce(request.promise);
    render(<RoadExecutionDetailPage />);

    expect(await screen.findByLabelText("Loading ROAD execution")).toBeInTheDocument();
    await act(async () => request.resolve(execution()));

    expect(await screen.findByLabelText("Welfare photo for Bluegrass rest area checkpoint")).toBeEnabled();
    expect(screen.queryByLabelText("Welfare photo for Chicago cargo gate checkpoint")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Welfare photo for TRK-101 final destination")).not.toBeInTheDocument();
    expect(screen.getByText(/only after this Vehicle reaches the checkpoint/i)).toBeInTheDocument();
    expect(screen.getByText(/must record destination arrival before final welfare/i)).toBeInTheDocument();
  });

  it("shows final welfare only after the service reports destination readiness", async () => {
    detailMocks.getAssignedRoadExecution.mockResolvedValueOnce(execution({
      status: "DESTINATION",
      destinationArrivedAt: "2026-10-28T18:15:00-05:00",
      availableActions: { checkpointWelfareIds: [], finalWelfare: true, proofOfDelivery: false },
    }));
    render(<RoadExecutionDetailPage />);

    expect(await screen.findByLabelText("Welfare photo for TRK-101 final destination")).toBeEnabled();
  });

  it("retries a detail loading error", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    detailMocks.getAssignedRoadExecution
      .mockRejectedValueOnce(new EscortExecutionError("Execution unavailable.", "REQUEST_FAILED"))
      .mockResolvedValueOnce(execution());
    const user = userEvent.setup();
    render(<RoadExecutionDetailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Execution unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: /TRK-101/ })).toBeInTheDocument();
    expect(detailMocks.getAssignedRoadExecution).toHaveBeenCalledTimes(2);
  });

  it("renders forbidden access without calling the execution service", () => {
    detailMocks.access.current = {
      ...detailMocks.access.current,
      state: "forbidden",
      message: "This workspace is forbidden.",
    };
    render(<RoadExecutionDetailPage />);

    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(detailMocks.getAssignedRoadExecution).not.toHaveBeenCalled();
  });

  it("renders a foreign-assignment failure returned by the service", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    detailMocks.getAssignedRoadExecution.mockRejectedValueOnce(
      new EscortExecutionError("This Vehicle is assigned to another Escort.", "FORBIDDEN"),
    );
    render(<RoadExecutionDetailPage />);

    expect(await screen.findByRole("heading", { name: "This Vehicle isn't assigned to you" })).toBeInTheDocument();
    expect(screen.getByText("This Vehicle is assigned to another Escort.")).toBeInTheDocument();
    expect(detailMocks.recordRoadWelfare).not.toHaveBeenCalled();
  });

  it("refreshes and renders persisted evidence after a stale-state response", async () => {
    const { EscortExecutionError } = await import("@/lib/escort-execution/types");
    const persisted = execution({
      pendingCheckpointWelfareCount: 0,
      checkpoints: [
        { ...execution().checkpoints[0], welfareEvidence: evidence("Persisted by the service.") },
        execution().checkpoints[1],
      ],
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
    });
    detailMocks.getAssignedRoadExecution
      .mockResolvedValueOnce(execution())
      .mockResolvedValueOnce(persisted);
    detailMocks.recordRoadWelfare.mockRejectedValueOnce(
      new EscortExecutionError("The execution changed while saving.", "STALE_STATE"),
    );
    const user = userEvent.setup();
    render(<RoadExecutionDetailPage />);

    await user.upload(
      await screen.findByLabelText("Welfare photo for Bluegrass rest area checkpoint"),
      new File(["photo"], "welfare.png", { type: "image/png" }),
    );
    await user.type(screen.getByLabelText("Welfare note for Bluegrass rest area checkpoint"), "Local note");
    await user.click(screen.getByRole("button", { name: "Save welfare update" }));

    expect(await screen.findByRole("status")).toHaveTextContent("latest persisted state was loaded");
    expect(await screen.findByText("Persisted by the service.")).toBeInTheDocument();
    expect(detailMocks.getAssignedRoadExecution).toHaveBeenCalledTimes(2);
  });

  it("allows one mutation at a time and reads saved evidence back through the service", async () => {
    const first = execution({
      reachedCheckpointCount: 2,
      pendingCheckpointWelfareCount: 2,
      checkpoints: execution().checkpoints.map((checkpoint) => ({
        ...checkpoint,
        arrivedAt: "2026-10-28T14:18:00-04:00",
      })),
      availableActions: { checkpointWelfareIds: ["checkpoint-1", "checkpoint-2"], finalWelfare: false, proofOfDelivery: false },
    });
    const saved = execution({
      pendingCheckpointWelfareCount: 0,
      checkpoints: first.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        welfareEvidence: evidence(`Saved ${checkpoint.name}.`, checkpoint.id),
      })),
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
    });
    const mutation = deferred<void>();
    detailMocks.getAssignedRoadExecution
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(saved);
    detailMocks.recordRoadWelfare.mockReturnValueOnce(mutation.promise);
    const user = userEvent.setup();
    const { container } = render(<RoadExecutionDetailPage />);

    const firstPhoto = await screen.findByLabelText("Welfare photo for Bluegrass rest area checkpoint");
    const secondPhoto = screen.getByLabelText("Welfare photo for Chicago cargo gate checkpoint");
    await user.upload(firstPhoto, new File(["one"], "one.png", { type: "image/png" }));
    await user.type(screen.getByLabelText("Welfare note for Bluegrass rest area checkpoint"), "First note");
    await user.upload(secondPhoto, new File(["two"], "two.png", { type: "image/png" }));
    await user.type(screen.getByLabelText("Welfare note for Chicago cargo gate checkpoint"), "Second note");
    await user.click(screen.getAllByRole("button", { name: "Save welfare update" })[0]);

    await waitFor(() => expect(detailMocks.recordRoadWelfare).toHaveBeenCalledTimes(1));
    expect(firstPhoto).toBeDisabled();
    expect(secondPhoto).toBeDisabled();
    fireEvent.submit(container.querySelectorAll("form")[1]);
    expect(detailMocks.recordRoadWelfare).toHaveBeenCalledTimes(1);

    await act(async () => mutation.resolve());
    expect(await screen.findByText("Saved Bluegrass rest area.")).toBeInTheDocument();
    expect(screen.getByText("Saved Chicago cargo gate.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("saved and read back from the service state");
  });

  it("submits one ROAD PoD at a time and renders persisted proof read-back", async () => {
    const ready = execution({
      isFinalLeg: true,
      status: "COMPLETED",
      destinationArrivedAt: "2026-10-28T18:15:00-05:00",
      finalWelfareRecorded: true,
      finalWelfareEvidence: evidence("Final welfare is saved.", null),
      proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 1, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: true },
    });
    const saved = execution({
      ...ready,
      routeLegStatus: "COMPLETED",
      proofOfDeliveryRecorded: true,
      proofOfDeliveryAvailable: false,
      proofOfDelivery: proof(),
      handoverProgress: { completedHandovers: 1, requiredHandovers: 1, routeLegStatus: "COMPLETED", orderStatus: "DELIVERED" },
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
    });
    const mutation = deferred<ProofOfDelivery>();
    detailMocks.getAssignedRoadExecution.mockResolvedValueOnce(ready).mockResolvedValueOnce(saved);
    detailMocks.recordRoadProofOfDelivery.mockReturnValueOnce(mutation.promise);
    const user = userEvent.setup();
    const { container } = render(<RoadExecutionDetailPage />);

    await user.type(await screen.findByLabelText(/Recipient name/), "Camille Martin");
    await user.upload(screen.getByLabelText(/Proof photo for/), new File(["proof"], "proof.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    await waitFor(() => expect(detailMocks.recordRoadProofOfDelivery).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    fireEvent.submit(container.querySelector(".escort-pod-form")!);
    expect(detailMocks.recordRoadProofOfDelivery).toHaveBeenCalledOnce();

    await act(async () => mutation.resolve(proof()));
    expect(await screen.findByText("Saved Proof of Delivery")).toBeInTheDocument();
    expect(screen.getByText("Camille Martin")).toBeInTheDocument();
    expect(screen.getByText(/Preview image from original file/)).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("does not replay a pending PoD when navigating away and reads the persisted handover on return", async () => {
    const ready = execution({
      isFinalLeg: true,
      status: "COMPLETED",
      destinationArrivedAt: "2026-10-28T18:15:00-05:00",
      finalWelfareRecorded: true,
      finalWelfareEvidence: evidence("Final welfare is saved.", null),
      proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 1, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: true },
    });
    const saved = execution({
      ...ready,
      routeLegStatus: "COMPLETED",
      proofOfDeliveryRecorded: true,
      proofOfDeliveryAvailable: false,
      proofOfDelivery: proof(),
      handoverProgress: { completedHandovers: 1, requiredHandovers: 1, routeLegStatus: "COMPLETED", orderStatus: "DELIVERED" },
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
    });
    const mutation = deferred<ProofOfDelivery>();
    detailMocks.getAssignedRoadExecution
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(saved)
      .mockResolvedValueOnce(saved);
    detailMocks.recordRoadProofOfDelivery.mockReturnValueOnce(mutation.promise);
    const user = userEvent.setup();
    const mounted = render(<RoadExecutionDetailPage />);

    await user.type(await screen.findByLabelText(/Recipient name/), "Camille Martin");
    await user.upload(screen.getByLabelText(/Proof photo for/), new File(["proof"], "proof.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    mounted.unmount();
    await act(async () => mutation.resolve(proof()));

    render(<RoadExecutionDetailPage />);
    expect(await screen.findByText("Saved Proof of Delivery")).toBeInTheDocument();
    expect(detailMocks.recordRoadProofOfDelivery).toHaveBeenCalledOnce();
  });

  it("locks ROAD mutations through repeated read-back failures and never replays PoD", async () => {
    const ready = execution({
      isFinalLeg: true,
      status: "COMPLETED",
      destinationArrivedAt: "2026-10-28T18:15:00-05:00",
      finalWelfareRecorded: true,
      finalWelfareEvidence: evidence("Final welfare is saved.", null),
      proofOfDeliveryAvailable: true,
      handoverProgress: { completedHandovers: 0, requiredHandovers: 1, routeLegStatus: "IN_PROGRESS", orderStatus: "IN_PROGRESS" },
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: true },
    });
    const saved = execution({
      ...ready,
      routeLegStatus: "COMPLETED",
      proofOfDeliveryRecorded: true,
      proofOfDeliveryAvailable: false,
      proofOfDelivery: proof(),
      handoverProgress: { completedHandovers: 1, requiredHandovers: 1, routeLegStatus: "COMPLETED", orderStatus: "DELIVERED" },
      availableActions: { checkpointWelfareIds: [], finalWelfare: false, proofOfDelivery: false },
    });
    detailMocks.getAssignedRoadExecution
      .mockResolvedValueOnce(ready)
      .mockRejectedValueOnce(new Error("Read-back unavailable."))
      .mockRejectedValueOnce(new Error("Still unavailable."))
      .mockResolvedValueOnce(saved);
    detailMocks.recordRoadProofOfDelivery.mockResolvedValueOnce(proof());
    const user = userEvent.setup();
    render(<RoadExecutionDetailPage />);

    await user.type(await screen.findByLabelText(/Recipient name/), "Camille Martin");
    await user.upload(screen.getByLabelText(/Proof photo for/), new File(["proof"], "proof.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("persisted result could not be confirmed");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Retry saved-state read-back" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("failed again");
    expect(detailMocks.recordRoadProofOfDelivery).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Retry saved-state read-back" }));

    expect(await screen.findByText("Saved Proof of Delivery")).toBeInTheDocument();
    expect(detailMocks.recordRoadProofOfDelivery).toHaveBeenCalledOnce();
  });
});
