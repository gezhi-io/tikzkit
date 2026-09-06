import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  renderAxisOverlayStatements,
  transformAxisStatementCoordinates
} from "../src/pgfplots/axisOverlay.js";

const unitRanges = {
  xMin: 0,
  xMax: 1,
  yMin: 0,
  yMax: 1,
  zMin: 0,
  zMax: 1
};

const obliqueGeometry = {
  is3d: true,
  origin: { x: 0, y: 0 },
  width: 13,
  height: 12,
  mapPoint3d: ({ x, y, z = 0 }) => ({
    x: 10 * x + 3 * y,
    y: 5 * y + 7 * z
  }),
  mapNormalizedPoint3d: ({ x, y, z = 0 }) => ({
    x: 10 * x + 3 * y,
    y: 5 * y + 7 * z
  }),
  mapAxisDirection3d: ({ x, y, z = 0 }) => ({
    x: 10 * x + 3 * y,
    y: 5 * y + 7 * z
  })
};

const expectedClip = "tikzkit clip polygon={0,0;10,0;13,5;13,12;3,12;0,7}";

test("projects out-of-range 3D axis coordinates without clamping", () => {
  assert.equal(
    transformAxisStatementCoordinates(
      String.raw`\draw (axis cs:-1,.5,.5) -- (axis cs:2,.5,.5);`,
      unitRanges,
      obliqueGeometry
    ),
    String.raw`\draw (-8.5,6) -- (21.5,6);`
  );
});

test("applies one projected 3D axis-box hull to paths, nodes, and pins in global mode", () => {
  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\draw (axis cs:-1,.5,.5) -- (axis cs:2,.5,.5);
\filldraw (axis cs:.5,.5,.5) circle (2pt);
\node at (axis cs:1.2,.5,.5) [pin=45:{outside}] {partial};`,
      unitRanges,
      obliqueGeometry
    ),
    [
      String.raw`\draw [${expectedClip}] (-8.5,6) -- (21.5,6);`,
      String.raw`\filldraw [${expectedClip}] (6.5,6) circle (2pt);`,
      String.raw`\node [${expectedClip}] at (13.5,6) [pin=45:{outside}] {partial};`
    ]
  );
});

test("keeps ordinary 3D overlay unclipped for individual and disabled clip modes", () => {
  const body = String.raw`\draw (axis cs:-1,.5,.5) -- (axis cs:2,.5,.5);
\node at (axis cs:1.2,.5,.5) {outside};`;
  for (const options of [{ "clip mode": "individual" }, { clip: false }]) {
    const commands = renderAxisOverlayStatements(body, unitRanges, obliqueGeometry, options);
    assert.ok(commands.every((command) => !command.includes("tikzkit clip polygon")));
    assert.match(commands[0], /\(-8\.5,6\).*\(21\.5,6\)/);
    assert.match(commands[1], /\(13\.5,6\)/);
  }
});

test("clips node boxes, text, and pin edges with a shared SVG polygon", () => {
  const source = String.raw`
\usepackage{pgfplots}
\begin{tikzpicture}
\begin{axis}[view={35}{30},xmin=0,xmax=1,ymin=0,ymax=1,zmin=0,zmax=1]
  \addplot3[surf,domain=0:1,y domain=0:1,samples=3] {x+y};
  \node[draw,minimum size=8mm] at (axis cs:1.05,.5,.5) [pin=45:{edge label}] {part};
\end{axis}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const clipped = result.ir.items.filter((item) => item.clipPolygon);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(clipped.some((item) => item.type === "nodeBox"));
  assert.ok(clipped.some((item) => item.type === "textNode" && item.text === "part"));
  assert.ok(clipped.some((item) => item.type === "textNode" && String(item.text).includes("edge label")));
  assert.ok(clipped.some((item) => item.subtype === "pin-edge"));
  assert.ok(clipped.every((item) => item.clipPolygon.length >= 4));
  assert.match(result.svg, /<clipPath[^>]+><polygon points=/);
  assert.match(result.svg, /<g clip-path="url\(#tikzkit-[\da-f]{16}-tikzkit-clip-polygon-/);
});

test("clips ordinary 2D axis nodes and pins with the shared axis rectangle", () => {
  const source = String.raw`
\usepackage{pgfplots}
\begin{tikzpicture}
\begin{axis}[xmin=0,xmax=1,ymin=0,ymax=1]
  \node[draw,minimum size=8mm] at (axis cs:1.05,.5) [pin=45:{edge label}] {part};
\end{axis}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const clipped = result.ir.items.filter((item) => item.clipRect);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(clipped.some((item) => item.type === "nodeBox"));
  assert.ok(clipped.some((item) => item.type === "textNode" && item.text === "part"));
  assert.ok(clipped.some((item) => item.type === "textNode" && String(item.text).includes("edge label")));
  assert.ok(clipped.some((item) => item.subtype === "pin-edge"));
  assert.match(result.svg, /<clipPath[^>]+><rect /);
  assert.match(result.svg, /<g clip-path="url\(#tikzkit-[\da-f]{16}-tikzkit-clip-/);
});

test("removes the visible out-of-range annotations from the real 3D Gaussian fixture", async () => {
  const source = await readFile(
    new URL("fixtures/examples/latex-examples/3d-gaussian-distribution.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => ["$P(x_1)$", "$P(x_2)$"].includes(item.text));
  const pinEdges = result.ir.items.filter((item) => item.subtype === "pin-edge");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(labels.length, 2);
  assert.equal(pinEdges.length, 2);
  assert.ok(labels.every((item) => item.clipPolygon?.length === 6));
  assert.ok(pinEdges.every((item) => item.clipPolygon?.length === 6));
  assert.match(result.svg, /<clipPath[^>]+><polygon points=/);
});

test("preserves individual-mode points and the existing 2D annotation clip contract", async () => {
  const [scatterSource, lineSource] = await Promise.all([
    readFile(new URL("fixtures/examples/latex-examples/csv-2d-gaussian-multivarate-distributions.tex", import.meta.url), "utf8"),
    readFile(new URL("fixtures/examples/latex-examples/line-chart-electric-vehicles-sold.tex", import.meta.url), "utf8")
  ]);
  const scatterData = readFileSync(
    new URL("fixtures/examples/resources/csv-2d-gaussian-multivarate-distributions/data.csv", import.meta.url),
    "utf8"
  );
  const scatterResult = tikzToSvg(scatterSource, {
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => name === "data.csv" ? scatterData : null
  });
  const lineResult = tikzToSvg(lineSource, { mathRenderer: "svg-text" });

  assert.deepEqual(scatterResult.diagnostics, []);
  assert.ok(scatterResult.ir.items.some((item) => item.type === "textNode" && String(item.text).includes("65, 35")));
  assert.ok(!scatterResult.ir.items.some((item) => item.clipPolygon));

  assert.deepEqual(lineResult.diagnostics, []);
  assert.ok(lineResult.ir.items.some((item) => item.type === "textNode" && String(item.text).includes("Tesla Model 3")));
  assert.ok(lineResult.ir.items.some((item) => item.type === "textNode" && String(item.text).includes("Tesla Model Y")));
  assert.ok(lineResult.ir.items.some((item) => item.type === "path" && item.clipRect));
});
