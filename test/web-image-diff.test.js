import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";

test("web image diff writes a diff PNG and machine-readable metrics", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tikzkit-diff-"));
  const a = path.join(dir, "a.png");
  const b = path.join(dir, "b.png");
  const diff = path.join(dir, "diff.png");

  await writeFile(a, png2x2([
    [255, 255, 255, 255],
    [0, 0, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 255, 255]
  ]));
  await writeFile(b, png2x2([
    [255, 255, 255, 255],
    [0, 0, 0, 255],
    [255, 0, 0, 255],
    [255, 255, 255, 255]
  ]));

  const result = spawnSync("python3", ["web/image-diff.py", a, b, diff], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const metrics = JSON.parse(result.stdout);
  assert.equal(metrics.width, 2);
  assert.equal(metrics.height, 2);
  assert.equal(metrics.totalPixels, 4);
  assert.equal(metrics.changedPixels, 1);
  assert.ok(metrics.changedRatio > 0.24 && metrics.changedRatio < 0.26);
  assert.ok(metrics.meanAbsoluteRgbaDiff > 0);
  assert.ok((await readFile(diff)).length > 50, "expected diff PNG to be written");
});

test("web image diff can align translated images before measuring changes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tikzkit-diff-align-"));
  const a = path.join(dir, "a.png");
  const b = path.join(dir, "b.png");
  const diff = path.join(dir, "diff.png");

  const white = [255, 255, 255, 255];
  const black = [0, 0, 0, 255];
  await writeFile(a, pngRgba(5, 3, [
    white, white, white, white, white,
    white, black, black, white, white,
    white, white, white, white, white
  ]));
  await writeFile(b, pngRgba(5, 3, [
    white, white, white, white, white,
    white, white, black, black, white,
    white, white, white, white, white
  ]));

  const result = spawnSync("python3", ["web/image-diff.py", a, b, diff, "--align-window", "2"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const metrics = JSON.parse(result.stdout);
  assert.equal(metrics.changedPixels, 0);
  assert.deepEqual(metrics.alignment, { dx: 1, dy: 0, window: 2, mode: "translation" });
  assert.ok((await readFile(diff)).length > 50, "expected aligned diff PNG to be written");
});

function png2x2(pixels) {
  return pngRgba(2, 2, pixels);
}

function pngRgba(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const ihdr = chunk("IHDR", header);
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(0);
    for (let x = 0; x < width; x += 1) {
      rows.push(...pixels[y * width + x]);
    }
  }
  const raw = Buffer.from(rows);
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
