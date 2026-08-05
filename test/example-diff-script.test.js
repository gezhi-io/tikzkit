import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { compareDecodedPngs, compareExamplePngs, decodePng, findBestPixelAlignment, formatExampleDiffSummary } from "../scripts/diff-example-pngs.js";

test("example PNG diff report compares rendered TikZKit and tikztosvg PNG artifacts", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-diff-"));
  await writeFixturePng(path.join(outputRoot, "tikzkit-png", "same.png"), [
    [0, 0, 0, 255],
    [255, 255, 255, 255]
  ]);
  await writeFixturePng(path.join(outputRoot, "tikztosvg-png", "same.png"), [
    [0, 0, 0, 255],
    [255, 255, 255, 255]
  ]);
  await writeFixturePng(path.join(outputRoot, "tikzkit-png", "different.png"), [
    [0, 0, 0, 255],
    [255, 255, 255, 255]
  ]);
  await writeFixturePng(path.join(outputRoot, "tikztosvg-png", "different.png"), [
    [255, 0, 0, 255],
    [255, 255, 255, 255]
  ]);
  await writeFixturePng(path.join(outputRoot, "mactex-png", "different.png"), [
    [0, 0, 0, 255],
    [255, 255, 255, 255]
  ]);
  await writeFixturePng(path.join(outputRoot, "tikzkit-png", "mismatch.png"), [
    [0, 0, 0, 255]
  ]);
  await writeFixturePng(path.join(outputRoot, "tikztosvg-png", "mismatch.png"), [
    [0, 0, 0, 255],
    [255, 255, 255, 255]
  ]);
  await writeFile(
    path.join(outputRoot, "summary.json"),
    `${JSON.stringify({
      cases: [
        {
          id: "same",
          tikzkitPng: "tikzkit-png/same.png",
          tikztosvgPng: "tikztosvg-png/same.png",
          tikzkitPngStatus: "rendered",
          tikztosvgPngStatus: "rendered"
        },
        {
          id: "different",
          tikzkitPng: "tikzkit-png/different.png",
          tikztosvgPng: "tikztosvg-png/different.png",
          tikzkitPngStatus: "rendered",
          tikztosvgPngStatus: "rendered",
          mactexPng: "mactex-png/different.png",
          mactexPngStatus: "rendered"
        },
        {
          id: "mismatch",
          tikzkitPng: "tikzkit-png/mismatch.png",
          tikztosvgPng: "tikztosvg-png/mismatch.png",
          tikzkitPngStatus: "rendered",
          tikztosvgPngStatus: "rendered"
        }
      ]
    })}\n`,
    "utf8"
  );

  const summary = await compareExamplePngs({ outputRoot });

  assert.equal(summary.total, 3);
  assert.equal(summary.compared, 3);
  assert.equal(summary.different, 2);
  assert.equal(summary.cases[0].status, "same");
  assert.equal(summary.cases[0].changedPixels, 0);
  assert.equal(summary.cases[1].status, "different");
  assert.equal(summary.cases[1].changedPixels, 1);
  assert.equal(summary.cases[1].changedRatio, 0.5);
  assert.equal(summary.cases[1].diffPng.endsWith("different.png"), true);
  assert.equal(summary.cases[1].sheetPng, "diff/different-sheet.png");
  assert.equal(summary.cases[1].nativeSheetPng, "diff/different-native-sheet.png");
  assert.equal(summary.cases[2].status, "dimension-mismatch");

  const writtenSummary = JSON.parse(await readFile(path.join(outputRoot, "diff", "summary.json"), "utf8"));
  const diffPng = await readFile(path.join(outputRoot, "diff-png", "different.png"));
  const sheetPng = decodePng(await readFile(path.join(outputRoot, "diff", "different-sheet.png")));
  const nativeSheetPng = decodePng(await readFile(path.join(outputRoot, "diff", "different-native-sheet.png")));
  assert.equal(writtenSummary.cases.length, 3);
  assert.equal(writtenSummary.cases[1].sheetPng, "diff/different-sheet.png");
  assert.equal(diffPng.subarray(1, 4).toString("ascii"), "PNG");
  assert.ok(sheetPng.width > 6);
  assert.ok(sheetPng.height >= 1);
  assert.ok(nativeSheetPng.width > sheetPng.width / 2);
  assert.ok(nativeSheetPng.height > sheetPng.height);
});

test("example PNG diff summary text reports compared and changed case counts", () => {
  const text = formatExampleDiffSummary({
    total: 3,
    compared: 2,
    different: 1,
    missing: 1,
    outputRoot: "/tmp/out"
  });

  assert.match(text, /Compared 2\/3 example PNG pairs/);
  assert.match(text, /1 different/);
  assert.match(text, /1 missing/);
});

test("example PNG diff removes stale diff artifacts before writing the new report", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-diff-"));
  await mkdir(path.join(outputRoot, "diff"), { recursive: true });
  await mkdir(path.join(outputRoot, "diff-png"), { recursive: true });
  await writeFile(path.join(outputRoot, "diff", "stale-sheet.png"), "old", "utf8");
  await writeFile(path.join(outputRoot, "diff-png", "stale.png"), "old", "utf8");
  await writeFixturePng(path.join(outputRoot, "tikzkit-png", "fresh.png"), [[0, 0, 0, 255]]);
  await writeFixturePng(path.join(outputRoot, "tikztosvg-png", "fresh.png"), [[0, 0, 0, 255]]);
  await writeFile(
    path.join(outputRoot, "summary.json"),
    `${JSON.stringify({
      cases: [
        {
          id: "fresh",
          tikzkitPng: "tikzkit-png/fresh.png",
          tikztosvgPng: "tikztosvg-png/fresh.png",
          tikzkitPngStatus: "rendered",
          tikztosvgPngStatus: "rendered"
        }
      ]
    })}\n`,
    "utf8"
  );

  await compareExamplePngs({ outputRoot });

  await assert.rejects(readFile(path.join(outputRoot, "diff", "stale-sheet.png")), /ENOENT/);
  await assert.rejects(readFile(path.join(outputRoot, "diff-png", "stale.png")), /ENOENT/);
  assert.match(await readFile(path.join(outputRoot, "diff", "summary.json"), "utf8"), /fresh/);
});

test("example PNG diff treats antialias noise as visually same", () => {
  const width = 400;
  const height = 1;
  const actual = solidImage(width, height, [255, 255, 255, 255]);
  const expected = solidImage(width, height, [255, 255, 255, 255]);

  // Typical rasterizer antialiasing drift: same geometry, channel values differ by <= 6.
  actual.data.set([147, 147, 147, 255], 0);
  expected.data.set([153, 153, 153, 255], 0);

  // A tiny number of stronger edge pixels should not fail the visual comparison.
  actual.data.set([54, 54, 54, 255], 4);
  expected.data.set([93, 93, 93, 255], 4);

  const comparison = compareDecodedPngs(actual, expected);

  assert.equal(comparison.status, "same");
  assert.equal(comparison.changedPixels, 1);
  assert.ok(comparison.changedRatio < 0.005);
});

test("registered comparison reports a small uniform raster shift without overwriting raw diff data", () => {
  const actual = solidImage(7, 5, [255, 255, 255, 255]);
  const expected = solidImage(7, 5, [255, 255, 255, 255]);
  setPixel(actual, 7, 2, 2, [0, 0, 0, 255]);
  setPixel(expected, 7, 3, 2, [0, 0, 0, 255]);

  const raw = compareDecodedPngs(actual, expected);
  const registered = findBestPixelAlignment(actual, expected, { radius: 2, sampleStep: 1 });

  assert.equal(raw.changedPixels, 2);
  assert.equal(registered.offsetX, 1);
  assert.equal(registered.offsetY, 0);
  assert.equal(registered.changedPixels, 0);
  assert.equal(registered.status, "same");
});

test("registered comparison retains the raw position when a sampled shift worsens a full diff metric", () => {
  const actual = solidImage(7, 5, [255, 255, 255, 255]);
  const expected = solidImage(7, 5, [255, 255, 255, 255]);
  setPixel(actual, 7, 0, 0, [0, 0, 0, 255]);
  setPixel(expected, 7, 0, 0, [0, 0, 0, 255]);
  setPixel(actual, 7, 2, 2, [0, 0, 0, 255]);
  setPixel(expected, 7, 3, 2, [0, 0, 0, 255]);

  const raw = compareDecodedPngs(actual, expected);
  const registered = findBestPixelAlignment(actual, expected, { radius: 2, sampleStep: 1 });

  assert.ok(registered.meanAbsoluteRGBA <= raw.meanAbsoluteRGBA);
  assert.ok(registered.changedRatio <= raw.changedRatio);
});

function solidImage(width, height, pixel) {
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    Buffer.from(pixel).copy(data, index * 4);
  }
  return { width, height, data };
}

function setPixel(image, width, x, y, pixel) {
  Buffer.from(pixel).copy(image.data, (y * width + x) * 4);
}

async function writeFixturePng(filePath, pixels) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const width = pixels.length;
  const height = 1;
  const scanline = Buffer.alloc(1 + width * 4);
  scanline[0] = 0;
  pixels.forEach((pixel, index) => {
    Buffer.from(pixel).copy(scanline, 1 + index * 4);
  });

  const chunks = [
    pngChunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(scanline)),
    pngChunk("IEND", Buffer.alloc(0))
  ];
  await writeFile(filePath, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]));
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(Buffer.concat([typeBuffer, data])) >>> 0)]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
