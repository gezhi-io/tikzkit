import assert from "node:assert/strict";
import test from "node:test";
import { tikzCdExtension, tikzToSvg } from "../src/index.js";

function hasMathText(ir, text) {
  return ir.items.some((item) => item.type === "textNode" && stripTikzCdLabelSize(item.text) === text);
}

function textNode(ir, text) {
  return ir.items.find((item) => item.type === "textNode" && stripTikzCdLabelSize(item.text) === text);
}

function stripTikzCdLabelSize(text) {
  return String(text || "").replace(/^\\(?:small|scriptsize|tiny)\s+/, "");
}

function arrowTipPath(svg, className) {
  return svg.match(new RegExp(`<path class="tikz-arrow-tip ${className}"[^>]+>`))?.[0] || "";
}

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
  assert.ok(hasMathText(ir, "$A$"));
  assert.ok(hasMathText(ir, "$B$"));
  assert.ok(hasMathText(ir, "$\\phi$"));
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
    assert.ok(hasMathText(ir, label), `missing label ${label}`);
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
  assert.ok(hasMathText(ir, "$\\ulcorner$"));
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
  const descriptionBoxes = ir.items.filter((item) => item.type === "nodeBox" && item.style.fill === "white");
  assert.ok(descriptionBoxes.length >= 2, "description labels should keep white backgrounds");
  assert.ok(descriptionBoxes.every((box) => box.width < 0.36 && box.height < 0.28), "tikzcd description label backgrounds should be tight");
  const twoHeadsTip = arrowTipPath(svg, "tikz-arrow-two-heads");
  assert.match(twoHeadsTip, /class="tikz-arrow-tip tikz-arrow-two-heads"/);
  assert.match(svg, /class="tikz-arrow-tip tikz-arrow-hook"/);
  assert.match(twoHeadsTip, /fill="none"/, "two heads should be drawn as an open TikZ-style arrow tip");
  assert.doesNotMatch(twoHeadsTip, /\sZ(?:\s|")/, "two heads should not render as filled closed triangles");
  assert.ok(paths.some((item) => item.style.dashArray?.length > 0), "missing dashed or dotted edge");
  for (const label of ["$f$", "$g$", "$\\alpha$", "$p$", "$h$", "$k$", "$u$", "$v$", "$\\beta$"]) {
    assert.ok(hasMathText(ir, label), `missing label ${label}`);
  }
  assert.ok(textNode(ir, "$g$").x < textNode(ir, "$A$").x, "swapped vertical label should be left of the edge");
  assert.ok(textNode(ir, "$h$").x > textNode(ir, "$B$").x, "vertical label should be right of the edge");
  assert.ok(textNode(ir, "$f$").y > textNode(ir, "$A$").y, "horizontal label should be above the edge");
  assert.ok(textNode(ir, "$u$").y < textNode(ir, "$D$").y, "swapped horizontal label should be below the edge");
  assert.ok(textNode(ir, "$A$").text.startsWith("\\small"), "tikzcd cells should use a compact math size");
  assert.ok(textNode(ir, "$f$").text.startsWith("\\tiny"), "tikzcd arrow labels should be smaller than cells");
});
