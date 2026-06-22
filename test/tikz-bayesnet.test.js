import assert from "node:assert/strict";
import test from "node:test";
import { tikzBayesnetExtension, tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";

function convert(body) {
  return tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{tikz}
\usetikzlibrary{bayesnet}
\begin{document}
\begin{tikzpicture}[node distance=1cm]
${body}
\end{tikzpicture}
\end{document}`);
}

function nodeBox(ir, id) {
  return ir.items.find((item) => item.type === "nodeBox" && item.id === id);
}

function textNode(ir, text) {
  return ir.items.find((item) => item.type === "textNode" && item.text.includes(text));
}

test("exposes tikz-bayesnet as a built-in extension module", () => {
  assert.equal(tikzBayesnetExtension.name, "tikz-bayesnet");
  assert.equal(tikzBayesnetExtension.phase, "preprocess");
  assert.ok(tikzBayesnetExtension.commands.includes("edge"));
  assert.ok(tikzBayesnetExtension.commands.includes("plate"));
  assert.equal(typeof tikzBayesnetExtension.preprocess, "function");
});

test("provides bayesnet node styles from the upstream library", () => {
  const { ir, diagnostics } = convert(String.raw`
\node[latent] (z) at (0,0) {$z$};
\node[obs, right=of z] (x) {$x$};
\node[det, right=of x] (d) {$d$};
\node[const, below=of z] (c) {$N$};
\node[factor, below=of x] (f) {};`);

  assert.deepEqual(diagnostics, []);
  assert.equal(nodeBox(ir, "z").shape, "circle");
  assert.equal(nodeBox(ir, "z").style.fill, "white");
  assert.equal(nodeBox(ir, "z").style.stroke, "black");
  assert.ok(Math.abs(nodeBox(ir, "z").width - parseDimension("20pt")) < 1e-6);
  assert.equal(nodeBox(ir, "x").shape, "circle");
  assert.equal(nodeBox(ir, "x").style.fill, "rgb(223 223 223)");
  assert.equal(nodeBox(ir, "d").shape, "diamond");
  assert.equal(nodeBox(ir, "c"), undefined);
  assert.ok(textNode(ir, "$N$"), "expected const style to render text without a box");
  assert.equal(nodeBox(ir, "f").style.fill, "black");
  assert.ok(Math.abs(nodeBox(ir, "f").width - parseDimension("5pt")) < 1e-6);
});

test("expands edge, factoredge, factor, plate, and gate macros", () => {
  const { ir, diagnostics } = convert(String.raw`
\node[obs] (y) at (0,0) {$y$};
\node[latent, above=of y, xshift=-1.2cm] (w) {$\mathbf{w}$};
\node[latent, above=of y, xshift=1.2cm] (x) {$\mathbf{x}$};
\node[latent, right=2cm of y] (t) {$\tau$};
\edge {x,w,t} {y};
\factor[right=of t] {fy} {$\mathcal{N}$} {t} {y};
\factoredge {w,x} {fy} {y};
\plate {yx} {(x)(y)} {$N$};
\gate {g} {(fy)(y)} {t};`);

  assert.deepEqual(diagnostics, []);
  assert.ok(nodeBox(ir, "fy"), "expected factor macro to create a named factor node");
  assert.equal(nodeBox(ir, "fy").style.fill, "black");
  assert.ok(nodeBox(ir, "yx"), "expected plate macro to create a fit rectangle");
  assert.ok(nodeBox(ir, "g"), "expected gate macro to create a dashed fit rectangle");
  assert.ok(nodeBox(ir, "g").style.dashArray?.length > 0);
  assert.ok(textNode(ir, "$N$"), "expected plate caption");
  assert.ok(textNode(ir, String.raw`$\mathcal{N}$`), "expected factor caption");

  const paths = ir.items.filter((item) => item.type === "path");
  const arrows = paths.filter((item) => item.style.markerEnd);
  assert.ok(arrows.length >= 5, "expected directed edge and factoredge paths");
  assert.ok(arrows.every((item) => item.style.markerEnd.kind === "triangle 45"));
});

test("expands vertical and horizontal gates as fit boxes with split lines", () => {
  const { ir, diagnostics } = convert(String.raw`
\node[latent] (a) at (0,0) {$a$};
\node[latent, right=of a] (b) {$b$};
\node[latent, below=of a] (c) {$c$};
\node[latent, below=of b] (d) {$d$};
\vgate {gv} {(a)(c)} {$0$} {(b)(d)} {$1$} {a};
\hgate {gh} {(a)(b)} {$0$} {(c)(d)} {$1$} {b};`);

  assert.deepEqual(diagnostics, []);
  assert.ok(nodeBox(ir, "gv"));
  assert.ok(nodeBox(ir, "gh"));
  const splitLines = ir.items.filter((item) => item.type === "path" && item.style.dashArray?.length);
  assert.ok(splitLines.length >= 2, "expected dashed split lines for vgate and hgate");
  assert.ok(textNode(ir, "$0$"));
  assert.ok(textNode(ir, "$1$"));
});
