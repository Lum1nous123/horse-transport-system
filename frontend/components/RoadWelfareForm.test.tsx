import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RoadWelfareForm from "./RoadWelfareForm";

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <RoadWelfareForm
      formId="checkpoint-welfare"
      contextLabel="Bluegrass rest area checkpoint"
      title="Checkpoint welfare"
      description="Record evidence after arrival."
      busy={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe("RoadWelfareForm", () => {
  it("requires an image and a non-empty note", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.click(screen.getByRole("button", { name: "Save welfare update" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Choose a welfare photo");
    expect(screen.getByLabelText("Welfare photo for Bluegrass rest area checkpoint"))
      .toHaveAttribute("aria-describedby", alert.id);

    await user.upload(
      screen.getByLabelText(/Welfare photo/),
      new File(["text"], "notes.txt", { type: "text/plain" }),
    );
    await user.type(screen.getByLabelText(/Welfare note/), "Horse is stable.");
    await user.click(screen.getByRole("button", { name: "Save welfare update" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a welfare photo");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("trims the note, submits evidence and clears persisted form input", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    const photoInput = screen.getByLabelText(/Welfare photo/) as HTMLInputElement;
    const noteInput = screen.getByLabelText(/Welfare note/) as HTMLTextAreaElement;
    const photo = new File(["image"], "welfare.png", { type: "image/png" });

    await user.upload(photoInput, photo);
    await user.type(noteInput, "  Horse is calm and hydrated.  ");
    await user.click(screen.getByRole("button", { name: "Save welfare update" }));

    expect(onSubmit).toHaveBeenCalledWith(photo, "Horse is calm and hydrated.");
    expect(noteInput).toHaveValue("");
    expect(photoInput.files).toHaveLength(0);
  });

  it("disables inputs and communicates the read-back state while saving", () => {
    render(
      <RoadWelfareForm
        formId="final-welfare"
        contextLabel="TRK-101 final destination"
        title="Final welfare"
        description="Record destination evidence."
        busy
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Welfare photo/)).toBeDisabled();
    expect(screen.getByLabelText(/Welfare note/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving and reading back..." })).toBeDisabled();
  });
});
