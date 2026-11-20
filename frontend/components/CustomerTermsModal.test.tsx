import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CustomerTermsModal from "./CustomerTermsModal";

describe("CustomerTermsModal", () => {
  it("returns the login preference when the Customer closes the notice", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CustomerTermsModal mode="LOGIN_NOTICE" onClose={onClose} />);

    expect(screen.getByRole("heading", { name: "Horse Transport Service and Incident Policy" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Before you submit" })).toBeVisible();
    expect(screen.getByText("Read the full policy")).toBeInTheDocument();
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
      name: /^I have read the Horse Transport Service and Incident Policy/,
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
