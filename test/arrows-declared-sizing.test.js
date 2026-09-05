import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lowerDeclaredArrowTips, resolveDeclaredArrowGeometry } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/arrows/", import.meta.url);

function source(name) {
  return readFileSync(new URL(name, FIXTURE_ROOT), "utf8");
}

function declaredPayload(input) {
  const lowered = lowerDeclaredArrowTips(input);
  const match = lowered.match(/tikzkit declared arrow=([0-9a-f]+)/i);
  assert.ok(match, "expected a lowered declared-arrow payload");
  const encoded = match[1].match(/../g).map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join("");
  return JSON.parse(decodeURIComponent(encoded));
}

test("evaluates declared-arrow dimension registers against the active line width", () => {
  const declaration = declaredPayload(source("declared-sizing-flowchart.tex"));
  const thin = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(0.4));
  const thick = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(1.6));
  const unitsPerPt = lineWidthFromPt(1);

  assert.ok(Math.abs(thin.backEnd / unitsPerPt + 1.6) < 1e-9);
  assert.ok(Math.abs(thin.tipEnd / unitsPerPt - 2.4) < 1e-9);
  assert.ok(Math.abs(thick.backEnd / unitsPerPt + 3.04) < 1e-9);
  assert.ok(Math.abs(thick.tipEnd / unitsPerPt - 4.56) < 1e-9);
  assert.ok(thick.bounds.maxY - thick.bounds.minY > thin.bounds.maxY - thin.bounds.minY);
  assert.notEqual(thin.path, thick.path);
});

test("supports a second dimension register and declared cap/join paint semantics", () => {
  const declaration = declaredPayload(source("declared-sizing-math.tex"));
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(1));
  const unitsPerPt = lineWidthFromPt(1);

  assert.equal(geometry.paint, "stroke");
  assert.equal(geometry.lineCap, "butt");
  assert.equal(geometry.lineJoin, "miter");
  assert.ok(Math.abs(geometry.backEnd / unitsPerPt + 0.5) < 1e-9);
  assert.ok(Math.abs(geometry.tipEnd / unitsPerPt - 5.207) < 1e-9);
  assert.match(geometry.path, /^M .* L .* L .* Z$/u);
});

test("separates consecutive dimension-register assignments on one line", () => {
  const declaration = declaredPayload(String.raw`\pgfarrowsdeclare{compact}{compact}{
    \pgfutil@tempdima=.5pt \pgfutil@tempdimb=2\pgfutil@tempdima
    \pgfarrowsleftextend{-\pgfutil@tempdima}
    \pgfarrowsrightextend{\pgfutil@tempdimb}
  }{
    \pgfutil@tempdima=.5pt \pgfutil@tempdimb=2\pgfutil@tempdima
    \pgfpathmoveto{\pgfqpoint{0pt}{-\pgfutil@tempdima}}
    \pgfpathlineto{\pgfqpoint{\pgfutil@tempdimb}{0pt}}
    \pgfpathlineto{\pgfqpoint{0pt}{\pgfutil@tempdima}}
    \pgfpathclose
    \pgfusepathqfill
  }
  \draw[-{compact}] (0,0) -- (1,0);`);
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(0.4));
  const unitsPerPt = lineWidthFromPt(1);

  assert.ok(Math.abs(geometry.backEnd / unitsPerPt + 0.5) < 1e-9);
  assert.ok(Math.abs(geometry.tipEnd / unitsPerPt - 1) < 1e-9);
  assert.match(geometry.path, /^M .* L .* L .* Z$/u);
});

test("renders line-width-aware declared arrow geometry in all three domain fixtures", () => {
  for (const fixture of ["declared-sizing-flowchart.tex", "declared-sizing-math.tex", "declared-sizing-physics.tex"]) {
    const result = tikzToSvg(source(fixture), { mathRenderer: "svg-text" });
    assert.deepEqual(result.diagnostics, [], fixture);
    assert.equal((result.svg.match(/class="tikz-arrow-tip/g) || []).length, 3, fixture);
  }
});

test("passes the active path line width into the declared-arrow renderer", () => {
  const declaration = declaredPayload(source("declared-sizing-physics.tex"));
  const thin = resolveInlineArrowTip({ kind: "adaptive force", declaredArrow: declaration }, {
    stroke: "blue",
    lineWidth: lineWidthFromPt(0.4)
  });
  const thick = resolveInlineArrowTip({ kind: "adaptive force", declaredArrow: declaration }, {
    stroke: "blue",
    lineWidth: lineWidthFromPt(1.6)
  });

  assert.equal(thin.fill, "blue");
  assert.equal(thin.stroke, "blue");
  assert.equal(thin.lineCap, "butt");
  assert.equal(thin.lineJoin, "miter");
  assert.notEqual(thin.geometry.path, thick.geometry.path);
  assert.ok(thick.geometry.shorten > thin.geometry.shorten);
});
