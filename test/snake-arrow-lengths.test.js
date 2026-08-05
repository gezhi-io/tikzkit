import assert from "node:assert/strict";
import test from "node:test";

import { parseTikz } from "../src/frontend/parser.js";
import { interpretTikz } from "../src/engine/evaluate.js";
import { lineWidthFromPt, stealthArrowLengthFromLineWidth, stealthArrowShortenFromLength } from "../src/tikz/metrics.js";
import { parseDimension } from "../src/math.js";
import { TIKZ_UNIT } from "../src/tikz/metrics.js";

function expectClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to equal ${expected} within ${tolerance}`);
}

test("keeps explicit snake end lengths separate from the attached stealth arrow", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (hs1) at (0,0);
  \coordinate (s1) at (4,0);
  \draw[-stealth, decoration={snake, pre length=0.01mm, segment length=2mm, amplitude=0.3mm, post length=1.5mm}, decorate, thick, red]
    (hs1) -- (s1);
\end{tikzpicture}`;
  const { ast, diagnostics: parseDiagnostics } = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(ast);
  const path = ir.items.find((item) => item.type === "path");
  const visiblePost = parseDimension("1.5mm");
  const stealthShorten = stealthArrowShortenFromLength(stealthArrowLengthFromLineWidth(lineWidthFromPt(0.8))) / TIKZ_UNIT;

  assert.deepEqual([...parseDiagnostics, ...diagnostics], []);
  assert.ok(path);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.equal(path.commands.at(-1).type, "lineTo");
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 4, y: 0 });
  expectClose(path.commands.at(-2).x, 4 - visiblePost - stealthShorten, 1e-6);
  assert.ok(path.commands.some((command) => command.type === "curveTo"), "snake must retain wave segments");
});
