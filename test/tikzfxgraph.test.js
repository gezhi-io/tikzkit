import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg, tikzfxgraphExtension } from "../src/index.js";

test("exposes tikzfxgraph as a built-in extension module", () => {
  assert.equal(tikzfxgraphExtension.name, "tikzfxgraph");
  assert.equal(tikzfxgraphExtension.phase, "preprocess");
  assert.ok(tikzfxgraphExtension.commands.includes("fxgraphdraw"));
});

test("expands tikzfxgraph function sets into pgfplots-style axis plots", () => {
  const source = String.raw`
\documentclass[crop,tikz]{standalone}
\usepackage{tikz}
\usepackage{pgfplots}
\usepackage{tikzfxgraph}
\begin{document}
\fxsetnew{set-B}
\fxsetappend{set-B}{id=B0,fx=2*cos(x)+1,legend=B0}
\fxsetappend{set-B}{id=B1,fx=2*sin(2*x)-1,legend=B1,thick}
\fxgraphdraw{
  linear,
  y ticks={min=-3,max=3,N=6},
  x ticks={min=0,max=6.2831853,N=6,units=rad},
  fx set={set-B},
  function={id=Dx,fx=x-2,legend=Dx,blue},
  xlabel={$x$},
  ylabel={$f(x)$},
  title={Graph A}
}
\end{document}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.filter((item) => item.subtype === "axis-plot").length >= 3);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "B0"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "Graph A"));
});

test("expands fxgraph environment and keeps extra pgfplots commands", () => {
  const source = String.raw`
\documentclass[crop,tikz]{standalone}
\usepackage{tikzfxgraph}
\begin{document}
\begin{fxgraph}{
  linear,
  x ticks={min=-2,max=2,N=4},
  y ticks={min=-1,max=5,N=6},
  function={id=P,fx=x^2,legend={$x^2$},red},
  width=5cm,
  height=3cm
}
  \addplot[only marks, blue] coordinates {(-1,1) (0,0) (1,1)};
  \addlegendentry{samples}
\end{fxgraph}
\end{document}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.subtype === "axis-mark"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "samples"));
});
