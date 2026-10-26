import { EscortExecutionError } from "./types";

export const MAX_EVIDENCE_PHOTO_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

export type EvidencePhotoKind = "welfare" | "proof";

export function evidencePhotoValidationMessage(
  file: File | null | undefined,
  kind: EvidencePhotoKind,
): string | null {
  const label = kind === "proof" ? "Proof photo" : "Welfare photo";
  if (!file || file.size === 0) {
    return kind === "proof"
      ? "Choose a proof photo before confirming handover."
      : "Choose a welfare photo before saving.";
  }
  if (!EVIDENCE_PHOTO_TYPES.includes(file.type as (typeof EVIDENCE_PHOTO_TYPES)[number])) {
    return `${label} must be a JPEG or PNG image.`;
  }
  if (file.size > MAX_EVIDENCE_PHOTO_BYTES) {
    return `${label} must be 10 MB or smaller.`;
  }
  return null;
}

export function assertValidEvidencePhoto(
  file: File | null | undefined,
  kind: EvidencePhotoKind,
): asserts file is File {
  const message = evidencePhotoValidationMessage(file, kind);
  if (message) throw new EscortExecutionError(message, "VALIDATION_ERROR");
}
