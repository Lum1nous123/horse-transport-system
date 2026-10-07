import {
  SpecialistWorkspaceError,
  type AssignedSpecialistOrderDetail,
  type AssignedSpecialistOrderSummary,
  type DocumentProgress,
  type DocumentType,
  type DocumentVersionStatus,
  type ReviewDecision,
  type SpecialistDocument,
  type SpecialistHorse,
  type SpecialistOrderQueues,
  type TransportSpecialistWorkspaceService,
} from "./types";
import {
  PREVIEW_TS_WORKSPACE_STORAGE_KEY,
  getPreviewSpecialistIdentity,
  readPreviewAssignmentRecipients,
} from "@/lib/preview-workflow/assignment-bridge";

const STORAGE_KEY = PREVIEW_TS_WORKSPACE_STORAGE_KEY;
const PREVIEW_TS_NAME = "Alex Carter";

type MockOrderState = Omit<
  AssignedSpecialistOrderDetail,
  "progress" | "eligibility" | "finalConfirmationStatus"
>;

const documentTypes: DocumentType[] = [
  "HORSE_PASSPORT_OR_IDENTIFICATION",
  "VACCINATION_CERTIFICATE",
  "VETERINARY_HEALTH_CERTIFICATE",
  "OWNERSHIP_CERTIFICATE",
  "EXPORT_IMPORT_PERMIT",
];

const documentNames: Record<DocumentType, string> = {
  HORSE_PASSPORT_OR_IDENTIFICATION: "horse-passport-preview.txt",
  VACCINATION_CERTIFICATE: "vaccination-certificate-preview.txt",
  VETERINARY_HEALTH_CERTIFICATE: "veterinary-health-certificate-preview.txt",
  OWNERSHIP_CERTIFICATE: "ownership-certificate-preview.txt",
  EXPORT_IMPORT_PERMIT: "export-import-permit-preview.txt",
};

function version(
  orderId: string,
  horseIndex: number,
  type: DocumentType,
  status: DocumentVersionStatus,
  versionNo = 1,
): SpecialistDocument["versions"][number] {
  const suffix = type.toLowerCase().replaceAll("_", "-");
  const submitted = status === "DRAFT" ? null : `2026-10-0${Math.min(6, horseIndex + 2)}T09:30:00+07:00`;
  return {
    id: `${orderId}-horse-${horseIndex}-${suffix}-v${versionNo}`,
    versionNo,
    status,
    isCurrent: true,
    fileName: documentNames[type].replace("-preview.txt", `-v${versionNo}-preview.txt`),
    fileUrl: "/mock-horse-document.txt",
    expiryDate: type === "VACCINATION_CERTIFICATE" || type === "VETERINARY_HEALTH_CERTIFICATE"
      ? "2027-06-30"
      : null,
    submittedAt: submitted,
    reviewedAt: status === "APPROVED" || status === "REJECTED" ? "2026-10-05T14:20:00+07:00" : null,
    rejectionReason: status === "REJECTED" ? "The issuing authority stamp is not visible. Upload a complete scan." : null,
  };
}

function horse(
  orderId: string,
  horseIndex: number,
  displayName: string,
  statuses: DocumentVersionStatus[],
): SpecialistHorse {
  return {
    id: `${orderId}-horse-${horseIndex}`,
    displayName,
    microchipId: `98514100012${horseIndex.toString().padStart(3, "0")}`,
    documents: documentTypes.map((type, index) => {
      const status = statuses[index] ?? "DRAFT";
      const currentVersionNo = status === "PENDING_REVIEW" && type === "OWNERSHIP_CERTIFICATE" ? 2 : 1;
      const current = version(orderId, horseIndex, type, status, currentVersionNo);
      if (currentVersionNo === 1) {
        return { id: `${orderId}-horse-${horseIndex}-${type.toLowerCase()}`, type, required: true, versions: [current] };
      }
      const history = version(orderId, horseIndex, type, "REJECTED", 1);
      history.isCurrent = false;
      history.rejectionReason = "The previous upload did not show the complete ownership record.";
      return { id: `${orderId}-horse-${horseIndex}-${type.toLowerCase()}`, type, required: true, versions: [current, history] };
    }),
  };
}

const initialOrders: MockOrderState[] = [
  {
    id: "order-2061",
    orderCode: "ORD-2061",
    origin: "Saumur, France",
    destination: "Amsterdam, Netherlands",
    transportMode: "ROAD",
    requestedDepartureAt: "2026-10-22T08:30:00+07:00",
    horseCount: 1,
    customerName: "Jordan Lee",
    assignedAt: "2026-10-06T09:10:00+07:00",
    assignedTransportSpecialistName: PREVIEW_TS_NAME,
    assignedFleetRouteCoordinatorName: "Taylor Nguyen",
    documentCompletionDeadlineAt: "2026-10-14T17:00:00+07:00",
    horses: [horse("order-2061", 1, "Silver Comet", ["APPROVED", "APPROVED", "APPROVED", "PENDING_REVIEW", "PENDING_REVIEW"])],
    documentPhaseLocked: false,
    finalConfirmedAt: null,
    finalConfirmedBy: null,
  },
  {
    id: "order-2058",
    orderCode: "ORD-2058",
    origin: "Lexington, United States",
    destination: "Brussels, Belgium",
    transportMode: "COMBINED",
    requestedDepartureAt: "2026-10-19T09:00:00+07:00",
    horseCount: 3,
    customerName: "Morgan Taylor",
    assignedAt: "2026-10-06T10:25:00+07:00",
    assignedTransportSpecialistName: PREVIEW_TS_NAME,
    assignedFleetRouteCoordinatorName: "Jordan Ellis",
    documentCompletionDeadlineAt: null,
    horses: [
      horse("order-2058", 1, "Northwind", ["APPROVED", "PENDING_REVIEW", "DRAFT", "APPROVED", "REJECTED"]),
      horse("order-2058", 2, "Blue Meridian", ["APPROVED", "DRAFT", "DRAFT", "APPROVED", "PENDING_REVIEW"]),
      horse("order-2058", 3, "Kingsbridge", ["PENDING_REVIEW", "APPROVED", "DRAFT", "APPROVED", "DRAFT"]),
    ],
    documentPhaseLocked: false,
    finalConfirmedAt: null,
    finalConfirmedBy: null,
  },
  {
    id: "order-2046",
    orderCode: "ORD-2046",
    origin: "Aachen, Germany",
    destination: "Doha, Qatar",
    transportMode: "AIR",
    requestedDepartureAt: "2026-10-16T13:00:00+07:00",
    horseCount: 2,
    customerName: "Casey Morgan",
    assignedAt: "2026-10-04T10:15:00+07:00",
    assignedTransportSpecialistName: "Brooke Mitchell",
    assignedFleetRouteCoordinatorName: "Jordan Ellis",
    documentCompletionDeadlineAt: null,
    horses: [
      horse("order-2046", 1, "Desert Crown", ["APPROVED", "PENDING_REVIEW", "DRAFT", "APPROVED", "DRAFT"]),
      horse("order-2046", 2, "Aachen Star", ["APPROVED", "DRAFT", "DRAFT", "PENDING_REVIEW", "DRAFT"]),
    ],
    documentPhaseLocked: false,
    finalConfirmedAt: null,
    finalConfirmedBy: null,
  },
  {
    id: "order-2037",
    orderCode: "ORD-2037",
    origin: "Newmarket, United Kingdom",
    destination: "Chantilly, France",
    transportMode: "ROAD",
    requestedDepartureAt: "2026-10-18T07:00:00+07:00",
    horseCount: 1,
    customerName: "Avery Bennett",
    assignedAt: "2026-10-02T11:45:00+07:00",
    assignedTransportSpecialistName: PREVIEW_TS_NAME,
    assignedFleetRouteCoordinatorName: "Avery Wilson",
    documentCompletionDeadlineAt: "2026-10-09T16:00:00+07:00",
    horses: [horse("order-2037", 1, "Morning Vale", ["APPROVED", "APPROVED", "APPROVED", "APPROVED", "APPROVED"])],
    documentPhaseLocked: true,
    finalConfirmedAt: "2026-10-05T15:40:00+07:00",
    finalConfirmedBy: PREVIEW_TS_NAME,
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pause() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 220));
}

function scenario() {
  return new URLSearchParams(window.location.search).get("scenario");
}

function maybeThrowScenarioFailure() {
  if (scenario() === "failure") {
    throw new SpecialistWorkspaceError(
      "We couldn't load the assigned Order workspace. Check your connection and try again.",
      "REQUEST_FAILED",
    );
  }
  if (scenario() === "forbidden") {
    throw new SpecialistWorkspaceError(
      "You don't have permission to access this Transport Specialist Order.",
      "FORBIDDEN",
    );
  }
}

function readOrders(): MockOrderState[] {
  const saved = window.sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return clone(initialOrders);
  try {
    const stored = JSON.parse(saved) as MockOrderState[];
    return initialOrders.map((initial) => stored.find((order) => order.id === initial.id) ?? clone(initial));
  } catch {
    throw new SpecialistWorkspaceError(
      "We couldn't read the saved preview data. Refresh the page and try again.",
      "REQUEST_FAILED",
    );
  }
}

function writeOrders(orders: MockOrderState[]) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function findAssignedOrder(orders: MockOrderState[], orderId: string) {
  if (orderId === "order-unassigned") {
    throw new SpecialistWorkspaceError(
      "This Order is assigned to another Transport Specialist.",
      "FORBIDDEN",
    );
  }
  const assignment = readPreviewAssignmentRecipients()[orderId];
  const selectedSpecialist = getPreviewSpecialistIdentity(window.location.search);
  if (!assignment || assignment.transportSpecialistId !== selectedSpecialist.id) {
    throw new SpecialistWorkspaceError(
      "This Order is assigned to another Transport Specialist.",
      "FORBIDDEN",
    );
  }
  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order) {
    throw new SpecialistWorkspaceError(
      "This assigned Order is no longer available.",
      "NOT_FOUND",
    );
  }
  order.assignedAt = assignment.assignedAt;
  order.assignedTransportSpecialistName = assignment.transportSpecialistName;
  order.assignedFleetRouteCoordinatorName = assignment.fleetRouteCoordinatorName;
  return order;
}

function ordersForSelectedSpecialist(orders: MockOrderState[]) {
  const assignments = readPreviewAssignmentRecipients();
  const selectedSpecialist = getPreviewSpecialistIdentity(window.location.search);
  return orders.flatMap((order) => {
    const assignment = assignments[order.id];
    if (!assignment || assignment.transportSpecialistId !== selectedSpecialist.id) return [];
    return [{
      ...order,
      assignedAt: assignment.assignedAt,
      assignedTransportSpecialistName: assignment.transportSpecialistName,
      assignedFleetRouteCoordinatorName: assignment.fleetRouteCoordinatorName,
    }];
  });
}

function currentVersions(order: MockOrderState) {
  return order.horses.flatMap((item) => item.documents.map((document) => (
    document.versions.find((candidate) => candidate.isCurrent) ?? null
  )));
}

function progressFor(order: MockOrderState): DocumentProgress {
  const versions = currentVersions(order);
  return versions.reduce<DocumentProgress>((progress, current) => {
    if (!current || current.status === "DRAFT") progress.missingOrDraft += 1;
    else if (current.status === "PENDING_REVIEW") progress.pendingReview += 1;
    else if (current.status === "REJECTED") progress.rejected += 1;
    else if (current.status === "APPROVED") progress.approved += 1;
    return progress;
  }, { approved: 0, pendingReview: 0, rejected: 0, missingOrDraft: 0, total: versions.length });
}

function detailFor(order: MockOrderState): AssignedSpecialistOrderDetail {
  const progress = progressFor(order);
  const eligible = !order.documentPhaseLocked
    && Boolean(order.documentCompletionDeadlineAt)
    && progress.total > 0
    && progress.approved === progress.total;
  const blockers: string[] = [];
  if (!order.documentCompletionDeadlineAt) blockers.push("Set the Order document deadline.");
  if (progress.missingOrDraft > 0) blockers.push(`${progress.missingOrDraft} required document${progress.missingOrDraft === 1 ? " is" : "s are"} missing or still draft.`);
  if (progress.pendingReview > 0) blockers.push(`${progress.pendingReview} submitted version${progress.pendingReview === 1 ? " awaits" : "s await"} review.`);
  if (progress.rejected > 0) blockers.push(`${progress.rejected} required document${progress.rejected === 1 ? " needs" : "s need"} a corrected version.`);

  return {
    ...clone(order),
    progress,
    finalConfirmationStatus: order.documentPhaseLocked ? "CONFIRMED" : eligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
    eligibility: {
      eligible,
      blockers,
      checkedAt: new Date().toISOString(),
    },
  };
}

function summaryFor(order: MockOrderState): AssignedSpecialistOrderSummary {
  const detail = detailFor(order);
  return {
    id: detail.id,
    orderCode: detail.orderCode,
    origin: detail.origin,
    destination: detail.destination,
    transportMode: detail.transportMode,
    requestedDepartureAt: detail.requestedDepartureAt,
    horseCount: detail.horseCount,
    assignedAt: detail.assignedAt,
    assignedTransportSpecialistName: detail.assignedTransportSpecialistName,
    assignedFleetRouteCoordinatorName: detail.assignedFleetRouteCoordinatorName,
    documentCompletionDeadlineAt: detail.documentCompletionDeadlineAt,
    progress: detail.progress,
    finalConfirmationStatus: detail.finalConfirmationStatus,
    finalConfirmedAt: detail.finalConfirmedAt,
  };
}

function assertMutable(order: MockOrderState) {
  if (order.documentPhaseLocked) {
    throw new SpecialistWorkspaceError(
      "The Document Phase was Final Confirmed and is permanently locked.",
      "STALE_STATE",
    );
  }
}

export const mockTransportSpecialistWorkspaceService: TransportSpecialistWorkspaceService = {
  async listAssignedOrders(): Promise<SpecialistOrderQueues> {
    await pause();
    maybeThrowScenarioFailure();
    if (scenario() === "empty") return { actionRequired: [], finalConfirmed: [] };
    const orders = ordersForSelectedSpecialist(readOrders());
    return {
      actionRequired: orders.filter((order) => !order.documentPhaseLocked).map(summaryFor),
      finalConfirmed: orders.filter((order) => order.documentPhaseLocked).map(summaryFor),
    };
  },

  async getAssignedOrder(orderId: string) {
    await pause();
    maybeThrowScenarioFailure();
    return detailFor(findAssignedOrder(readOrders(), orderId));
  },

  async setDocumentDeadline(orderId: string, deadlineAt: string) {
    await pause();
    maybeThrowScenarioFailure();
    const orders = readOrders();
    const order = findAssignedOrder(orders, orderId);
    assertMutable(order);
    if (order.documentCompletionDeadlineAt) {
      throw new SpecialistWorkspaceError(
        "The document deadline was already set. We refreshed the saved Order state.",
        "STALE_STATE",
      );
    }
    const parsed = new Date(deadlineAt);
    if (!deadlineAt || Number.isNaN(parsed.valueOf()) || parsed <= new Date()) {
      throw new SpecialistWorkspaceError(
        "Choose a document deadline in the future.",
        "VALIDATION_ERROR",
      );
    }
    order.documentCompletionDeadlineAt = parsed.toISOString();
    writeOrders(orders);
  },

  async reviewDocumentVersion(orderId: string, documentId: string, versionId: string, decision: ReviewDecision) {
    await pause();
    maybeThrowScenarioFailure();
    const orders = readOrders();
    const order = findAssignedOrder(orders, orderId);
    assertMutable(order);
    const document = order.horses.flatMap((item) => item.documents).find((item) => item.id === documentId);
    const current = document?.versions.find((item) => item.id === versionId && item.isCurrent);
    if (!document || !current) {
      throw new SpecialistWorkspaceError(
        "This document version changed while you were reviewing it. Refresh the Order and try again.",
        "STALE_STATE",
      );
    }
    if (current.status !== "PENDING_REVIEW") {
      throw new SpecialistWorkspaceError(
        "This document version is no longer awaiting review. We refreshed the saved state.",
        "STALE_STATE",
      );
    }
    const reason = decision.rejectionReason?.trim();
    if (decision.decision === "REJECT" && !reason) {
      throw new SpecialistWorkspaceError(
        "Enter a reason so the Customer knows what to correct.",
        "VALIDATION_ERROR",
      );
    }
    current.status = decision.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    current.reviewedAt = new Date().toISOString();
    current.rejectionReason = decision.decision === "REJECT" ? reason ?? null : null;
    writeOrders(orders);
  },

  async finalConfirmDocuments(orderId: string) {
    await pause();
    maybeThrowScenarioFailure();
    const orders = readOrders();
    const order = findAssignedOrder(orders, orderId);
    assertMutable(order);
    const detail = detailFor(order);
    if (!detail.eligibility.eligible) {
      throw new SpecialistWorkspaceError(
        "This Order is not eligible for Final Confirm. Review the latest document states and try again.",
        "VALIDATION_ERROR",
      );
    }
    order.documentPhaseLocked = true;
    order.finalConfirmedAt = new Date().toISOString();
    order.finalConfirmedBy = getPreviewSpecialistIdentity(window.location.search).name;
    writeOrders(orders);
  },
};
