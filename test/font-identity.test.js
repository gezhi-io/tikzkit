import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodeWoffFont } from "../scripts/font-raster-assets.js";
import { fontManifest } from "../src/fonts/manifest.js";

function tables(sfnt) {
  const result = new Map();
  for (let i = 0; i < sfnt.readUInt16BE(4); i++) {
    const entry = 12 + i * 16;
    const offset = sfnt.readUInt32BE(entry + 8);
    result.set(sfnt.toString("ascii", entry, entry + 4),
      sfnt.subarray(offset, offset + sfnt.readUInt32BE(entry + 12)));
  }
  return result;
}

function cffName(cff) {
  const start = cff[2];
  assert.equal(cff.readUInt16BE(start), 1, "OpenType CFF contains one font");
  const size = cff[start + 2];
  const first = cff.readUIntBE(start + 3, size);
  const last = cff.readUIntBE(start + 3 + size, size);
  const data = start + 3 + 2 * size;
  return cff.toString("ascii", data + first - 1, data + last - 1);
}

for (const font of fontManifest) {
  test(`font identity agrees with CSS: ${font.file}`, async () => {
    const sfnt = decodeWoffFont(await readFile(new URL(`../web/fonts/${font.file}`, import.meta.url)));
    const table = tables(sfnt);
    const os2 = table.get("OS/2");
    const selection = os2.readUInt16BE(62);
    const bold = font.weight >= 700;
    const italic = font.style === "italic";
    assert.equal(os2.readUInt16BE(4), font.weight, "OS/2 weight must not relabel bold outlines as regular");
    assert.equal(Boolean(selection & 1), italic, "OS/2 italic");
    assert.equal(Boolean(selection & 32), bold, "OS/2 bold");
    assert.equal(Boolean(selection & 64), !bold && !italic, "OS/2 regular");
    assert.equal(table.get("head").readUInt16BE(44) & 3, Number(bold) | (Number(italic) << 1), "head macStyle");
    const style = font.file.slice(font.family.length + 1, -5);
    assert.equal(cffName(table.get("CFF ")), `${font.family.replaceAll("_", "")}-${style}`,
      "distinct faces must not share the source font's PostScript identity");
  });
}
