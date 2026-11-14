import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOMER_TERMS_LOGIN_HIDDEN_KEY } from "@/lib/customer-terms";
import CustomerPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  clearAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
  getCurrentUser: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/auth", () => ({
  clearAccessToken: mocks.clearAccessToken,
  getAccessToken: mocks.getAccessToken,
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const order = {
  id: "order-1",
  orderCode: "ORD-1",
  originCountry: "France",
  destinationCountry: "Belgium",
  requestedDeliveryDate: "2026-11-10",
  transportMode: "ROAD",
  recipientName: "Taylor Morgan",
  recipientPhone: "+32 2 555 0101",
  horseIds: [],
  status: "QUOTATION_SENT",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Customer Terms integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.getAccessToken.mockReturnValue("customer-token");
    mocks.getCurrentUser.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE" });
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === "/api/v1/horses") return Promise.resolve(jsonResponse([]));
      if (path === "/api/v1/orders") return Promise.resolve(jsonResponse([order]));
      if (path === "/api/v1/orders/order-1/quotation") {
        return Promise.resolve(jsonResponse({
          id: "quote-1",
          orderId: "order-1",
          totalAmount: 4000,
          depositAmount: 1000,
          remainingAmount: 3000,
          currency: "USD",
          status: "SENT",
          lineItems: [],
        }));
      }
      if (path === "/api/v1/orders/order-1/deposit") {
        return Promise.resolve(jsonResponse({ code: "DEPOSIT_PAYMENT_NOT_FOUND" }, 404));
      }
      if (path === "/api/v1/orders/order-1/deposit/checkout") {
        return Promise.resolve(jsonResponse({ checkoutUrl: "" }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
  });

  it("shows the notice after Customer access is verified and saves the opt-out", async () => {
    const user = userEvent.setup();
    render(<CustomerPage />);

    expect(await screen.findByRole("dialog", { name: "Transport Terms & Important Notices" })).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Don't show again" }));
    await user.click(screen.getByRole("button", { name: "Got it" }));

    expect(window.localStorage.getItem(CUSTOMER_TERMS_LOGIN_HIDDEN_KEY)).toBe("true");
    expect(screen.queryByRole("dialog", { name: "Transport Terms & Important Notices" })).not.toBeInTheDocument();
  });

  it("does not show the automatic notice when the preference is already stored", async () => {
    window.localStorage.setItem(CUSTOMER_TERMS_LOGIN_HIDDEN_KEY, "true");
    render(<CustomerPage />);

    await screen.findByText("ORD-1");

    expect(screen.queryByRole("dialog", { name: "Transport Terms & Important Notices" })).not.toBeInTheDocument();
  });

  it("shows the notice again on a later Customer entry when no preference was saved", async () => {
    const user = userEvent.setup();
    const firstEntry = render(<CustomerPage />);

    await user.click(await screen.findByRole("button", { name: "Got it" }));
    expect(window.localStorage.getItem(CUSTOMER_TERMS_LOGIN_HIDDEN_KEY)).toBeNull();
    firstEntry.unmount();

    render(<CustomerPage />);
    expect(await screen.findByRole("dialog", { name: "Transport Terms & Important Notices" })).toBeVisible();
  });

  it("redirects a non-Customer without showing the Customer notice", async () => {
    mocks.getCurrentUser.mockResolvedValue({ role: "LOGISTICS_MANAGER", status: "ACTIVE" });
    render(<CustomerPage />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/logistics"));
    expect(screen.queryByRole("dialog", { name: "Transport Terms & Important Notices" })).not.toBeInTheDocument();
  });

  it("intercepts every Pay Deposit attempt and starts checkout only after fresh agreement", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CUSTOMER_TERMS_LOGIN_HIDDEN_KEY, "true");
    render(<CustomerPage />);

    await user.click(await screen.findByRole("button", { name: "View bill" }));
    const payDeposit = await screen.findByRole("button", { name: "Pay deposit" });
    await user.click(payDeposit);

    const continueButton = screen.getByRole("button", { name: "Agree & Continue to Payment" });
    expect(continueButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.apiFetch).not.toHaveBeenCalledWith(
      "/api/v1/orders/order-1/deposit/checkout",
      expect.anything(),
    );

    await user.click(payDeposit);
    const reopenedContinue = screen.getByRole("button", { name: "Agree & Continue to Payment" });
    expect(reopenedContinue).toBeDisabled();
    await user.click(screen.getByRole("checkbox", {
      name: "I have read and agree to the Transport Terms & Important Notices.",
    }));
    await user.click(reopenedContinue);

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/orders/order-1/deposit/checkout",
      expect.objectContaining({ method: "POST" }),
    ));
  });

});
