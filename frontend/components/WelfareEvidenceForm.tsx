"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { evidencePhotoValidationMessage } from "@/lib/escort-execution/media-validation";

type WelfareEvidenceFormProps = {
  formId: string;
  contextLabel: string;
  title: string;
  description: string;
  busy: boolean;
  submitLabel?: string;
  onSubmit: (photo: File, note: string) => Promise<void>;
};

export default function WelfareEvidenceForm({
  formId,
  contextLabel,
  title,
  description,
  busy,
  submitLabel = "Save welfare update",
  onSubmit,
}: WelfareEvidenceFormProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const errorId = `${formId}-error`;
  const photoId = `${formId}-photo`;
  const noteId = `${formId}-note`;
  const currentPhotoError = evidencePhotoValidationMessage(photo, "welfare");
  const photoInvalid = Boolean(validationError && currentPhotoError);
  const noteInvalid = Boolean(validationError && !currentPhotoError && !note.trim());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNote = note.trim();
    const photoError = evidencePhotoValidationMessage(photo, "welfare");
    if (photoError || !photo) {
      setValidationError(photoError ?? "Choose a welfare photo before saving.");
      return;
    }
    if (!trimmedNote) {
      setValidationError("Enter a welfare note before saving.");
      return;
    }
    setValidationError("");
    try {
      await onSubmit(photo, trimmedNote);
      setNote("");
      setPhoto(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      // The parent owns service errors and persisted-state refresh behavior.
    }
  }

  return (
    <form className="escort-welfare-form" onSubmit={(event) => void submit(event)} noValidate>
      <div className="escort-welfare-form-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <span>Photo + note required</span>
      </div>
      <div className="escort-welfare-fields">
        <label htmlFor={photoId}>
          <span>Welfare photo <b aria-hidden="true">*</b></span>
          <input
            ref={fileInput}
            id={photoId}
            type="file"
            accept="image/jpeg,image/png"
            disabled={busy}
            aria-label={`Welfare photo for ${contextLabel}`}
            aria-invalid={photoInvalid}
            aria-describedby={photoInvalid ? errorId : undefined}
            onChange={(event) => {
              setPhoto(event.target.files?.[0] ?? null);
              setValidationError("");
            }}
          />
          <small>{photo ? photo.name : "JPEG or PNG, up to 10 MB"}</small>
        </label>
        <label htmlFor={noteId}>
          <span>Welfare note <b aria-hidden="true">*</b></span>
          <textarea
            id={noteId}
            rows={3}
            value={note}
            disabled={busy}
            aria-label={`Welfare note for ${contextLabel}`}
            aria-invalid={noteInvalid}
            aria-describedby={noteInvalid ? errorId : undefined}
            placeholder="Record the Horse condition and care provided."
            onChange={(event) => {
              setNote(event.target.value);
              setValidationError("");
            }}
          />
        </label>
      </div>
      {validationError && <p className="escort-form-error" id={errorId} role="alert">{validationError}</p>}
      <button className="customer-primary-button" type="submit" disabled={busy}>
        {busy ? "Saving and reading back..." : submitLabel}
      </button>
    </form>
  );
}
