import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz, tikzToSvg } from "../src/index.js";
import { lineWidthFromTikzDimension } from "../src/tikz/metrics.js";

test("applies transformer-core style-directory color, thickness, and dash settings", () => {
  const source = String.raw`
\begin{circuitikz}
  \draw (0,0) node[transformer core](A){};
  \ctikzset{transformer core/.cd, relative thickness=2, color=red, dash={{4pt}{2pt}}}
  \draw (2,0) node[transformer core](B){};
\end{circuitikz}`.replaceAll("\\\\", "\\");
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const transformers = ir.items.filter((item) => item.type === "nodeBox" && item.subtype === "circuitikz-quadpole-transformer-core");
  const styled = transformers.find((item) => item.id === "B");
  const svg = tikzToSvg(source, { mathRenderer: "svg-text" }).svg;

  assert.deepEqual(diagnostics, []);
  assert.equal(transformers.length, 2);
  assert.equal(styled.shapeData.quadpoleSettings.core.color, "red");
  assert.equal(styled.shapeData.quadpoleSettings.core.relativeThickness, 2);
  assert.equal(styled.shapeData.quadpoleSettings.core.dashMode, "custom");
  assert.deepEqual(styled.shapeData.quadpoleSettings.core.dashArray, [lineWidthFromTikzDimension("4pt"), lineWidthFromTikzDimension("2pt")]);
  assert.match(svg, /tikz-node-circuitikzQuadpole-core[^>]+stroke="red"[^>]+stroke-width="5\.623356/);
  assert.match(svg, /tikz-node-circuitikzQuadpole-core[^>]+stroke-dasharray="14\.058392143307286 7\.029196071653643"/);
});

test("renders transformer leads and cute coils with Circuitikz's shared geometry", () => {
  const source = String.raw`
\begin{circuitikz}
  \draw (0,0) node[transformer core](T){};
\end{circuitikz}`.replaceAll("\\\\", "\\");
  const { diagnostics } = interpretTikz(parseTikz(source).ast);
  const svg = tikzToSvg(source, { mathRenderer: "svg-text" }).svg;

  assert.deepEqual(diagnostics, []);
  assert.match(svg, /tikz-node-circuitikzQuadpole-leads/);
  assert.match(svg, /tikz-node-circuitikzQuadpole-coils[^>]+d="[^"]* C [^"]* C /);
  assert.match(svg, /tikz-node-circuitikzQuadpole-coils[^>]+stroke-linejoin="bevel"/);
});

test("inherits a path dash by default and lets dash=none make the core solid", () => {
  const source = String.raw`
\begin{circuitikz}
  \draw[blue,dashed] (0,0) node[transformer core](dashed){};
  \ctikzset{transformer core/.cd, dash=none}
  \draw[blue,dashed] (2,0) node[transformer core](solid){};
\end{circuitikz}`.replaceAll("\\\\", "\\");
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const cores = ir.items
    .filter((item) => item.type === "nodeBox" && item.subtype === "circuitikz-quadpole-transformer-core")
    .map((item) => item.shapeData.quadpoleSettings.core);
  const svg = tikzToSvg(source, { mathRenderer: "svg-text" }).svg;
  const corePaths = [...svg.matchAll(/<path class="tikz-node-circuitikzQuadpole-core"[^>]*>/g)].map((match) => match[0]);

  assert.deepEqual(diagnostics, []);
  assert.equal(cores[0].dashMode, "inherit");
  assert.equal(cores[1].dashMode, "solid");
  assert.equal(corePaths.length, 2);
  assert.match(corePaths[0], /stroke="blue"[^>]+stroke-dasharray=/);
  assert.doesNotMatch(corePaths[1], /stroke-dasharray=/);
});
