const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = makeCrcTable();
const MAX_STORED_BLOCK_SIZE = 0xffff;

export function encodeRgbaPngDataUri(width, height, rgba) {
  const normalizedWidth = Math.max(0, Math.floor(width));
  const normalizedHeight = Math.max(0, Math.floor(height));
  if (!normalizedWidth || !normalizedHeight) {
    return "";
  }
  const scanlines = pngScanlines(normalizedWidth, normalizedHeight, rgba);
  const png = concatBytes([
    PNG_SIGNATURE,
    pngChunk("IHDR", concatBytes([u32be(normalizedWidth), u32be(normalizedHeight), new Uint8Array([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", zlibStored(scanlines)),
    pngChunk("IEND", new Uint8Array(0))
  ]);
  return `data:image/png;base64,${base64FromBytes(png)}`;
}

function pngScanlines(width, height, rgba) {
  const stride = width * 4;
  const scanlines = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * stride;
    const targetStart = y * (stride + 1);
    scanlines[targetStart] = 0;
    scanlines.set(rgba.subarray(sourceStart, sourceStart + stride), targetStart + 1);
  }
  return scanlines;
}

function zlibStored(data) {
  const blocks = [];
  blocks.push(new Uint8Array([0x78, 0x01]));
  for (let offset = 0; offset < data.length; offset += MAX_STORED_BLOCK_SIZE) {
    const chunk = data.subarray(offset, offset + MAX_STORED_BLOCK_SIZE);
    const finalBlock = offset + MAX_STORED_BLOCK_SIZE >= data.length ? 1 : 0;
    const header = new Uint8Array(5);
    header[0] = finalBlock;
    header[1] = chunk.length & 0xff;
    header[2] = (chunk.length >> 8) & 0xff;
    const nlen = (~chunk.length) & 0xffff;
    header[3] = nlen & 0xff;
    header[4] = (nlen >> 8) & 0xff;
    blocks.push(header, chunk);
  }
  blocks.push(u32be(adler32(data)));
  return concatBytes(blocks);
}

function pngChunk(type, data) {
  const typeBytes = asciiBytes(type);
  return concatBytes([u32be(data.length), typeBytes, data, u32be(crc32(concatBytes([typeBytes, data])))]);
}

function u32be(value) {
  const bytes = new Uint8Array(4);
  bytes[0] = (value >>> 24) & 0xff;
  bytes[1] = (value >>> 16) & 0xff;
  bytes[2] = (value >>> 8) & 0xff;
  bytes[3] = value & 0xff;
  return bytes;
}

function asciiBytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }
  return table;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function base64FromBytes(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}
