import test from "node:test";
import assert from "node:assert/strict";
import { CSS_PIXELS_PER_CM, inferSvgGridOrigin, inferSvgGridStep, parseViewBoxWidth, svgPhysicalWidthPx } from "../web/svg-display-scale.js";
import { createPhysicalScaleSheetSvg, createPhysicalScaleSvg } from "../web/physical-scale-sheet.js";

test("parses SVG viewBox width", () => {
  assert.equal(parseViewBoxWidth("-275.1 -363.2 1337.6 466.6"), 1337.6);
  assert.equal(parseViewBoxWidth("0,0,371.28,125.49"), 371.28);
  assert.equal(parseViewBoxWidth("bad"), null);
});

test("normalizes TikZKit and tikztosvg grid display to the same CSS cm", () => {
  const jsWidth = svgPhysicalWidthPx(1337.615239, 100);
  const nativeWidth = svgPhysicalWidthPx(371.28, 72 / 2.54);

  assert.ok(jsWidth && nativeWidth);
  assert.equal(Number((jsWidth / (1337.615239 / 100)).toFixed(6)), Number(CSS_PIXELS_PER_CM.toFixed(6)));
  assert.equal(Number((nativeWidth / (371.28 / (72 / 2.54))).toFixed(6)), Number(CSS_PIXELS_PER_CM.toFixed(6)));
});

test("infers physical grid step from pattern and source-grid paths", () => {
  const patternSvg = `<svg viewBox="0 0 200 100"><defs><pattern id="case-js-grid" width="100" height="100"></pattern></defs></svg>`;
  const tikzkitSourceGrid = `<svg><path stroke-dasharray="2 2" d="M -5000 5000 L -5000 -5000"/><path stroke-dasharray="2 2" d="M -4900 5000 L -4900 -5000"/></svg>`;
  const nativeSourceGrid = `<svg><path stroke-dasharray="0.7 0.7" d="M -1417.338 -1417.342 L 1417.341 -1417.342 M -1417.338 -1388.994 L 1417.341 -1388.994 M -1417.338 -1360.647 L 1417.341 -1360.647"/></svg>`;

  assert.equal(inferSvgGridStep(patternSvg), 100);
  assert.equal(inferSvgGridStep(tikzkitSourceGrid), 100);
  assert.ok(Math.abs(inferSvgGridStep(nativeSourceGrid) - 28.3475) < 0.01);
});

test("creates physical-scale sheets that display different SVG units as the same centimeters", () => {
  const jsSvg = `<svg viewBox="0 0 200 100"><path stroke-dasharray="2 2" d="M 0 0 L 0 100 M 100 0 L 100 100 M 200 0 L 200 100"/></svg>`;
  const nativeSvg = `<svg viewBox="0 0 56.69 28.345"><path stroke-dasharray="0.7 0.7" d="M 0 0 L 0 28.345 M 28.345 0 L 28.345 28.345 M 56.69 0 L 56.69 28.345"/></svg>`;

  const sheet = createPhysicalScaleSheetSvg([
    { title: "TikZKit", svg: jsSvg },
    { title: "tikztosvg", svg: nativeSvg }
  ], { pixelsPerCm: 86 });

  assert.match(sheet, /<svg[^>]+width="252"/);
  assert.match(sheet, /<svg[^>]+width="172"/);
  assert.equal([...sheet.matchAll(/<svg x="40" y="\d+" width="172" height="86"/g)].length, 2);
});

test("physical-scale sheets align TikZ coordinate origins across JS and tikztosvg panes", () => {
  const jsSvg = `<svg viewBox="-90 -60 200 120"><defs><pattern id="js-grid" x="0" y="0" width="100" height="100"></pattern></defs></svg>`;
  const nativeSvg = `<svg viewBox="0 0 56.69 42.5175"><path stroke-dasharray="0.7 0.7" d="M -28.345 -28.345 L 28.345 -28.345 M -28.345 0 L 28.345 0 M -28.345 28.345 L 28.345 28.345 M -28.345 -28.345 L -28.345 28.345 M 0 -28.345 L 0 28.345 M 28.345 -28.345 L 28.345 28.345" transform="matrix(1, 0, 0, 1, 28.345, 28.345)"/></svg>`;

  const sheet = createPhysicalScaleSheetSvg([
    { title: "TikZKit", svg: jsSvg },
    { title: "tikztosvg", svg: nativeSvg }
  ], { pixelsPerCm: 100 });
  const innerSvgs = [...sheet.matchAll(/<svg x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" viewBox=/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4])
  }));

  assert.deepEqual(inferSvgGridOrigin(jsSvg), { x: 0, y: 0 });
  assert.deepEqual(inferSvgGridOrigin(nativeSvg), { x: 28.345, y: 28.345 });
  assert.equal(innerSvgs.length, 2);
  assert.equal(innerSvgs[0].x, 50, "expected JS pane to be shifted right so x=0 aligns with native x=0");
  assert.equal(innerSvgs[1].x, 40, "expected native pane to keep the base sheet padding");
  assert.equal(innerSvgs[0].y, 116, "expected JS pane to be shifted down so y=0 aligns with native y=0");
  assert.equal(innerSvgs[1].y, 300, "expected native pane to keep its row baseline after the aligned JS pane height");
});

test("creates single physical-scale SVG wrappers for normalized PNG diff inputs", () => {
  const nativeSvg = `<svg viewBox="0 0 56.69 28.345"><path stroke-dasharray="0.7 0.7" d="M 0 0 L 0 28.345 M 28.345 0 L 28.345 28.345 M 56.69 0 L 56.69 28.345"/></svg>`;

  const normalized = createPhysicalScaleSvg({ title: "tikztosvg", svg: nativeSvg }, { pixelsPerCm: 86 });

  assert.match(normalized, /<svg[^>]+width="172" height="86" viewBox="0 0 172 86"/);
  assert.match(normalized, /<svg x="0" y="0" width="172" height="86" viewBox="0 0 56.69 28.345"/);
});

test("physical-scale sheet preserves tikztosvg xlink references", () => {
  const svg = `<svg viewBox="0 0 100 100"><path stroke-dasharray="2 2" d="M 0 0 L 0 100 M 100 0 L 100 100"/><defs><path id="glyph" d="M0 0"/></defs><use xlink:href="#glyph"/></svg>`;
  const sheet = createPhysicalScaleSheetSvg([{ title: "tikztosvg", svg }], { pixelsPerCm: 86 });

  assert.match(sheet, /xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/);
  assert.match(sheet, /xlink:href="#glyph"/);
});
