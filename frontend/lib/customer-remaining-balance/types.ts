export type RemainingBalanceEligibility = "ELIGIBLE" | "INELIGIBLE";

export type RemainingBalancePaymentStatus = "UNPAID" | "PENDING" | "PAID";

export type RemainingBalanceAttemptStatus =
  | "OPEN"
  | "CANCELLED"
  | "EXPIRED"
  | null;

export type RemainingBalanceJourneyStep = {
  id: string;
  label: string;
  detail: string;
  state: "complete" | "current" | "upcoming";
};

export type RemainingBalanceProgressItem = {
  id: string;
  label: string;
  description: string;
  occurredAt: string;
};

export type CustomerRemainingBalanceResult = {
  order: {
    id: string;
    orderCode: string;
    origin: string;
    destination: string;
    horseCount: number;
    transportMode: "ROAD" | "AIR" | "COMBINED";
    departureAt: string;
  };
  eligibility: {
    status: RemainingBalanceEligibility;
    message: string;
    checkedAt: string;
  };
  quotation: {
    totalAmount: number;
    depositPaid: number;
    remainingAmount: number;
    currency: string;
  };
  payment: {
    status: RemainingBalancePaymentStatus;
    latestAttemptStatus: RemainingBalanceAttemptStatus;
    paidAt: string | null;
    reference: string | null;
    lastCheckedAt: string;
  };
  journey: RemainingBalanceJourneyStep[];
  recentProgress: RemainingBalanceProgressItem[];
};

export type RemainingBalanceCheckout = {
  checkoutUrl: string;
};

export type CustomerRemainingBalanceService = {
  getResult(orderId: string): Promise<CustomerRemainingBalanceResult>;
  refreshResult(orderId: string): Promise<CustomerRemainingBalanceResult>;
  createCheckout(orderId: string): Promise<RemainingBalanceCheckout>;
};

export type CustomerRemainingBalancePreviewScenario =
  | "eligible"
  | "pending"
  | "paid"
  | "cancelled"
  | "ineligible"
  | "stale"
  | "error"
  | "unavailable";

export type CustomerRemainingBalanceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "REQUEST_FAILED"
  | "STALE"
  | "INELIGIBLE"
  | "ALREADY_PAID"
  | "CONTRACT_UNAVAILABLE";

export class CustomerRemainingBalanceError extends Error {
  constructor(
    message: string,
    public readonly code: CustomerRemainingBalanceErrorCode,
  ) {
    super(message);
    this.name = "CustomerRemainingBalanceError";
  }
}
