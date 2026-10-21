import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken, getCurrentUser } from "@/lib/auth";
import {
  SpecialistWorkspaceError,
  type AssignedSpecialistOrderDetail,
  type DocumentProgress,
  type DocumentVersion,
  type ReviewDecision,
  type SpecialistDocument,
  type SpecialistOrderQueues,
  type TransportSpecialistWorkspaceService,
} from "./types";

type ApiError = { message?: string };

type DocumentInboxItem = {
  id: string;
  orderCode: string;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  requestedDepartureAt: string;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  horseCount: number;
  documentCompletionDeadlineAt: string | null;
  documentsFinalConfirmedAt: string | null;
  documentsLockedAt: string | null;
  createdAt: string;
};

type ChecklistDocument = {
  id: string;
  documentType: SpecialistDocument["type"];
  required: boolean;
};

type ChecklistHorse = {
  orderHorseId: string;
  horseId: string;
  horseName: string | null;
  microchipId: string | null;
  documents: ChecklistDocument[];
};

type ChecklistResponse = {
  canFinalConfirm: boolean;
  documentsFinalConfirmedBy: string | null;
  documentsFinalConfirmedAt: string | null;
  documentsLockedAt: string | null;
  horses: ChecklistHorse[];
};

type VersionResponse = {
  id: string;
  versionNo: number;
  status: DocumentVersion["status"];
  isCurrent: boolean;
  fileUrl: string;
  displayName: string;
  expiryDate: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new SpecialistWorkspaceError("Your session has expired. Sign in again.", "FORBIDDEN");

  let response: Response;
  try {
    response = await apiFetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new SpecialistWorkspaceError("We couldn't reach the document service. Try again.", "REQUEST_FAILED");
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  let message = "We couldn't complete the document request.";
  try {
    const error = await response.json() as ApiError;
    if (error.message) message = error.message;
  } catch {
    // Keep the fallback when an error response has no JSON body.
  }

  if (response.status === 401) {
    clearAccessToken();
    throw new SpecialistWorkspaceError("Your session has expired. Sign in again.", "FORBIDDEN");
  }
  if (response.status === 403) throw new SpecialistWorkspaceError(message, "FORBIDDEN");
  if (response.status === 404) throw new SpecialistWorkspaceError(message, "NOT_FOUND");
  if (response.status === 409) throw new SpecialistWorkspaceError(message, "STALE_STATE");
  if (response.status === 400) throw new SpecialistWorkspaceError(message, "VALIDATION_ERROR");
  throw new SpecialistWorkspaceError(message, "REQUEST_FAILED");
}

function location(address: string | null, country: string | null): string {
  return [address, country].filter(Boolean).join(", ") || "Not provided";
}

function progress(documents: SpecialistDocument[]): DocumentProgress {
  const current = documents.map((document) => document.versions.find((version) => version.isCurrent));
  return {
    approved: current.filter((version) => version?.status === "APPROVED").length,
    pendingReview: current.filter((version) => version?.status === "PENDING_REVIEW").length,
    rejected: current.filter((version) => version?.status === "REJECTED").length,
    missingOrDraft: current.filter((version) => !version || version.status === "DRAFT").length,
    total: documents.length,
  };
}

async function loadOrderDetail(item: DocumentInboxItem): Promise<AssignedSpecialistOrderDetail> {
  const [checklist, currentUser] = await Promise.all([
    requestJson<ChecklistResponse>(`/api/v1/orders/${item.id}/documents/checklist`),
    getCurrentUser(),
  ]);
  const documentsByHorse = await Promise.all(checklist.horses.map(async (horse, horseIndex) => {
    const documents = await Promise.all(horse.documents.map(async (document) => {
      const versions = await requestJson<VersionResponse[]>(`/api/v1/documents/${document.id}/versions`);
      return {
        id: document.id,
        type: document.documentType,
        required: document.required,
        versions: versions.map((version) => ({
          id: version.id,
          versionNo: version.versionNo,
          status: version.status,
          isCurrent: version.isCurrent,
          fileName: version.displayName,
          fileUrl: version.fileUrl,
          expiryDate: version.expiryDate,
          submittedAt: version.submittedAt,
          reviewedAt: version.reviewedAt,
          rejectionReason: version.rejectionReason,
        })),
      } satisfies SpecialistDocument;
    }));
    return {
      id: horse.orderHorseId,
      displayName: horse.horseName ?? `Horse ${horseIndex + 1}`,
      microchipId: horse.microchipId ?? "Not available",
      documents,
    };
  }));
  const allDocuments = documentsByHorse.flatMap((horse) => horse.documents);
  const orderProgress = progress(allDocuments);

  return {
    id: item.id,
    orderCode: item.orderCode,
    origin: location(item.originAddress, item.originCountry),
    destination: location(item.destinationAddress, item.destinationCountry),
    transportMode: item.transportMode,
    requestedDepartureAt: item.requestedDepartureAt,
    horseCount: item.horseCount,
    assignedAt: item.createdAt,
    assignedTransportSpecialistName: currentUser.fullName,
    assignedFleetRouteCoordinatorName: "Assigned Fleet & Route Coordinator",
    documentCompletionDeadlineAt: item.documentCompletionDeadlineAt,
    progress: orderProgress,
    finalConfirmationStatus: checklist.documentsFinalConfirmedAt
      ? "CONFIRMED"
      : checklist.canFinalConfirm ? "ELIGIBLE" : "NOT_ELIGIBLE",
    finalConfirmedAt: checklist.documentsFinalConfirmedAt,
    customerName: "",
    horses: documentsByHorse,
    eligibility: {
      eligible: checklist.canFinalConfirm,
      blockers: checklist.canFinalConfirm ? [] : ["All current mandatory document versions must be approved."],
      checkedAt: new Date().toISOString(),
    },
    documentPhaseLocked: checklist.documentsLockedAt !== null,
    finalConfirmedBy: checklist.documentsFinalConfirmedBy,
  };
}

async function loadInbox(): Promise<DocumentInboxItem[]> {
  return requestJson<DocumentInboxItem[]>("/api/v1/orders/document-inbox");
}

function summaryFromInbox(
  item: DocumentInboxItem,
  assignedTransportSpecialistName: string,
): AssignedSpecialistOrderDetail {
  const locked = item.documentsLockedAt !== null;
  return {
    id: item.id,
    orderCode: item.orderCode,
    origin: location(item.originAddress, item.originCountry),
    destination: location(item.destinationAddress, item.destinationCountry),
    transportMode: item.transportMode,
    requestedDepartureAt: item.requestedDepartureAt,
    horseCount: item.horseCount,
    assignedAt: item.createdAt,
    assignedTransportSpecialistName,
    assignedFleetRouteCoordinatorName: "Assigned Fleet & Route Coordinator",
    documentCompletionDeadlineAt: item.documentCompletionDeadlineAt,
    progress: { approved: 0, pendingReview: 0, rejected: 0, missingOrDraft: 0, total: 0 },
    finalConfirmationStatus: item.documentsFinalConfirmedAt ? "CONFIRMED" : "NOT_ELIGIBLE",
    finalConfirmedAt: item.documentsFinalConfirmedAt,
    customerName: "",
    horses: [],
    eligibility: { eligible: false, blockers: [], checkedAt: item.createdAt },
    documentPhaseLocked: locked,
    finalConfirmedBy: null,
  };
}

export const apiTransportSpecialistWorkspaceService: TransportSpecialistWorkspaceService = {
  async listAssignedOrders(): Promise<SpecialistOrderQueues> {
    const [inbox, currentUser] = await Promise.all([loadInbox(), getCurrentUser()]);
    const details = await Promise.all(inbox.map(async (item) => {
      // Locked records can be classified entirely from the inbox response. Their visibility must
      // not depend on secondary checklist/version requests.
      if (item.documentsLockedAt) return summaryFromInbox(item, currentUser.fullName);
      try {
        return await loadOrderDetail(item);
      } catch {
        // Preserve the assigned Order in the queue if one secondary read is temporarily unavailable.
        return summaryFromInbox(item, currentUser.fullName);
      }
    }));
    return {
      actionRequired: details.filter((order) => !order.documentPhaseLocked),
      finalConfirmed: details.filter((order) => order.documentPhaseLocked),
    };
  },

  async getAssignedOrder(orderId: string): Promise<AssignedSpecialistOrderDetail> {
    const item = (await loadInbox()).find((order) => order.id === orderId);
    if (!item) throw new SpecialistWorkspaceError("This Order is not in your actionable assigned queue.", "NOT_FOUND");
    return loadOrderDetail(item);
  },

  async setDocumentDeadline(orderId: string, deadlineAt: string): Promise<void> {
    await requestJson(`/api/v1/orders/${orderId}/documents/deadline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentCompletionDeadlineAt: deadlineAt }),
    });
  },

  async reviewDocumentVersion(_orderId: string, documentId: string, versionId: string, decision: ReviewDecision): Promise<void> {
    await requestJson(`/api/v1/documents/${documentId}/versions/${versionId}/${decision.decision === "APPROVE" ? "approve" : "reject"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: decision.decision === "REJECT" ? JSON.stringify({ rejectionReason: decision.rejectionReason }) : undefined,
    });
  },

  async finalConfirmDocuments(orderId: string): Promise<void> {
    await requestJson(`/api/v1/orders/${orderId}/documents/final-confirm`, { method: "POST" });
  },
};
