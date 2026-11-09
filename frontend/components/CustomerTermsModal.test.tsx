import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CustomerTermsModal from "./CustomerTermsModal";

describe("CustomerTermsModal", () => {
  it("returns the login preference when the Customer closes the notice", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CustomerTermsModal mode="LOGIN_NOTICE" onClose={onClose} />);

    expect(screen.getByRole("heading", { name: "Transport Terms & Important Notices" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "1. Scope of Transport Services" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "30. Contact Information" })).toBeInTheDocument();
    expect(screen.getByText("Stripe for payment processing;")).toBeInTheDocument();
    expect(screen.getByText(/Email: support@horsetransport\.demo\s+Phone: 028\.7300\.8899\s+Address: 123 Transport Street/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Don't show again" }));
    await user.click(screen.getByRole("button", { name: "Got it" }));

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("requires fresh Deposit acceptance before continuing", async () => {
    const user = userEvent.setup();
    const onAgree = vi.fn();
    const onClose = vi.fn();
    render(<CustomerTermsModal mode="DEPOSIT_CONFIRMATION" onClose={onClose} onAgree={onAgree} />);

    const continueButton = screen.getByRole("button", { name: "Agree & Continue to Payment" });
    expect(continueButton).toBeDisabled();
    expect(screen.queryByText("Don't show again")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", {
      name: "I have read and agree to the Transport Terms & Important Notices.",
    }));
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    expect(onAgree).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels Deposit confirmation without continuing", async () => {
    const user = userEvent.setup();
    const onAgree = vi.fn();
    const onClose = vi.fn();
    render(<CustomerTermsModal mode="DEPOSIT_CONFIRMATION" onClose={onClose} onAgree={onAgree} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onAgree).not.toHaveBeenCalled();
  });
});
