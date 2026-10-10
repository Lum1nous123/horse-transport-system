import {
  CustomerRemainingBalanceError,
  type CustomerRemainingBalancePreviewScenario,
  type CustomerRemainingBalanceResult,
  type CustomerRemainingBalanceService,
  type RemainingBalanceAttemptStatus,
  type RemainingBalancePaymentStatus,
} from "./types";

export const PREVIEW_REMAINING_BALANCE_ORDER_ID = "preview-balance-order";

function pause(duration = 320) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function createResult(
  paymentStatus: RemainingBalancePaymentStatus,
  attemptStatus: RemainingBalanceAttemptStatus,
  eligible = true,
): CustomerRemainingBalanceResult {
  const paid = paymentStatus === "PAID";

  return {
    order: {
      id: PREVIEW_REMAINING_BALANCE_ORDER_ID,
      orderCode: "ORD-2061",
      origin: "Saumur, France",
      destination: "Amsterdam, Netherlands",
      horseCount: 1,
      transportMode: "ROAD",
      departureAt: "2026-10-22T08:30:00+07:00",
    },
    eligibility: {
      status: eligible ? "ELIGIBLE" : "INELIGIBLE",
      message: eligible
        ? "All required documents are approved and Final Confirm is complete."
        : "This Order is not eligible for Remaining Balance payment yet.",
      checkedAt: "2026-10-10T10:42:00+07:00",
    },
    quotation: {
      totalAmount: 4800,
      depositPaid: 1200,
      remainingAmount: 3600,
      currency: "USD",
    },
    payment: {
      status: paymentStatus,
      latestAttemptStatus: attemptStatus,
      paidAt: paid ? "2026-10-10T11:06:00+07:00" : null,
      reference: paid ? "RB-2061-01" : null,
      lastCheckedAt: paid
        ? "2026-10-10T11:06:00+07:00"
        : "2026-10-10T10:52:00+07:00",
    },
    journey: [
      { id: "quotation", label: "Quotation accepted", detail: "Transport bill accepted", state: "complete" },
      { id: "documents", label: "Documents submitted", detail: "Required files reviewed", state: "complete" },
      { id: "confirm", label: "Final Confirm", detail: "Document phase locked", state: "complete" },
      {
        id: "balance",
        label: paid ? "Balance paid" : "Remaining balance",
        detail: paid ? "Payment confirmed" : "Payment is ready",
        state: paid ? "complete" : "current",
      },
    ],
    recentProgress: [
      {
        id: "quotation-accepted",
        label: "Quotation accepted",
        description: "The transport quotation and deposit were accepted.",
        occurredAt: "2026-09-24T14:36:00+07:00",
      },
      {
        id: "deposit-paid",
        label: "Deposit received",
        description: "$1,200.00 USD was confirmed by the payment service.",
        occurredAt: "2026-09-24T14:44:00+07:00",
      },
      {
        id: "documents-confirmed",
        label: "Documents final confirmed",
        description: "The Transport Specialist approved and locked the document phase.",
        occurredAt: "2026-10-10T10:42:00+07:00",
      },
    ],
  };
}

function stateFor(scenario: CustomerRemainingBalancePreviewScenario) {
  if (scenario === "paid") return createResult("PAID", null);
  if (scenario === "pending") return createResult("PENDING", "OPEN");
  if (scenario === "cancelled") return createResult("UNPAID", "CANCELLED");
  if (scenario === "ineligible") return createResult("UNPAID", null, false);
  return createResult("UNPAID", null);
}

export function createMockCustomerRemainingBalanceService(
  scenario: CustomerRemainingBalancePreviewScenario,
): CustomerRemainingBalanceService {
  let refreshed = false;

  async function read(orderId: string, refresh: boolean) {
    await pause(refresh ? 520 : 320);
    if (scenario === "error") {
      throw new CustomerRemainingBalanceError(
        "We couldn't load the latest Remaining Balance status. Check your connection and try again.",
        "REQUEST_FAILED",
      );
    }
    if (scenario === "stale") {
      throw new CustomerRemainingBalanceError(
        "This payment state changed while the page was open. Return to My Orders, then open it again.",
        "STALE",
      );
    }
    if (scenario === "unavailable" || orderId !== PREVIEW_REMAINING_BALANCE_ORDER_ID) {
      throw new CustomerRemainingBalanceError(
        "This Remaining Balance requirement is no longer available from My Orders.",
        "NOT_FOUND",
      );
    }
    if (refresh && scenario === "pending") refreshed = true;
    return refreshed ? createResult("PAID", null) : stateFor(scenario);
  }

  return {
    getResult: (orderId) => read(orderId, false),
    refreshResult: (orderId) => read(orderId, true),
    async createCheckout(orderId) {
      await pause(480);
      const result = await read(orderId, false);
      if (result.eligibility.status !== "ELIGIBLE") {
        throw new CustomerRemainingBalanceError(
          "This Order is not eligible for Remaining Balance payment.",
          "INELIGIBLE",
        );
      }
      if (result.payment.status === "PAID") {
        throw new CustomerRemainingBalanceError(
          "The Remaining Balance has already been paid.",
          "ALREADY_PAID",
        );
      }
      return { checkoutUrl: "preview://secure-checkout" };
    },
  };
}
