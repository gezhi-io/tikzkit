import assert from "node:assert/strict";
import test from "node:test";
import { tikzCdExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-cd as a built-in extension module", () => {
  assert.equal(tikzCdExtension.name, "tikz-cd");
  assert.equal(tikzCdExtension.phase, "preprocess");
  assert.ok(tikzCdExtension.commands.includes("tikzcd"));
  assert.equal(typeof tikzCdExtension.preprocess, "function");
});

test("expands a basic tikzcd environment into matrix nodes and arrows", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{tikz-cd}
\begin{document}
\begin{tikzcd}
  A \arrow[r, "\phi"] & B
\end{tikzcd}
\end{document}`);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates["tikzcd-1-1-1"], { x: 0, y: 0 });
  assert.ok(ir.coordinates["tikzcd-1-1-2"].x > 0.5);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "$A$"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "$B$"));
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "$\\phi$"));
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  assert.equal(arrow.style.markerEnd.kind, "to");
  assert.ok(arrow.commands.at(-1).x > arrow.commands[0].x);
});

test("supports tikzcd diagonal arrows, labels, swaps, bends, and dashed styles", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzcd}[row sep=small, column sep=large]
  T
    \arrow[drr, bend left, "x"]
    \arrow[ddr, bend right, "y"]
    \arrow[dr, dotted, "{(x,y)}" description] & & \\
    & X \times_Z Y \arrow[r, "p"] \arrow[d, "q"']
      & X \arrow[d, "f"] \\
    & Y \arrow[r, "g"]
      & Z
\end{tikzcd}`);

  assert.deepEqual(diagnostics, []);
  const paths = ir.items.filter((item) => item.type === "path");
  assert.ok(paths.length >= 7);
  assert.ok(paths.some((item) => item.commands.some((command) => command.type === "curveTo")));
  assert.ok(paths.some((item) => item.style.dashArray?.length > 0));
  for (const label of ["$x$", "$y$", "${(x,y)}$", "$p$", "$q$", "$f$", "$g$"]) {
    assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === label), `missing label ${label}`);
  }
});

test("supports tikzcd aliases, absolute from/to targets, and phantom labels", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzcd}
  A \arrow[to=Z, red] \arrow[to=2-2, blue]
    & B \\
  |[alias=Z]| C
    & D
  \arrow[from=ul, to=1-2, purple]
  \arrow[ul, phantom, "\ulcorner", very near start]
\end{tikzcd}`);

  assert.deepEqual(diagnostics, []);
  const cNode = Object.entries(ir.coordinates).find(([name]) => /^tikzcd-\d+-2-1$/.test(name))?.[1];
  assert.deepEqual(ir.coordinates.Z, cNode);
  assert.ok(ir.items.some((item) => item.type === "path" && item.style.stroke === "red"));
  assert.ok(ir.items.some((item) => item.type === "path" && item.style.stroke === "blue"));
  assert.ok(ir.items.some((item) => item.type === "path" && item.style.stroke === "purple"));
  assert.equal(ir.items.some((item) => item.type === "path" && item.style.stroke === "none"), false);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "$\\ulcorner$"));
});

test("preserves tikzcd hook and two heads arrow tips from rich gallery case", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-cd}
\begin{document}
\begin{tikzcd}
  A \arrow[r, "f"] \arrow[d, "g"'] \arrow[dr, dashed, "\alpha" description] & B \arrow[r, two heads, "p"] \arrow[d, "h"] & C \arrow[d, hook, "k"] \\
  D \arrow[r, "u"'] & E \arrow[r, "v"'] \arrow[ur, dotted, "\beta" description] & F
\end{tikzcd}
\end{document}`);
  const { ir, diagnostics, svg } = result;

  assert.deepEqual(diagnostics, []);
  const paths = ir.items.filter((item) => item.type === "path");
  assert.ok(paths.some((item) => item.style.markerEnd?.kind === "two-heads"), "missing two heads arrow");
  assert.ok(paths.some((item) => item.style.markerStart?.kind === "hook" && item.style.markerEnd?.kind === "to"), "missing hook arrow");
  assert.match(svg, /id="arrow-two-heads-/);
  assert.match(svg, /id="arrow-hook-/);
  assert.ok(paths.some((item) => item.style.dashArray?.length > 0), "missing dashed or dotted edge");
  for (const label of ["$f$", "$g$", "$\\alpha$", "$p$", "$h$", "$k$", "$u$", "$v$", "$\\beta$"]) {
    assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === label), `missing label ${label}`);
  }
});
