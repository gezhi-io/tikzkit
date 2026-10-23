import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";

const pt = 72.27 / 2.54;
const fixture = name => readFileSync(new URL(`fixtures/pgfplots-label-box/${name}.tex`, import.meta.url), "utf8");
const close = (actual, expected, label, tolerance = 0.035) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${label}: ${actual}pt differs from MacTeX ${expected}pt`);
const label = (result, text) => result.ir.items.find(item => item.type === "textNode" && item.text === text);

test("explicit descriptions share native text metrics, alias fonts and shared styles", async () => {
  // Named-node anchors from pgfplots-label-box-metrics.tex, not fitted SVG offsets.
  for (const result of [tikzToSvg(fixture("description-shifts")), await tikzToSvgAsync(fixture("description-shifts"))]) {
    assert.deepEqual(result.diagnostics, []);
    const x = label(result, "office AV"), y = label(result, "gyp");
    close(x.x * pt, 45.67883, "xlabel x");
    close(x.y * pt, -18.70660, "xlabel y");
    close(y.x * pt, -23.02255, "ylabel x");
    close(y.y * pt, 56.90460, "ylabel y");
    assert.equal(x.font.sizePt, 9);
    assert.equal(y.font.sizePt, 12);
    assert.equal(x.style.fill, "red");
    assert.equal(y.style.fill, "blue");
    assert.equal(y.rotation, 90);
    assert.equal(x.style.textWidthScale, 1);
    assert.equal(y.style.textWidthScale, 1);
    assert.match(result.svg, /data-text-layout="cm-tex-box"/);
  }
});

test("explicit at changes location without discarding legacy absolute label shifts", () => {
  const result = tikzToSvg(fixture("description-absolute"));
  assert.deepEqual(result.diagnostics, []);
  const x = label(result, "office AV"), y = label(result, "gyp");
  close(x.x * pt, 42.67883, "absolute xlabel x");
  close(x.y * pt, -22.00519, "absolute xlabel y");
  close(y.x * pt, -58.73053, "absolute ylabel x");
  close(y.y * pt, 85.35690, "absolute ylabel y");
});

test("default boxed ticks use TeX box anchors without the fitted baseline offset", () => {
  const result = tikzToSvg(fixture("box-default"), { margin: 0 });
  assert.deepEqual(result.diagnostics, []);
  const zeros = result.ir.items.filter(item => item.type === "textNode" && item.text === "0");
  assert.equal(zeros.length, 2);
  close(zeros[0].y * pt, -6.75519, "x tick center");
  close(zeros[1].x * pt, -6.03297, "y tick center");
  // SVG pt is a PDF/CSS big point; the native probe reports TeX pt.
  const size = result.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
  close(Number(size[1]) * 72.27 / 72, 200.83267 + 11.86595, "canvas width", 0.06);
  close(Number(size[2]) * 72.27 / 72, 168.55013 + 13.31038, "canvas height", 0.06);
});

test("label translations compose with preceding default and explicit rotations", () => {
  const result = tikzToSvg(fixture("description-transform"));
  assert.deepEqual(result.diagnostics, []);
  const x = label(result, "office AV"), y = label(result, "gyp");
  close(x.x * pt, 45.67883, "transformed xlabel x");
  close(x.y * pt, -14.92268, "transformed xlabel y");
  close(y.x * pt, -25.73053, "transformed ylabel x");
  close(y.y * pt, 62.90460, "transformed ylabel y");
  assert.equal(x.rotation || 0, 0);
  assert.equal(y.rotation, 90);
});
