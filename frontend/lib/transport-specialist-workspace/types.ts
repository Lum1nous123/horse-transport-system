export type DocumentType =
  | "HORSE_PASSPORT_OR_IDENTIFICATION"
  | "VACCINATION_CERTIFICATE"
  | "VETERINARY_HEALTH_CERTIFICATE"
  | "OWNERSHIP_CERTIFICATE"
  | "EXPORT_IMPORT_PERMIT";

export type DocumentVersionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type FinalConfirmationStatus = "NOT_ELIGIBLE" | "ELIGIBLE" | "CONFIRMED";

export type DocumentVersion = {
  id: string;
  versionNo: number;
  status: DocumentVersionStatus;
  isCurrent: boolean;
  fileName: string;
  fileUrl: string;
  expiryDate: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type SpecialistDocument = {
  id: string;
  type: DocumentType;
  required: boolean;
  versions: DocumentVersion[];
};

export type SpecialistHorse = {
  id: string;
  displayName: string;
  microchipId: string;
  documents: SpecialistDocument[];
};

export type DocumentProgress = {
  approved: number;
  pendingReview: number;
  rejected: number;
  missingOrDraft: number;
  total: number;
};

export type AssignedSpecialistOrderSummary = {
  id: string;
  orderCode: string;
  origin: string;
  destination: string;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  requestedDepartureAt: string;
  horseCount: number;
  assignedAt: string;
  assignedTransportSpecialistName: string;
  assignedFleetRouteCoordinatorName: string;
  documentCompletionDeadlineAt: string | null;
  progress: DocumentProgress;
  finalConfirmationStatus: FinalConfirmationStatus;
  finalConfirmedAt: string | null;
};

export type AssignedSpecialistOrderDetail = AssignedSpecialistOrderSummary & {
  customerName: string;
  horses: SpecialistHorse[];
  eligibility: {
    eligible: boolean;
    blockers: string[];
    checkedAt: string;
  };
  documentPhaseLocked: boolean;
  finalConfirmedBy: string | null;
};

export type SpecialistOrderQueues = {
  actionRequired: AssignedSpecialistOrderSummary[];
  finalConfirmed: AssignedSpecialistOrderSummary[];
};

export type ReviewDecision = {
  decision: "APPROVE" | "REJECT";
  rejectionReason?: string;
};

export type TransportSpecialistWorkspaceService = {
  listAssignedOrders(): Promise<SpecialistOrderQueues>;
  getAssignedOrder(orderId: string): Promise<AssignedSpecialistOrderDetail>;
  setDocumentDeadline(orderId: string, deadlineAt: string): Promise<void>;
  reviewDocumentVersion(
    orderId: string,
    documentId: string,
    versionId: string,
    decision: ReviewDecision,
  ): Promise<void>;
  finalConfirmDocuments(orderId: string): Promise<void>;
};

export type SpecialistWorkspaceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "STALE_STATE"
  | "REQUEST_FAILED";

export class SpecialistWorkspaceError extends Error {
  constructor(message: string, public readonly code: SpecialistWorkspaceErrorCode) {
    super(message);
    this.name = "SpecialistWorkspaceError";
  }
}

