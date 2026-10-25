import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installPreviewImageMocks,
  nearTenMegabytePng,
  validJpegFile,
  validPngFile,
} from "@/test/image-fixtures";
import { preparePreviewImage, previewImageStorageBudget } from "./preview-image";

async function expectValidationError(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    name: "EscortExecutionError",
    code: "VALIDATION_ERROR",
  });
}

describe("preparePreviewImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    installPreviewImageMocks();
  });

  it.each([
    ["PNG", () => validPngFile()],
    ["JPEG", () => validJpegFile()],
  ])("validates, decodes and derives a bounded %s preview", async (_label, createFile) => {
    const prepared = await preparePreviewImage(createFile(), { proof: true });

    expect(prepared).toMatchObject({ photoIsPreview: true });
    expect(prepared.photoUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(prepared.photoUrl.length).toBeLessThanOrEqual(previewImageStorageBudget);
    expect(createImageBitmap).toHaveBeenCalledOnce();
  });

  it("unit-checks a structurally valid near-10 MB PNG with controlled decoder/canvas mocks", async () => {
    const file = nearTenMegabytePng();
    expect(file.size).toBeGreaterThan(9 * 1024 * 1024);
    expect(file.size).toBeLessThanOrEqual(10 * 1024 * 1024);

    const prepared = await preparePreviewImage(file, { proof: true });

    expect(prepared.photoUrl.length).toBeLessThanOrEqual(previewImageStorageBudget);
    expect(prepared.photoUrl.length).toBeLessThan(file.size / 50);
  });

  it("rejects spoofed MIME, truncated content and decoder failures", async () => {
    await expectValidationError(preparePreviewImage(
      new File(["not a png"], "spoof.png", { type: "image/png" }),
      { proof: true },
    ));
    const png = validPngFile();
    await expectValidationError(preparePreviewImage(
      new File([await new Response(png).arrayBuffer().then((bytes) => bytes.slice(0, 24))], "truncated.png", { type: "image/png" }),
      { proof: true },
    ));

    vi.mocked(createImageBitmap).mockRejectedValueOnce(new DOMException("Decode failed"));
    await expectValidationError(preparePreviewImage(validPngFile("corrupt.png"), { proof: true }));
  });

  it("releases decoded image resources after preview generation", async () => {
    const { close } = installPreviewImageMocks();
    await preparePreviewImage(validPngFile(), { proof: true });
    expect(close).toHaveBeenCalledOnce();
  });
});
