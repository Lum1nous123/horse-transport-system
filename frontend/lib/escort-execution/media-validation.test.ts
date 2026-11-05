import { describe, expect, it } from "vitest";
import {
  MAX_EVIDENCE_PHOTO_BYTES,
  assertValidEvidencePhoto,
  evidencePhotoValidationMessage,
} from "./media-validation";

function photo(size: number, type = "image/png", name = "evidence.png") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("evidence photo validation", () => {
  it.each([
    ["image/jpeg", "evidence.jpg"],
    ["image/png", "evidence.png"],
  ])("accepts nonempty %s evidence at the 10 MiB boundary", (type, name) => {
    const file = photo(MAX_EVIDENCE_PHOTO_BYTES, type, name);
    expect(evidencePhotoValidationMessage(file, "welfare")).toBeNull();
    expect(() => assertValidEvidencePhoto(file, "proof")).not.toThrow();
  });

  it("rejects empty evidence", () => {
    expect(evidencePhotoValidationMessage(photo(0), "welfare"))
      .toBe("Choose a welfare photo before saving.");
    expect(() => assertValidEvidencePhoto(photo(0), "proof"))
      .toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it.each(["image/gif", "image/webp", "text/plain"])("rejects unsupported MIME type %s", (type) => {
    expect(evidencePhotoValidationMessage(photo(1, type), "welfare"))
      .toBe("Welfare photo must be a JPEG or PNG image.");
  });

  it("rejects evidence larger than 10 MiB", () => {
    expect(evidencePhotoValidationMessage(photo(MAX_EVIDENCE_PHOTO_BYTES + 1), "proof"))
      .toBe("Proof photo must be 10 MB or smaller.");
  });
});
