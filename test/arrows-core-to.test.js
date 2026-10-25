import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip, resolveInlineArrowTipSequence, placeResolvedInlineArrowTips, pathTerminalSegments, shortenPathTerminals } from "../src/renderers/svg/paths.js";
import { curvedArrowPaint, pgfCurvilinearTime } from "../src/renderers/svg/arrowBending.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);

test("core to uses the native Bezier controls and 80 percent pen at each line width", () => {
  for (const width of [.2, .4, .8, 1.2, 2]) {
    const tip = resolveInlineArrowTip("to", { lineWidth: lineWidthFromPt(width) });
    const d = lineWidthFromPt(.28 + .3 * width);
    const values = tip.geometry.path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const expected = [-3, -4, -2.75, -2.5, 0, -.25, .75, 0, 0, .25, -2.75, 2.5, -3, 4];
    assert.equal(values.length, expected.length);
    values.forEach((value, i) => close(value, expected[i] * d));
    close(tip.strokeWidth, lineWidthFromPt(.8 * width));
    close(tip.geometry.placement, lineWidthFromPt(.21 + .625 * width));
    close(tip.geometry.terminalPlacement, tip.geometry.placement);
    close(tip.assemblyLength, lineWidthFromPt(1.05 + 1.925 * width));
    assert.equal(tip.fill, "none");
    assert.equal(tip.lineCap, "round");
    assert.equal(tip.lineJoin, "round");
  }
});

test("core to reversed has its own native setup and asymmetric source curve", () => {
  const tip = resolveInlineArrowTip("to reversed", { lineWidth: lineWidthFromPt(1) });
  assert.equal(tip.kind, "to-reversed");
  const values = tip.geometry.path.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const expected = [3.5, -4, 3.25, -2.5, .5, -.25, -.25, 0, .5, .25, 3.25, 2.5, 3.5, 4];
  values.forEach((value, i) => close(value, expected[i] * lineWidthFromPt(.58)));
  close(tip.geometry.placement, lineWidthFromPt(2.43));
  close(tip.assemblyLength, lineWidthFromPt(3.115));
});

test("to sequences use native tip ends and back ends in both directions", () => {
  const result = tikzToSvg(String.raw`\usetikzlibrary{arrows.meta}
    \draw[line width=1pt,{>[sep=1pt]>[sep=2pt]}-{>[sep=1pt]>[sep=2pt]>}] (0,0)--(3,0);`);
  assert.deepEqual(result.diagnostics, []);
  const style = result.ir.items.find(item => item.type === "path").style;
  for (const side of ["start", "end"]) {
    const tips = resolveInlineArrowTipSequence(side === "start" ? style.markerStart : style.markerEnd, style, side);
    const placements = placeResolvedInlineArrowTips(tips, { x: 0, y: 0 }, 1, 0);
    const xs = placements.map(p => p.point.x / lineWidthFromPt(1));
    const expected = side === "start" ? [10.1, 4.3] : [11.1, 6.3, .5];
    xs.forEach((x, i) => close(x, expected[i]));
  }
});

test("legacy to ignores meta-only sizing keys and does not invent a picture hull", () => {
  const style = { lineWidth: lineWidthFromPt(.8) };
  const plain = resolveInlineArrowTip("to", style);
  const result = tikzToSvg(String.raw`\usetikzlibrary{arrows.meta}\draw[thick,-{to[scale=3,length=12pt,width=10pt]}] (0,0)--(2,0);`);
  assert.deepEqual(result.diagnostics, []);
  const path = result.ir.items.find(item => item.type === "path");
  const scaled = resolveInlineArrowTip(path.style.markerEnd, path.style);
  assert.equal(scaled.geometry.path, plain.geometry.path);
  // pgfcorearrows caches legacy paint with picture-size tracking disabled.
  assert.equal(plain.geometry.includeBounds, false);
});

test("To aliases depend on the loaded library, but lower-case to stays classical", () => {
  for (const modern of [false, true]) {
    const source = `${modern ? String.raw`\usetikzlibrary{arrows.meta}` : ""}${String.raw`\draw[->](0,0)--(1,0);\draw[-to](0,1)--(1,1);`}`;
    const paths = tikzToSvg(source).ir.items.filter(item => item.type === "path");
    assert.equal(paths[0].style.markerEnd.legacy, !modern);
    assert.equal(paths[1].style.markerEnd.legacy, true);
  }
});

test("bending alone retains the core To alias", () => {
  const result = tikzToSvg(String.raw`\usetikzlibrary{bending}\draw[->] (0,0)--(2,0);`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.find(item => item.type === "path").style.markerEnd.legacy, true);
});

test("packages that import arrows.meta select the modern To alias", () => {
  for (const pkg of ["tikz-cd", "circuitikz", "tkz-euclide", "tkz-base", "tkz-fct"]) {
    const result = tikzToSvg(`\\usepackage{${pkg}}\\begin{tikzpicture}\\draw[->](0,0)--(1,0);\\end{tikzpicture}`);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.ir.items.find(item => item.type === "path").style.markerEnd.legacy, false, pkg);
  }
});

test("modern To slant transforms the stroke with the curve", () => {
  const source = String.raw`\usetikzlibrary{arrows.meta}\draw[-{To[slant=.5,scale length=2,scale width=.8]},line width=1pt] (0,0)--(4,0);`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const arrow = result.svg.match(/<path class="tikz-arrow-tip tikz-arrow-to"[^>]*>/)?.[0];
  assert.ok(arrow);
  assert.match(arrow, /matrix\(1 0 -0\.5 1 0 0\)/);
});

test("curvilinear distance uses the native four-point table in physical TeX points", () => {
  const curve = [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 0 }];
  const cmPerPt = 2.54 / 72.27;
  // MacTeX output from fixtures/arrow-curvilinear-metrics.tex.
  // The far sample deliberately differs from a true arc-length midpoint.
  const samples = [[-cmPerPt, -.0039], [cmPerPt, .00392], [3 * cmPerPt, .01186], [10 * cmPerPt, .04028], [3, .34384]];
  for (const [distance, expected] of samples) {
    const actual = pgfCurvilinearTime(curve, distance);
    assert.ok(Math.abs(actual - expected) < .0003, `${distance}: ${actual} != ${expected}`);
    close(pgfCurvilinearTime(curve.map(p => ({ x: p.x * 100, y: p.y * 100 })), distance * 100, cmPerPt * 100), actual);
  }
});

test("precise arrow shortening retains the original cubic rather than moving only its end", () => {
  const commands = [{ type: "moveTo", x: 0, y: 0 },
    { type: "curveTo", x1: 0, y1: 3, x2: 3, y2: 3, x: 3, y: 0 }];
  for (const [distance, t] of [[2.54 / 72.27, .00392], [-2.54 / 72.27, -.0039]]) {
    for (const side of ["start", "end"]) {
      const trimmed = shortenPathTerminals(commands, pathTerminalSegments(commands),
        side === "start" ? distance : 0, side === "end" ? distance : 0, { [side]: true });
      const x = 9 * t * t - 6 * t * t * t;
      const y = 9 * t * (1 - t);
      const expected = side === "end" ? [0, 0, 0, 3 * (1 - t), 3 * (1 - t) ** 2, 3 * (1 - t * t), 3 - x, y]
        : [x, y, 6 * t - 3 * t * t, 3 * (1 - t * t), 3, 3 * (1 - t), 3, 0];
      const [start, end] = trimmed;
      [start.x, start.y, end.x1, end.y1, end.x2, end.y2, end.x, end.y]
        .forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < .0002, `${side}: ${value} != ${expected[i]}`));
    }
  }
});

test("modern round To flex uses its zero visual span and terminal tangent", () => {
  const tip = resolveInlineArrowTip({ kind: "to", legacy: false, bending: { mode: "flex", factor: 1 } }, { lineWidth: 1 });
  const terminal = pathTerminalSegments([{ type: "moveTo", x: 0, y: 0 },
    { type: "curveTo", x1: 0, y1: 3, x2: 3, y2: 3, x: 3, y: 0 }]).last;
  const paint = curvedArrowPaint(tip, { curveDistance: 0 }, terminal, "end", 100);
  close(paint.transform.a, 0);
  close(paint.transform.b, 1);
});
