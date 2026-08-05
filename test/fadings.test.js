import assert from "node:assert/strict";
import test from "node:test";

import { interpretTikz } from "../src/engine/evaluate.js";
import { parseTikz } from "../src/frontend/parser.js";
import { renderSvg } from "../src/renderers/svg/renderSvg.js";

test("renders the standard radial path fadings as object-bounding-box masks", () => {
  const source = String.raw`
\usetikzlibrary{fadings}
\begin{tikzpicture}
  \fill[blue,path fading=circle with fuzzy edge 15 percent] (0,0) circle (1);
  \fill[red,path fading=fuzzy ring 15 percent] (3,0) circle (1);
  \node[circle,fill=green,path fading=circle with fuzzy edge 20 percent] at (6,0) {};
\end{tikzpicture}`;
  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const svg = renderSvg(interpreted.ir);
  const fadedNode = interpreted.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual([...parsed.diagnostics, ...interpreted.diagnostics], []);
  assert.equal(fadedNode?.style?.pathFading, "circle with fuzzy edge 20 percent");
  assert.match(svg, /<radialGradient[^>]+id="tikz-fading-gradient-circle-with-fuzzy-edge-15-percent-radial"/);
  assert.match(svg, /<radialGradient[^>]+gradientUnits="objectBoundingBox" cx="0\.5" cy="0\.5" r="1"/);
  assert.match(svg, /<stop offset="42\.5%" stop-color="white"/);
  assert.match(svg, /<radialGradient[^>]+id="tikz-fading-gradient-fuzzy-ring-15-percent-radial"/);
  assert.match(svg, /<stop offset="46\.25%" stop-color="white"/);
  assert.match(svg, /mask="url\(#tikz-fading-circle-with-fuzzy-edge-15-percent-mask\)"/);
  assert.match(svg, /mask="url\(#tikz-fading-fuzzy-ring-15-percent-mask\)"/);
  assert.match(svg, /mask="url\(#tikz-fading-circle-with-fuzzy-edge-20-percent-mask\)"/);
});
