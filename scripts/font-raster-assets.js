import { inflateSync } from "node:zlib";

// Pango/CoreText cannot use WOFF on all hosts. Recover the same OpenType
// tables for local rasterization instead of substituting an installed font.
export function decodeWoffFont(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "wOFF") throw new Error("Expected WOFF 1 font");
  const count = bytes.readUInt16BE(12);
  if (!count || 44 + count * 20 > bytes.length) throw new Error("Invalid WOFF table directory");
  const tables = [];
  let size = 12 + count * 16;
  for (let i = 0; i < count; i++) {
    const entry = 44 + i * 20;
    const offset = bytes.readUInt32BE(entry + 4);
    const packedLength = bytes.readUInt32BE(entry + 8);
    const length = bytes.readUInt32BE(entry + 12);
    if (packedLength > length || offset + packedLength > bytes.length) throw new Error("Invalid WOFF table length");
    const packed = bytes.subarray(offset, offset + packedLength);
    const data = packedLength === length ? packed : inflateSync(packed, { maxOutputLength: length });
    if (data.length !== length) throw new Error("Truncated WOFF table");
    tables.push({ tag: bytes.subarray(entry, entry + 4), checksum: bytes.readUInt32BE(entry + 16), data, offset: size });
    size += (length + 3) & ~3;
  }
  if (size !== bytes.readUInt32BE(16)) throw new Error("Incorrect WOFF sfnt size");
  const output = Buffer.alloc(size);
  bytes.copy(output, 0, 4, 8);
  output.writeUInt16BE(count, 4);
  const selector = Math.floor(Math.log2(count));
  output.writeUInt16BE(16 * 2 ** selector, 6);
  output.writeUInt16BE(selector, 8);
  output.writeUInt16BE(count * 16 - 16 * 2 ** selector, 10);
  let head = null;
  for (const [i, table] of tables.entries()) {
    const entry = 12 + 16 * i;
    table.tag.copy(output, entry);
    output.writeUInt32BE(table.checksum, entry + 4);
    output.writeUInt32BE(table.offset, entry + 8);
    output.writeUInt32BE(table.data.length, entry + 12);
    table.data.copy(output, table.offset);
    if (table.tag.toString() === "head") head = table.offset;
  }
  if (head !== null) {
    output.writeUInt32BE(0, head + 8);
    let sum = 0;
    for (let i = 0; i < output.length; i += 4) sum = (sum + output.readUInt32BE(i)) >>> 0;
    output.writeUInt32BE((0xb1b0afba - sum) >>> 0, head + 8);
  }
  return output;
}
