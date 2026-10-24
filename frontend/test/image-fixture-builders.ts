const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function bytesFromBase64(value: string) {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function concatenate(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }
  return current >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value: number) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function pngChunk(type: string, payload: Uint8Array) {
  const typeBytes = Uint8Array.from(type, (character) => character.charCodeAt(0));
  return concatenate([uint32(payload.length), typeBytes, payload, uint32(crc32(concatenate([typeBytes, payload])))]);
}

export function validPngBytes() {
  return bytesFromBase64(PNG_BASE64);
}

export function nearTenMegabytePngBytes() {
  const original = validPngBytes();
  const targetSize = 10 * 1024 * 1024 - 1024;
  const iendOffset = original.length - 12;
  const payloadLength = targetSize - original.length - 12;
  // Unknown ancillary PNG chunks are decoder-safe. A valid CRC keeps this a
  // genuinely decodable image while providing a deterministic near-limit file.
  const paddingChunk = pngChunk("raNd", new Uint8Array(payloadLength));
  return concatenate([original.slice(0, iendOffset), paddingChunk, original.slice(iendOffset)]);
}
