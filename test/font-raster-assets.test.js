import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodeWoffFont } from "../scripts/font-raster-assets.js";
import { fontManifest } from "../src/fonts/manifest.js";

test("all MacTeX web fonts decode to checksummed native OpenType tables", async () => {
  for (const font of fontManifest) {
    const original = await readFile(new URL(`../web/fonts/${font.file}`, import.meta.url));
    const decoded = decodeWoffFont(original);
    assert.equal(decoded.readUInt32BE(0), original.readUInt32BE(4));
    assert.equal(decoded.length, original.readUInt32BE(16));
    assert.equal(decoded.readUInt16BE(4), original.readUInt16BE(12));
    let sum = 0;
    for (let i = 0; i < decoded.length; i += 4) sum = (sum + decoded.readUInt32BE(i)) >>> 0;
    assert.equal(sum, 0xb1b0afba, font.file);
  }
});

test("invalid WOFF headers are rejected", () => {
  assert.throws(() => decodeWoffFont(Buffer.from("wOFF")), /Expected WOFF/);
  assert.throws(() => decodeWoffFont(Buffer.alloc(100)), /Expected WOFF/);
});
