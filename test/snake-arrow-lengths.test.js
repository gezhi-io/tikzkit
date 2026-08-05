import assert from "node:assert/strict";
import test from "node:test";

import { parseTikz } from "../src/frontend/parser.js";
import { interpretTikz } from "../src/engine/evaluate.js";
import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";

function expectClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to equal ${expected} within ${tolerance}`);
}

test("keeps explicit snake end lengths independent from the attached stealth arrow", () => {
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

  assert.deepEqual([...parseDiagnostics, ...diagnostics], []);
  assert.ok(path);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.equal(path.commands.at(-1).type, "lineTo");
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 4, y: 0 });
  expectClose(path.commands.at(-2).x, 4 - visiblePost, 1e-6);
  assert.ok(path.commands.some((command) => command.type === "curveTo"), "snake must retain wave segments");
});

test("does not shift snake wave geometry when an arrow is added", () => {
  const decoration = "decoration={snake, pre length=0.01mm, segment length=2mm, amplitude=0.3mm, post length=1.5mm}, decorate, thick, red";
  const source = (arrow) => String.raw`
\begin{tikzpicture}
  \draw[${arrow ? "-stealth, " : ""}${decoration}] (0,0) -- (4,0);
\end{tikzpicture}`;
  const pathFor = (arrow) => {
    const { ast, diagnostics: parseDiagnostics } = parseTikz(source(arrow));
    const { ir, diagnostics } = interpretTikz(ast);
    assert.deepEqual([...parseDiagnostics, ...diagnostics], []);
    return ir.items.find((item) => item.type === "path");
  };

  const withoutArrow = pathFor(false);
  const withArrow = pathFor(true);
  const curveEnds = (path) => path.commands.filter((command) => command.type === "curveTo").map(({ x, y }) => ({ x, y }));

  assert.deepEqual(curveEnds(withArrow), curveEnds(withoutArrow));
});

test("keeps a snake arrow's viewBox on the decorated wave, not the late arrow-tip wings", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (hs1) at (0,0);
  \coordinate (s1) at (4,0);
  \draw[-stealth, decoration={snake, pre length=0.01mm, segment length=2mm, amplitude=0.3mm, post length=1.5mm}, decorate, thick, red]
    (hs1) -- (s1);
\end{tikzpicture}`;
  const result = tikzToSvg(source, { margin: 0 });
  const root = result.svg.match(/<svg\b[^>]*\bwidth="([0-9.]+)pt"[^>]*\bheight="([0-9.]+)pt"/);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(root, "expected an SVG root with point dimensions");
  expectClose(Number(root[1]), 114.18, 0.01);
  expectClose(Number(root[2]), 2.5, 0.01);
});
