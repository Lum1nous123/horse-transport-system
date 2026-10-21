import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import {
  CustomerRemainingBalanceError,
  type CustomerRemainingBalanceResult,
  type CustomerRemainingBalanceService,
  type RemainingBalanceCheckout,
} from "./types";

type ApiError = { code?: string; message?: string };

type OrderResponse = {
  id: string;
  orderCode: string;
  originAddress: string | null;
  originCountry: string | null;
  destinationAddress: string | null;
  destinationCountry: string | null;
  requestedDepartureAt: string;
  transportMode: "ROAD" | "AIR" | "COMBINED";
  horseIds: string[];
  approvedAt: string | null;
};

type QuotationResponse = {
  totalAmount: number;
  depositAmount: number;
  currency: string;
};

type BalanceResponse = {
  orderId: string;
  amount: number;
  currency: string;
  paymentStatus: "PENDING" | "PAID" | "REFUNDED";
  checkoutEligible: boolean;
  ineligibleReason: string | null;
};

function location(address: string | null, country: string | null): string {
  return [address, country].filter(Boolean).join(", ") || "Not provided";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new CustomerRemainingBalanceError("Your session has expired. Sign in again.", "FORBIDDEN");

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
    throw new CustomerRemainingBalanceError("We couldn't reach the payment service. Try again.", "REQUEST_FAILED");
  }

  if (response.ok) return await response.json() as T;

  let error: ApiError = {};
  try { error = await response.json() as ApiError; } catch { /* Use the safe fallback below. */ }
  const message = error.message || "We couldn't complete the payment request.";
  if (response.status === 401) {
    clearAccessToken();
    throw new CustomerRemainingBalanceError("Your session has expired. Sign in again.", "FORBIDDEN");
  }
  if (response.status === 403) throw new CustomerRemainingBalanceError(message, "FORBIDDEN");
  if (response.status === 404) throw new CustomerRemainingBalanceError(message, "NOT_FOUND");
  if (response.status === 409) {
    const code = message.toLowerCase().includes("already paid") ? "ALREADY_PAID" : "STALE";
    throw new CustomerRemainingBalanceError(message, code);
  }
  throw new CustomerRemainingBalanceError(message, "REQUEST_FAILED");
}

async function getResult(orderId: string): Promise<CustomerRemainingBalanceResult> {
  const checkedAt = new Date().toISOString();
  const [order, quotation, balance] = await Promise.all([
    requestJson<OrderResponse>(`/api/v1/orders/${orderId}`),
    requestJson<QuotationResponse>(`/api/v1/orders/${orderId}/quotation`),
    requestJson<BalanceResponse>(`/api/v1/orders/${orderId}/remaining-balance`),
  ]);
  const paid = balance.paymentStatus === "PAID";
  const eligible = balance.checkoutEligible;

  return {
    order: {
      id: order.id,
      orderCode: order.orderCode,
      origin: location(order.originAddress, order.originCountry),
      destination: location(order.destinationAddress, order.destinationCountry),
      horseCount: order.horseIds.length,
      transportMode: order.transportMode,
      departureAt: order.requestedDepartureAt,
    },
    eligibility: {
      status: eligible ? "ELIGIBLE" : "INELIGIBLE",
      message: eligible
        ? "All required documents are approved and Final Confirm is complete."
        : balance.ineligibleReason || "Remaining Balance payment is not available.",
      checkedAt,
    },
    quotation: {
      totalAmount: quotation.totalAmount,
      depositPaid: quotation.depositAmount,
      remainingAmount: balance.amount,
      currency: balance.currency,
    },
    payment: {
      // BE-14 uses PENDING both before checkout and while an attempt is active. If checkout is
      // still eligible, the UI must continue to offer the idempotent checkout endpoint.
      status: paid ? "PAID" : "UNPAID",
      latestAttemptStatus: null,
      paidAt: null,
      reference: null,
      lastCheckedAt: checkedAt,
    },
    journey: [
      { id: "quotation", label: "Quotation accepted", detail: "Deposit confirmed", state: "complete" },
      { id: "documents", label: "Documents submitted", detail: "Required files reviewed", state: "complete" },
      { id: "confirm", label: "Final Confirm", detail: "Document phase locked", state: "complete" },
      { id: "balance", label: paid ? "Balance paid" : "Remaining balance", detail: paid ? "Payment confirmed" : "Payment is ready", state: paid ? "complete" : "current" },
    ],
    recentProgress: order.approvedAt ? [{
      id: "quotation-accepted",
      label: "Quotation accepted",
      description: "The transport quotation and deposit were accepted.",
      occurredAt: order.approvedAt,
    }] : [],
  };
}

export const apiCustomerRemainingBalanceService: CustomerRemainingBalanceService = {
  getResult,
  refreshResult: getResult,
  createCheckout(orderId: string): Promise<RemainingBalanceCheckout> {
    return requestJson<RemainingBalanceCheckout>(`/api/v1/orders/${orderId}/remaining-balance/checkout`, {
      method: "POST",
    });
  },
};
