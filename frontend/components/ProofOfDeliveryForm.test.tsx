import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProofOfDeliveryForm from "./ProofOfDeliveryForm";

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ProofOfDeliveryForm
      formId="pod"
      contextLabel="TRK-101"
      busy={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe("ProofOfDeliveryForm", () => {
  it("requires a trimmed recipient and proof photo", async () => {
    const onSubmit = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the recipient name");
    expect(screen.getByLabelText(/Recipient name/)).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByLabelText(/Recipient name/), "   ");
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the recipient name");

    await user.clear(screen.getByLabelText(/Recipient name/));
    await user.type(screen.getByLabelText(/Recipient name/), "  Camille Martin  ");
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a proof photo");
    expect(screen.getByLabelText("Proof photo for TRK-101")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts JPEG/PNG, trims values and keeps note optional", async () => {
    const onSubmit = renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Recipient name/), "  Camille Martin  ");
    await user.upload(screen.getByLabelText("Proof photo for TRK-101"), new File(["png"], "handover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      recipientName: "Camille Martin",
      note: undefined,
      photo: expect.objectContaining({ name: "handover.png", type: "image/png" }),
    }));
  });

  it("rejects unsupported MIME and files over 10 MB", async () => {
    const onSubmit = renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Recipient name/), "Camille Martin");
    const input = screen.getByLabelText("Proof photo for TRK-101");

    fireEvent.change(input, {
      target: { files: [new File(["text"], "proof.txt", { type: "text/plain" })] },
    });
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG or PNG");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })] },
    });
    await user.click(screen.getByRole("button", { name: "Confirm handover" }));
    expect(screen.getByRole("alert")).toHaveTextContent("10 MB or smaller");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
