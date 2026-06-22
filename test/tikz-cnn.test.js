import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { tikzCnnExtension, tikzToSvg } from "../src/index.js";

function convert(body) {
  return tikzToSvg(String.raw`
\documentclass[tikz,border=4mm]{standalone}
\usepackage{tikz}
\usepackage{tikz-cnn}
\begin{document}
\begin{tikzpicture}
${body}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });
}

function paths(ir, subtype) {
  return ir.items.filter((item) => item.type === "path" && (!subtype || item.subtype === subtype));
}

test("exposes tikz-cnn as a built-in extension module", () => {
  assert.equal(tikzCnnExtension.name, "tikz-cnn");
  assert.equal(tikzCnnExtension.phase, "preprocess");
  assert.ok(tikzCnnExtension.commands.includes("networkLayer"));
  assert.equal(typeof tikzCnnExtension.preprocess, "function");
});

test("expands a tikz_cnn networkLayer into a projected 3D layer box", () => {
  const { ir, diagnostics } = convert(String.raw`
\networkLayer{2.0}{0.5}{0.0}{0.0}{0.0}{fill=gray!30,draw=black}{input}{start}{}`);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.start_front, { x: 0.5, y: 0 });
  assert.deepEqual(ir.coordinates.start_back, { x: 0, y: 0 });
  assert.deepEqual(ir.coordinates.start_top, { x: 0.25, y: 1 });
  assert.deepEqual(ir.coordinates.start_bottom, { x: 0.25, y: -1 });
  assert.equal(paths(ir, "tikz-cnn-edge").length, 5);
  assert.equal(paths(ir, "tikz-cnn-face").length, 3);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "input"));
});

test("tracks tikz_cnn totalOffset and draws cross-layer connections", () => {
  const { ir, diagnostics } = convert(String.raw`
\networkLayer{2.0}{0.5}{0.0}{0.0}{0.0}{fill=gray!30,draw=black}{}{start}{}
\networkLayer{1.0}{0.25}{1.0}{0.0}{0.0}{fill=green!50,draw=black}{}{skip}{{start_front}}
\networkLayer{1.0}{0.25}{0.5}{0.0}{0.0}{fill=blue!50,draw=black}{sum}{out}{{start_front,skip_front}}`);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.skip_back, { x: 1.5, y: 0 });
  assert.deepEqual(ir.coordinates.out_back, { x: 2.25, y: 0 });
  assert.equal(paths(ir, "tikz-cnn-connection").length, 3);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "sum"));
});

test("renders the upstream jettan/tikz_cnn example without diagnostics", () => {
  const source = readFileSync("work/jettan-tikz-cnn/main.tex", "utf8");
  const { ir, diagnostics, svg } = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  assert.equal(paths(ir, "tikz-cnn-face").length >= 20, true);
  assert.ok(ir.coordinates.mid_front);
  assert.ok(ir.coordinates.bot_front);
  assert.ok(ir.coordinates.top_front);
  assert.ok(ir.items.some((item) => item.type === "textNode" && item.text === "deconv"));
  assert.match(svg, /<svg/);
});
