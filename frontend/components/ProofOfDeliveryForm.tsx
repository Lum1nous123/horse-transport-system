"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ProofOfDeliveryInput } from "@/lib/escort-execution/types";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
type InvalidField = "recipient" | "photo" | null;

type ProofOfDeliveryFormProps = {
  formId: string;
  contextLabel: string;
  busy: boolean;
  onSubmit: (input: ProofOfDeliveryInput) => Promise<void>;
};

export default function ProofOfDeliveryForm({
  formId,
  contextLabel,
  busy,
  onSubmit,
}: ProofOfDeliveryFormProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [recipientName, setRecipientName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState("");
  const [invalidField, setInvalidField] = useState<InvalidField>(null);
  const recipientId = `${formId}-recipient`;
  const photoId = `${formId}-photo`;
  const noteId = `${formId}-note`;
  const errorId = `${formId}-error`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmedRecipientName = recipientName.trim();
    if (!trimmedRecipientName) {
      setValidationError("Enter the recipient name before confirming handover.");
      setInvalidField("recipient");
      return;
    }
    if (trimmedRecipientName.length > 150) {
      setValidationError("Recipient name must be 150 characters or fewer.");
      setInvalidField("recipient");
      return;
    }
    if (!photo) {
      setValidationError("Choose a proof photo before confirming handover.");
      setInvalidField("photo");
      return;
    }
    if (photo.type !== "image/jpeg" && photo.type !== "image/png") {
      setValidationError("Proof photo must be a JPEG or PNG image.");
      setInvalidField("photo");
      return;
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      setValidationError("Proof photo must be 10 MB or smaller.");
      setInvalidField("photo");
      return;
    }

    setValidationError("");
    setInvalidField(null);
    try {
      await onSubmit({
        recipientName: trimmedRecipientName,
        photo,
        note: note.trim() || undefined,
      });
      setRecipientName("");
      setPhoto(null);
      setNote("");
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      // The detail page owns service errors and persisted-state reconciliation.
    }
  }

  return (
    <form className="escort-pod-form" onSubmit={(event) => void submit(event)} noValidate>
      <div className="escort-welfare-form-heading">
        <div>
          <h3>Confirm final handover</h3>
          <p>Record recipient and delivery evidence for {contextLabel}. This is separate from final welfare.</p>
        </div>
        <span>Recipient + photo required</span>
      </div>
      <div className="escort-pod-fields">
        <label htmlFor={recipientId}>
          <span>Recipient name <b aria-hidden="true">*</b></span>
          <input
            id={recipientId}
            type="text"
            maxLength={150}
            value={recipientName}
            disabled={busy}
            autoComplete="name"
            aria-invalid={invalidField === "recipient"}
            aria-describedby={invalidField === "recipient" ? errorId : undefined}
            onChange={(event) => {
              setRecipientName(event.target.value);
              setValidationError("");
              setInvalidField(null);
            }}
          />
        </label>
        <label htmlFor={photoId}>
          <span>Proof photo <b aria-hidden="true">*</b></span>
          <input
            ref={fileInput}
            id={photoId}
            type="file"
            accept="image/jpeg,image/png"
            disabled={busy}
            aria-label={`Proof photo for ${contextLabel}`}
            aria-invalid={invalidField === "photo"}
            aria-describedby={invalidField === "photo" ? errorId : undefined}
            onChange={(event) => {
              setPhoto(event.target.files?.[0] ?? null);
              setValidationError("");
              setInvalidField(null);
            }}
          />
          <small>{photo ? photo.name : "JPEG or PNG, up to 10 MB"}</small>
        </label>
        <label htmlFor={noteId} className="escort-pod-note">
          <span>Handover note <small>(optional)</small></span>
          <textarea
            id={noteId}
            rows={3}
            value={note}
            disabled={busy}
            placeholder="Add any relevant handover detail."
            onChange={(event) => {
              setNote(event.target.value);
              setValidationError("");
              setInvalidField(null);
            }}
          />
        </label>
      </div>
      {validationError && <p className="escort-form-error" id={errorId} role="alert">{validationError}</p>}
      <button className="customer-primary-button" type="submit" disabled={busy}>
        {busy ? "Confirming and reading back..." : "Confirm handover"}
      </button>
    </form>
  );
}
