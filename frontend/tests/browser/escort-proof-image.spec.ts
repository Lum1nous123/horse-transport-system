import { expect, test } from "@playwright/test";
import { nearTenMegabytePngBytes, validPngBytes } from "../../test/image-fixture-builders";

const MAX_PREVIEW_DATA_URL_CHARS = 96 * 1024;

function corruptedButStructurallyCompletePng() {
  const bytes = validPngBytes();
  const marker = Buffer.from("IDAT");
  const index = Buffer.from(bytes).indexOf(marker);
  if (index < 0) throw new Error("PNG fixture has no IDAT chunk");
  const corrupted = bytes.slice();
  corrupted[index + 4] ^= 0xff;
  return corrupted;
}

test("Chromium decodes and bounds a real near-10-MiB PoD image", async ({ page }) => {
  await page.addInitScript(() => {
    const observedWindow = window as typeof window & { __imageBitmapCloseCount?: number };
    observedWindow.__imageBitmapCloseCount = 0;
    const originalClose = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function closeAndCount() {
      observedWindow.__imageBitmapCloseCount = (observedWindow.__imageBitmapCloseCount ?? 0) + 1;
      return originalClose.call(this);
    };
  });

  await page.goto("/escort/executions/road-execution-2108-final?preview=1&escortId=escort-mia");
  await expect(page.getByRole("heading", { name: "Final welfare" })).toBeVisible();

  await page.getByLabel("Welfare photo for BE-210 final destination").setInputFiles({
    name: "browser-welfare.png",
    mimeType: "image/png",
    buffer: Buffer.from(validPngBytes()),
  });
  await page.getByLabel("Welfare note for BE-210 final destination").fill("Browser-decoded final welfare evidence.");
  await page.getByRole("button", { name: "Save final welfare" }).click();
  await expect(page.getByText("Final welfare saved and read back", { exact: false })).toBeVisible();

  const proofInput = page.getByLabel(/Proof photo for BE-210/);
  await page.getByLabel(/Recipient name/).fill("Camille Martin");
  await proofInput.setInputFiles({
    name: "corrupted-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(corruptedButStructurallyCompletePng()),
  });
  await page.getByRole("button", { name: "Confirm handover" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "corrupt or cannot be decoded" })).toBeVisible();

  const nearLimit = nearTenMegabytePngBytes();
  expect(nearLimit.byteLength).toBeGreaterThan(9 * 1024 * 1024);
  expect(nearLimit.byteLength).toBeLessThanOrEqual(10 * 1024 * 1024);
  await proofInput.setInputFiles({
    name: "near-limit-proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(nearLimit),
  });
  await page.getByRole("button", { name: "Confirm handover" }).click();
  await expect(page.getByText("Proof of Delivery saved and read back", { exact: false })).toBeVisible();
  await expect(page.getByText("Saved Proof of Delivery")).toBeVisible();

  const persisted = await page.evaluate(async () => {
    const snapshot = JSON.parse(sessionStorage.getItem("horse-transport-escort-preview-v2")!) as {
      road: { executions: Array<{ id: string; proofOfDelivery: { proofPhotoUrl: string; proofPhotoName: string; proofPhotoIsPreview: boolean } | null }> };
    };
    const proof = snapshot.road.executions
      .find((execution) => execution.id === "road-execution-2108-final")!.proofOfDelivery!;
    const previewBlob = await fetch(proof.proofPhotoUrl).then((response) => response.blob());
    const previewBitmap = await createImageBitmap(previewBlob);
    const canvas = document.createElement("canvas");
    canvas.width = previewBitmap.width;
    canvas.height = previewBitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(previewBitmap, 0, 0);
    const firstPixel = [...context.getImageData(0, 0, 1, 1).data];
    previewBitmap.close();
    return {
      closeCount: (window as typeof window & { __imageBitmapCloseCount?: number }).__imageBitmapCloseCount ?? 0,
      firstPixel,
      photoName: proof.proofPhotoName,
      photoIsPreview: proof.proofPhotoIsPreview,
      photoUrlLength: proof.proofPhotoUrl.length,
      previewHeight: canvas.height,
      previewWidth: canvas.width,
      serializedLength: JSON.stringify(snapshot).length,
    };
  });

  expect(persisted).toMatchObject({
    photoName: "near-limit-proof.png",
    photoIsPreview: true,
    previewHeight: 1,
    previewWidth: 1,
  });
  expect(persisted.photoUrlLength).toBeLessThanOrEqual(MAX_PREVIEW_DATA_URL_CHARS);
  expect(persisted.serializedLength).toBeLessThan(500_000);
  expect(persisted.serializedLength).toBeLessThan(nearLimit.byteLength / 10);
  expect(persisted.firstPixel.some((channel) => channel > 0)).toBe(true);
  expect(persisted.closeCount).toBeGreaterThanOrEqual(3);
});
