"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

type RoadWelfareFormProps = {
  formId: string;
  contextLabel: string;
  title: string;
  description: string;
  busy: boolean;
  submitLabel?: string;
  onSubmit: (photo: File, note: string) => Promise<void>;
};

export default function RoadWelfareForm({
  formId,
  contextLabel,
  title,
  description,
  busy,
  submitLabel = "Save welfare update",
  onSubmit,
}: RoadWelfareFormProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const errorId = `${formId}-error`;
  const photoId = `${formId}-photo`;
  const noteId = `${formId}-note`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (!photo || !photo.type.startsWith("image/")) {
      setValidationError("Choose a welfare photo before saving.");
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
            accept="image/*"
            disabled={busy}
            aria-label={`Welfare photo for ${contextLabel}`}
            aria-invalid={Boolean(validationError && !photo)}
            aria-describedby={validationError ? errorId : undefined}
            onChange={(event) => {
              setPhoto(event.target.files?.[0] ?? null);
              setValidationError("");
            }}
          />
          {photo && <small>{photo.name}</small>}
        </label>
        <label htmlFor={noteId}>
          <span>Welfare note <b aria-hidden="true">*</b></span>
          <textarea
            id={noteId}
            rows={3}
            value={note}
            disabled={busy}
            aria-label={`Welfare note for ${contextLabel}`}
            aria-invalid={Boolean(validationError && !note.trim())}
            aria-describedby={validationError ? errorId : undefined}
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
