import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function sfntTable(view, tag) {
  const tableCount = view.getUint16(4);
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    const recordTag = String.fromCharCode(
      view.getUint8(record),
      view.getUint8(record + 1),
      view.getUint8(record + 2),
      view.getUint8(record + 3)
    );
    if (recordTag === tag) {
      return view.getUint32(record + 8);
    }
  }
  throw new Error(`Missing ${tag} table`);
}

function cmapGlyphIndex(view, codePoint) {
  const cmap = sfntTable(view, "cmap");
  const subtableCount = view.getUint16(cmap + 2);
  for (let index = 0; index < subtableCount; index += 1) {
    const record = cmap + 4 + index * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const subtable = cmap + view.getUint32(record + 4);
    if (!((platform === 0) || (platform === 3 && encoding === 1)) || view.getUint16(subtable) !== 4) {
      continue;
    }
    const segmentCount = view.getUint16(subtable + 6) / 2;
    const endCodes = subtable + 14;
    const startCodes = endCodes + segmentCount * 2 + 2;
    const deltas = startCodes + segmentCount * 2;
    const rangeOffsets = deltas + segmentCount * 2;
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const start = view.getUint16(startCodes + segment * 2);
      const end = view.getUint16(endCodes + segment * 2);
      if (codePoint < start || codePoint > end) continue;
      const delta = view.getInt16(deltas + segment * 2);
      const rangeOffsetAddress = rangeOffsets + segment * 2;
      const rangeOffset = view.getUint16(rangeOffsetAddress);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyph = view.getUint16(rangeOffsetAddress + rangeOffset + 2 * (codePoint - start));
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
  }
  throw new Error(`No format-4 Unicode cmap for U+${codePoint.toString(16)}`);
}

function advanceWidth(view, glyphIndex) {
  const hhea = sfntTable(view, "hhea");
  const hmtx = sfntTable(view, "hmtx");
  const longMetricCount = view.getUint16(hhea + 34);
  const metricIndex = Math.min(glyphIndex, longMetricCount - 1);
  return view.getUint16(hmtx + metricIndex * 4);
}

test("Computer Modern optical fonts map Unicode space to blank TeX spacing instead of suppress", async () => {
  const files = [
    ...[5, 6, 7, 8, 9, 10, 12, 17].map((size) => `TikZKitCMR${size}-Regular.otf`),
    ...[5, 6, 7, 8, 9, 10, 12].map((size) => `TikZKitCMBX${size}-Bold.otf`)
  ];
  for (const fileName of files) {
    const bytes = await readFile(new URL(`../web/fonts/${fileName}`, import.meta.url));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const spaceGlyph = cmapGlyphIndex(view, 0x20);
    const hyphenGlyph = cmapGlyphIndex(view, 0x2d);
    assert.notEqual(spaceGlyph, 0, `${fileName} should expose U+0020`);
    assert.equal(
      advanceWidth(view, spaceGlyph),
      advanceWidth(view, hyphenGlyph),
      `${fileName} space should preserve the native TeX interword advance`
    );
  }
});
