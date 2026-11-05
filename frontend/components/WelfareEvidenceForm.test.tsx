import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WelfareEvidenceForm from "./WelfareEvidenceForm";

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <WelfareEvidenceForm
      formId="welfare"
      contextLabel="Vehicle TRK-101"
      title="Record welfare"
      description="Attach current evidence."
      busy={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

async function enterNote() {
  await userEvent.setup().type(screen.getByLabelText("Welfare note for Vehicle TRK-101"), "  Calm and hydrated.  ");
}

function expectPhotoAccessibility(message: string) {
  const input = screen.getByLabelText("Welfare photo for Vehicle TRK-101");
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(message);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAttribute("aria-describedby", alert.id);
}

describe("WelfareEvidenceForm", () => {
  it.each([
    ["JPEG", "image/jpeg", "welfare.jpg"],
    ["PNG", "image/png", "welfare.png"],
  ])("accepts a valid %s and preserves the original File", async (_label, type, name) => {
    const onSubmit = renderForm();
    const user = userEvent.setup();
    const file = new File(["image"], name, { type });
    await user.upload(screen.getByLabelText("Welfare photo for Vehicle TRK-101"), file);
    await user.type(screen.getByLabelText("Welfare note for Vehicle TRK-101"), "  Calm and hydrated.  ");
    await user.click(screen.getByRole("button", { name: "Save welfare update" }));

    expect(onSubmit).toHaveBeenCalledWith(file, "Calm and hydrated.");
  });

  it("marks an unsupported GIF invalid and associates its validation message", async () => {
    const onSubmit = renderForm();
    await enterNote();
    const input = screen.getByLabelText("Welfare photo for Vehicle TRK-101");
    fireEvent.change(input, {
      target: { files: [new File(["gif"], "welfare.gif", { type: "image/gif" })] },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save welfare update" }));

    expectPhotoAccessibility("JPEG or PNG");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("marks an oversized PNG invalid and associates its validation message", async () => {
    const onSubmit = renderForm();
    await enterNote();
    const input = screen.getByLabelText("Welfare photo for Vehicle TRK-101");
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })],
      },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save welfare update" }));

    expectPhotoAccessibility("10 MB or smaller");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("marks an empty JPEG invalid and associates its validation message", async () => {
    const onSubmit = renderForm();
    await enterNote();
    const input = screen.getByLabelText("Welfare photo for Vehicle TRK-101");
    fireEvent.change(input, {
      target: { files: [new File([], "empty.jpg", { type: "image/jpeg" })] },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save welfare update" }));

    expectPhotoAccessibility("Choose a welfare photo");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
