export type RefundStatus = "PROCESSING" | "REFUNDED" | "FAILED";

export type RefundTimelineItem = {
  id: string;
  label: string;
  description: string;
  occurredAt: string;
  state: "complete" | "current" | "attention";
};

export type RefundUpdate = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  tone: "neutral" | "success" | "warning";
};

export type CustomerRefundResult = {
  order: {
    id: string;
    orderCode: string;
    origin: string;
    destination: string;
    createdAt: string;
  };
  cancellation: {
    reason: "DOCUMENT_DEADLINE_MISSED";
    documentDeadlineAt: string;
    cancelledAt: string;
  };
  refund: {
    status: RefundStatus;
    amount: number;
    currency: string;
    paymentMethodLabel: string;
    reference: string | null;
    requestedAt: string;
    completedAt: string | null;
    lastCheckedAt: string;
  };
  timeline: RefundTimelineItem[];
  updates: RefundUpdate[];
};

export type CustomerRefundService = {
  getResult(orderId: string): Promise<CustomerRefundResult>;
  refreshResult(orderId: string): Promise<CustomerRefundResult>;
};

export type CustomerRefundPreviewScenario =
  | "refunded"
  | "processing"
  | "failed"
  | "error"
  | "unavailable";

export type CustomerRefundErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "REQUEST_FAILED"
  | "CONTRACT_UNAVAILABLE";

export class CustomerRefundError extends Error {
  constructor(message: string, public readonly code: CustomerRefundErrorCode) {
    super(message);
    this.name = "CustomerRefundError";
  }
}
