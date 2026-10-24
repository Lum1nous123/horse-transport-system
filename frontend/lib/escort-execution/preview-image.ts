import { EscortExecutionError } from "./types";

const MAX_PROOF_PHOTO_BYTES = 10 * 1024 * 1024;
// A derived preview is capped at 96 KiB (including the data-URL prefix). This
// keeps the current ROAD/AIR fixture's full evidence set below common 5 MiB
// sessionStorage quotas while lifecycle state and previews remain one atomic write.
const MAX_PREVIEW_DATA_URL_CHARS = 96 * 1024;
const MAX_PREVIEW_EDGE = 480;
const MIN_PREVIEW_EDGE = 96;

type PreparedPreviewImage = {
  photoUrl: string;
  photoName: string;
  photoIsPreview: true;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
};

function validationError(message: string) {
  return new EscortExecutionError(message, "VALIDATION_ERROR");
}

function isPng(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((value, index) => bytes[index] === value);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] << 24) >>> 0)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]) >>> 0;
}

function hasValidPngStructure(bytes: Uint8Array) {
  if (bytes.length < 45 || !isPng(bytes)) return false;
  let offset = 8;
  let sawHeader = false;
  let sawImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) return false;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return false;
      const width = readUint32(bytes, offset + 8);
      const height = readUint32(bytes, offset + 12);
      if (!width || !height) return false;
      sawHeader = true;
    } else if (type === "IHDR") {
      return false;
    }
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") return length === 0 && sawHeader && sawImageData && chunkEnd === bytes.length;
    offset = chunkEnd;
  }
  return false;
}

function isStandaloneJpegMarker(marker: number) {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);
}

function isStartOfFrame(marker: number) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]
    .includes(marker);
}

function hasValidJpegStructure(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let offset = 2;
  let sawFrame = false;
  let sawScan = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      if (!sawScan) return false;
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return false;
    const marker = bytes[offset++];
    if (marker === 0x00) {
      if (!sawScan) return false;
      continue;
    }
    if (marker === 0xd9) return sawFrame && sawScan && offset === bytes.length;
    if (isStandaloneJpegMarker(marker)) continue;
    if (offset + 2 > bytes.length) return false;
    const length = (bytes[offset] << 8) + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if (isStartOfFrame(marker)) {
      if (length < 8) return false;
      const height = (bytes[offset + 3] << 8) + bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) + bytes[offset + 6];
      if (!width || !height) return false;
      sawFrame = true;
    }
    if (marker === 0xda) sawScan = true;
    offset += length;
  }
  return false;
}

async function readBytes(file: File) {
  try {
    if (typeof file.arrayBuffer === "function") {
      return new Uint8Array(await file.arrayBuffer());
    }
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
    return new Uint8Array(buffer);
  } catch {
    throw validationError("We couldn't read that photo. Choose it again.");
  }
}

function validateProofBytes(bytes: Uint8Array, type: string) {
  const valid = type === "image/png" ? hasValidPngStructure(bytes) : hasValidJpegStructure(bytes);
  if (!valid) {
    throw validationError("Proof photo content does not match a complete JPEG or PNG image.");
  }
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(validationError("The selected photo is corrupt or cannot be decoded."));
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw validationError("The selected photo is corrupt or cannot be decoded.");
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height) throw new Error("Image has no dimensions");
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      throw validationError("The selected photo is corrupt or cannot be decoded.");
    }
  }
  return decodeWithImageElement(file);
}

function scaledDimensions(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function renderBoundedPreview(decoded: DecodedImage) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw validationError("This browser cannot prepare a safe image preview.");

  for (const maxEdge of [MAX_PREVIEW_EDGE, 360, 240, MIN_PREVIEW_EDGE]) {
    const dimensions = scaledDimensions(decoded.width, decoded.height, maxEdge);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.72, 0.58, 0.44]) {
      const preview = canvas.toDataURL("image/jpeg", quality);
      if (preview.startsWith("data:image/jpeg") && preview.length <= MAX_PREVIEW_DATA_URL_CHARS) {
        return preview;
      }
    }
  }
  throw validationError("The selected photo could not be reduced to the safe preview storage budget.");
}

export async function preparePreviewImage(
  file: File,
  options: { proof: boolean },
): Promise<PreparedPreviewImage> {
  if (!file || file.size === 0) {
    throw validationError(options.proof
      ? "Choose a proof photo before confirming handover."
      : "Choose a welfare photo before saving.");
  }
  if (options.proof) {
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      throw validationError("Proof photo must be a JPEG or PNG image.");
    }
    if (file.size > MAX_PROOF_PHOTO_BYTES) {
      throw validationError("Proof photo must be 10 MB or smaller.");
    }
  } else if (!file.type.startsWith("image/")) {
    throw validationError("Choose a welfare photo before saving.");
  }

  const bytes = await readBytes(file);
  if (options.proof) validateProofBytes(bytes, file.type);
  const decoded = await decodeImage(file);
  try {
    return {
      photoUrl: renderBoundedPreview(decoded),
      photoName: file.name,
      photoIsPreview: true,
    };
  } finally {
    decoded.close();
  }
}

export const previewImageStorageBudget = MAX_PREVIEW_DATA_URL_CHARS;
