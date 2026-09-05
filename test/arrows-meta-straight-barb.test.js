import assert from "node:assert/strict";
import test from "node:test";
import { parseArrowTipSpec } from "../src/engine/options.js";
import { curvedArrowPaint } from "../src/renderers/svg/arrowBending.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { tikzToSvg } from "../src/index.js";
import { createArrowTip, lineWidthFromPt } from "../src/tikz-metrics.js";
import { formatSvgNumber } from "../src/renderers/svg/format.js";

const unitsPerPt = lineWidthFromPt(1);

function inPt(value) {
  return Number(value) / unitsPerPt;
}

function close(actual, expected, label, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

test("uses the PGF Straight Barb defaults and exact miter shortening", () => {
  const tip = resolveInlineArrowTip(parseArrowTipSpec("Straight Barb"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4)
  });
  const geometry = tip.geometry;

  close(inPt(geometry.length), 2.3, "length");
  close(inPt(geometry.width), 4.6, "width");
  close(inPt(geometry.lineWidth), 0.4, "tip line width");
  close(inPt(geometry.tipEnd), 2.582842712475, "tip end");
  close(inPt(geometry.backEnd), -0.2, "back end");
  close(inPt(geometry.lineEnd), 2.1, "line end");
  close(inPt(geometry.terminalPlacement), 0.482842712475, "shaft shortening");
  close(inPt(geometry.assemblyLength), 2.782842712475, "assembly length");
  assert.equal(tip.lineCap, "butt");
  assert.equal(tip.lineJoin, "miter");
  assert.equal(tip.strokeWidth, lineWidthFromPt(0.4));
  assert.equal(
    geometry.path,
    `M 0 ${formatSvgNumber(-lineWidthFromPt(2.3))} L ${formatSvgNumber(lineWidthFromPt(2.3))} 0 L 0 ${formatSvgNumber(lineWidthFromPt(2.3))}`
  );
});

test("applies Straight Barb custom dimensions and round cap/join locally", () => {
  const tip = resolveInlineArrowTip(
    parseArrowTipSpec("Straight Barb[length=5pt,width=6pt,line width=2pt,round]"),
    { stroke: "blue", lineWidth: lineWidthFromPt(0.4) }
  );

  close(inPt(tip.geometry.length), 5, "custom length");
  close(inPt(tip.geometry.width), 6, "custom width");
  close(inPt(tip.geometry.lineWidth), 2, "custom line width");
  close(inPt(tip.geometry.tipEnd), 6, "round tip end");
  close(inPt(tip.geometry.terminalPlacement), 2, "round shortening");
  close(inPt(tip.geometry.assemblyLength), 7, "round assembly length");
  assert.equal(tip.lineCap, "round");
  assert.equal(tip.lineJoin, "round");
  close(inPt(tip.strokeWidth), 2, "painted stroke width");
});

test("reflects and swaps a reversed right Straight Barb harpoon", () => {
  const tip = resolveInlineArrowTip(
    parseArrowTipSpec("Straight Barb[harpoon,reversed,right,length=.2cm,line width=.8pt,sharp]"),
    { stroke: "blue", lineWidth: lineWidthFromPt(0.4) }
  );
  const lengthPt = 0.2 * 28.4527559;
  const miterPt = 0.5 * Math.SQRT2 * 0.8;

  close(inPt(tip.geometry.length), lengthPt, "reversed harpoon length");
  close(inPt(tip.geometry.tipEnd), 0.4, "reversed tip end");
  close(inPt(tip.geometry.backEnd), -(lengthPt + miterPt + 0.4), "reversed back end");
  close(inPt(tip.geometry.lineEnd), -(lengthPt + 0.4), "reversed line end");
  close(inPt(tip.geometry.terminalPlacement), lengthPt + 0.8, "reversed harpoon shortening");
  assert.equal(tip.lineCap, "butt");
  assert.equal(tip.lineJoin, "miter");
  assert.match(tip.geometry.path, /^M 0 [\d.]+ L -[\d.]+ 0 L -[\d.]+ 0$/);
});

test("resolves dependent dimensions before applying Straight Barb slant", () => {
  const tip = resolveInlineArrowTip(
    parseArrowTipSpec("Straight Barb[length=+1pt 3,width'=+0pt 1.5,line width=+0pt .5,left,slant=.25]"),
    { stroke: "black", lineWidth: lineWidthFromPt(0.8) }
  );
  const geometry = tip.geometry;

  close(inPt(geometry.length), 3.4, "dependent length");
  close(inPt(geometry.width), 5.1, "length-dependent width");
  close(inPt(geometry.lineWidth), 0.4, "line-width-dependent tip stroke");
  close(inPt(geometry.tipEnd), 4, "harpoon tip end");
  close(inPt(geometry.terminalPlacement), 0.8, "harpoon shaft shortening");
  close(inPt(geometry.points[0].x), 0.6375, "slanted upper point x");
  close(inPt(geometry.points[0].y), 2.55, "slanted upper point y");
  close(inPt(geometry.points[2].x), 3, "harpoon back point");
  close(inPt(geometry.points[2].y), 0, "harpoon back baseline");
  assert.equal(geometry.harpoon, true);
  assert.equal(geometry.swap, false);
  assert.equal(geometry.slant, 0.25);
});

test("uses PGF's full outer width when Straight Barb terminates a double line", () => {
  const tip = resolveInlineArrowTip(parseArrowTipSpec("Straight Barb"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4),
    doubleColor: "white",
    doubleDistance: lineWidthFromPt(0.6)
  });

  close(inPt(tip.geometry.length), 4.3, "double-line-dependent length");
  close(inPt(tip.geometry.width), 8.6, "double-line-dependent width");
  close(inPt(tip.geometry.lineWidth), 0.4, "outer-factor-adjusted tip stroke");
});

test("honors direct programmatic Straight Barb dimensions", () => {
  const tip = resolveInlineArrowTip(createArrowTip("Straight Barb", {
    length: lineWidthFromPt(9),
    width: lineWidthFromPt(7),
    lineWidth: lineWidthFromPt(1.1),
    customLength: true,
    customWidth: true,
    customLineWidth: true
  }), { stroke: "black", lineWidth: lineWidthFromPt(0.4) });

  close(inPt(tip.geometry.length), 9, "programmatic length");
  close(inPt(tip.geometry.width), 7, "programmatic width");
  close(inPt(tip.geometry.lineWidth), 1.1, "programmatic line width");
});

test("keeps width-prime local to Straight Barb dimension resolution", () => {
  const parsed = parseArrowTipSpec("Stealth[width'=+0pt 2]");
  const baseline = resolveInlineArrowTip(parseArrowTipSpec("Stealth"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4)
  });
  const withWidthPrime = resolveInlineArrowTip(parsed, {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4)
  });

  assert.equal(parsed.customWidth, undefined);
  close(withWidthPrime.geometry.bounds.minY, baseline.geometry.bounds.minY, "Stealth lower extent");
  close(withWidthPrime.geometry.bounds.maxY, baseline.geometry.bounds.maxY, "Stealth upper extent");
});

test("records the visual endpoints exchanged by PGF reversal", () => {
  const style = { stroke: "black", lineWidth: lineWidthFromPt(0.4) };
  const forward = resolveInlineArrowTip(parseArrowTipSpec("Straight Barb"), style).geometry;
  const reversed = resolveInlineArrowTip(parseArrowTipSpec("Straight Barb[reversed]"), style).geometry;

  close(forward.visualTipEnd, forward.tipEnd, "forward visual tip end");
  close(inPt(forward.visualBackEnd), 2.5, "forward visual back end");
  close(forward.visualSpan, forward.visualTipEnd - forward.visualBackEnd, "forward visual span");
  close(inPt(reversed.visualTipEnd), -2.5, "reversed visual tip end");
  close(reversed.visualBackEnd, -forward.visualTipEnd, "reversed visual back end");
  close(reversed.visualSpan, forward.visualSpan, "reversed visual span");
});

test("maps asymmetric Straight Barb hull bounds into TikZ's normal direction", () => {
  const style = {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4),
    markerEnd: parseArrowTipSpec("Straight Barb[left,length=8pt,width=8pt]")
  };
  const bounds = computeSvgBounds([{
    type: "path",
    commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 1, y: 0 }],
    style
  }], { unit: 100 });

  assert.ok(bounds.maxY > -bounds.minY * 3, `expected left harpoon above its shaft, got ${JSON.stringify(bounds)}`);
});

test("does not pad an exact standalone Straight Barb hull twice", () => {
  const style = { stroke: "black", lineWidth: lineWidthFromPt(0.4) };
  const parsed = parseArrowTipSpec("Straight Barb[left,length=8pt,width=8pt]");
  const geometry = resolveInlineArrowTip(parsed, style).geometry;
  const bounds = computeSvgBounds([{ type: "marker", x: 0, y: 0, angle: 0, tip: parsed, style }], { unit: 100 });

  close(bounds.maxX - bounds.minX, (geometry.bounds.maxX - geometry.bounds.minX) / 100, "standalone width");
  close(bounds.maxY - bounds.minY, (geometry.bounds.maxY - geometry.bounds.minY) / 100, "standalone height");
});

test("marks rigid curved Straight Barb hulls as already stroke-inclusive", () => {
  const style = { stroke: "black", lineWidth: lineWidthFromPt(0.4) };
  const flex = resolveInlineArrowTip(parseArrowTipSpec("Straight Barb[flex]"), style);
  const bend = resolveInlineArrowTip(parseArrowTipSpec("Straight Barb[bend]"), style);
  const terminal = {
    start: { x: 0, y: 0 },
    startControl: { x: 0.6, y: 0.8 },
    endControl: { x: 1.4, y: 0.8 },
    end: { x: 2, y: 0 }
  };

  assert.equal(curvedArrowPaint(flex, { curveDistance: 0 }, terminal, "end", 100)?.strokeBoundsIncluded, true);
  assert.equal(curvedArrowPaint(bend, { curveDistance: 0 }, terminal, "end", 100)?.strokeBoundsIncluded, false);
});

test("renders the CircuitikZ block-definition Straight Barb pair without diagnostics", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,positioning}
\tikzset{blockdef/.style={{Straight Barb[harpoon,reversed,right,length=0.2cm]}-{Straight Barb[harpoon,reversed,left,length=0.2cm]},blue}}
\begin{tikzpicture}
  \node[draw] (input) at (0,0) {input};
  \node[draw,right=3cm of input] (output) {output};
  \draw[->] (input) -- (output);
  \draw[blockdef] (input.south west) ++(0,-.7) -- node[midway,fill=white]{amplifier block} (output.south east |- input.south west) ++(0,-.7);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const barbs = [...result.svg.matchAll(/class="tikz-arrow-tip tikz-arrow-straight-barb"/g)];
  assert.equal(barbs.length, 2);
});
