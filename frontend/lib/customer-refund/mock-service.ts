import {
  CustomerRefundError,
  type CustomerRefundPreviewScenario,
  type CustomerRefundResult,
  type CustomerRefundService,
  type RefundStatus,
} from "./types";

const PREVIEW_ORDER_ID = "preview-refund-order";

function pause(duration = 320) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function createResult(status: RefundStatus): CustomerRefundResult {
  const completed = status === "REFUNDED";
  const failed = status === "FAILED";
  const refundUpdate = completed
    ? {
        id: "refund-completed",
        title: "Refund completed successfully",
        message: "A full refund of $1,250.00 USD was returned to Visa •••• 4242.",
        createdAt: "2026-10-09T16:08:00+07:00",
        tone: "success" as const,
      }
    : failed
      ? {
          id: "refund-attention",
          title: "Refund status could not be confirmed",
          message: "We could not confirm the refund yet. The system will continue checking its status.",
          createdAt: "2026-10-09T16:08:00+07:00",
          tone: "warning" as const,
        }
      : {
          id: "refund-requested",
          title: "Refund request received",
          message: "Your full deposit refund is being processed to the original payment method.",
          createdAt: "2026-10-09T15:53:00+07:00",
          tone: "neutral" as const,
        };

  return {
    order: {
      id: PREVIEW_ORDER_ID,
      orderCode: "ORD-2058",
      origin: "Lexington, United States",
      destination: "Brussels, Belgium",
      createdAt: "2026-10-02T10:20:00+07:00",
    },
    cancellation: {
      reason: "DOCUMENT_DEADLINE_MISSED",
      documentDeadlineAt: "2026-10-09T15:51:00+07:00",
      cancelledAt: "2026-10-09T15:52:00+07:00",
    },
    refund: {
      status,
      amount: 1250,
      currency: "USD",
      paymentMethodLabel: "Visa •••• 4242",
      reference: completed ? "RF-2058-01" : null,
      requestedAt: "2026-10-09T15:53:00+07:00",
      completedAt: completed ? "2026-10-09T16:08:00+07:00" : null,
      lastCheckedAt: "2026-10-09T16:08:00+07:00",
    },
    timeline: [
      {
        id: "deadline",
        label: "Document deadline",
        description: "The required documents were not completed by the deadline.",
        occurredAt: "2026-10-09T15:51:00+07:00",
        state: "complete",
      },
      {
        id: "cancelled",
        label: "Order cancelled",
        description: "The Order was cancelled automatically after the document deadline was missed.",
        occurredAt: "2026-10-09T15:52:00+07:00",
        state: "complete",
      },
      {
        id: "refund",
        label: completed ? "Refund completed" : failed ? "Refund needs attention" : "Refund processing",
        description: completed
          ? "Your full deposit was returned to the original payment method."
          : failed
            ? "The refund result could not be confirmed. The system will continue checking."
            : "Your full deposit refund is being processed.",
        occurredAt: completed ? "2026-10-09T16:08:00+07:00" : "2026-10-09T15:53:00+07:00",
        state: completed ? "complete" : failed ? "attention" : "current",
      },
    ],
    updates: [
      refundUpdate,
      {
        id: "order-cancelled",
        title: "Order cancelled automatically",
        message: "The document deadline was missed, so this Order was cancelled automatically.",
        createdAt: "2026-10-09T15:52:00+07:00",
        tone: "neutral",
      },
      {
        id: "deadline-missed",
        title: "Document deadline missed",
        message: "The required documents were not completed by the deadline.",
        createdAt: "2026-10-09T15:51:00+07:00",
        tone: "neutral",
      },
    ],
  };
}

function statusFor(scenario: CustomerRefundPreviewScenario): RefundStatus {
  if (scenario === "processing") return "PROCESSING";
  if (scenario === "failed") return "FAILED";
  return "REFUNDED";
}

export function createMockCustomerRefundService(
  scenario: CustomerRefundPreviewScenario,
): CustomerRefundService {
  let refreshed = false;

  async function read(orderId: string, isRefresh: boolean) {
    await pause(isRefresh ? 520 : 320);
    if (scenario === "error") {
      throw new CustomerRefundError(
        "We couldn't load the latest cancellation and refund result. Check your connection and try again.",
        "REQUEST_FAILED",
      );
    }
    if (scenario === "unavailable" || orderId !== PREVIEW_ORDER_ID) {
      throw new CustomerRefundError(
        "This cancellation and refund result is no longer available from My Orders.",
        "NOT_FOUND",
      );
    }
    if (isRefresh && scenario === "processing") refreshed = true;
    return createResult(refreshed ? "REFUNDED" : statusFor(scenario));
  }

  return {
    getResult: (orderId) => read(orderId, false),
    refreshResult: (orderId) => read(orderId, true),
  };
}
