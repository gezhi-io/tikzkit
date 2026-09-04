import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeColor } from "../src/engine/options.js";
import { tikzToSvg } from "../src/index.js";
import { splitXMonotoneFillBetweenPaths } from "../src/pgfplots/fillBetween.js";
import { collectPgfplotsLibraries } from "../src/pgfplots/index.js";

const LATEX_EXAMPLE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);

function renderLatexExample(name) {
  return tikzToSvg(readFileSync(new URL(name, LATEX_EXAMPLE_ROOT), "utf8"), { mathRenderer: "svg-text" });
}

function fillBetweenAreas(result) {
  return result.ir.items.filter((item) => (
    item.type === "path" &&
    item.style?.fill &&
    item.style.fill !== "none" &&
    item.style.stroke === "none"
  ));
}

const crossingPlots = String.raw`
\usepackage{pgfplots}
\usepgfplotslibrary{fillbetween}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=1,ymin=-1.2,ymax=1.2,axis lines=none]
    \addplot[name path=A,domain=0:1,samples=65] {sin(360*x)};
    \addplot[name path=B,domain=0:1,samples=65] {cos(360*x)};
    % FILL_BETWEEN
  \end{axis}
\end{tikzpicture}`;

test("splits fill-between regions at every function-plot intersection", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[orange] fill between[
      of=A and B,
      split,
      every odd segment/.style={yellow}
    ];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(areas.length, 3);
  assert.deepEqual(
    areas.map((area) => area.style.fill),
    [normalizeColor("orange"), normalizeColor("yellow"), normalizeColor("orange")]
  );
  assert.ok(areas.every((area) => area.commands.at(-1)?.type === "closePath"));
});

test("applies native fill-between segment style precedence", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[fill=gray] fill between[
      of=A and B,
      split=true,
      every segment/.style={fill=blue},
      every segment no 1/.style={fill=orange},
      every odd segment/.style={fill=green},
      every even segment/.style={fill=red},
      every last segment/.style={fill=purple}
    ];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    areas.map((area) => area.style.fill),
    [normalizeColor("red"), normalizeColor("green"), normalizeColor("purple")]
  );
});

test("uses a bare fill-between plot color as the fill color", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[orange] fill between[of=A and B];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(areas.length, 1);
  assert.equal(areas[0].style.fill, normalizeColor("orange"));
});

test("normalizes reversed function traversal before splitting intersections", () => {
  const regions = splitXMonotoneFillBetweenPaths(
    [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 0 }],
    [{ x: 2, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
  );

  assert.equal(regions.length, 3);
  assert.ok(Math.abs(regions[0].first.at(-1).x - 1 / 3) < 1e-9);
  assert.ok(Math.abs(regions[1].first.at(-1).x - 5 / 3) < 1e-9);
  assert.deepEqual(regions[2].second.at(-1), { x: 2, y: 1 });
});

test("applies a soft-clip domain before finding split intersections", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[fill=blue!30] fill between[
      of=A and B,
      split,
      soft clip={domain=.2:.5},
      every odd segment/.style={fill=red!30}
    ];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(areas.length, 1);
  assert.equal(areas[0].style.fill, normalizeColor("blue!30"));
});

test("pgfplots fillbetween closes the softly clipped region before its named curve", () => {
  const result = renderLatexExample("force-distance-diagram.tex");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const fillIndex = paths.findIndex((item) => item.style.fill === "rgb(0 255 0)" && item.commands.some((command) => command.type === "closePath"));
  const curveIndex = paths.findIndex((item) => item.style.stroke === "blue");
  const fill = paths[fillIndex];
  const coordinates = fill?.commands.filter((command) => command.type !== "closePath") || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fillIndex >= 0, "expected a green closed fill-between region");
  assert.ok(curveIndex > fillIndex, "the named blue curve should remain above its area fill");
  assert.equal(fill.style.fillOpacity, 0.3);
  assert.ok(Math.abs(Math.min(...coordinates.map((command) => command.x)) - 2.105) < 0.01);
  assert.ok(Math.abs(Math.max(...coordinates.map((command) => command.x)) - 6.314) < 0.01);
});

test("pgfplots fillbetween supports a constant named function path", () => {
  const result = renderLatexExample("force-distance-diagram-constant.tex");
  const fill = result.ir.items.find(
    (item) => item.type === "path" && item.style.fill === "rgb(0 255 0)" && item.commands.some((command) => command.type === "closePath")
  );
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const bLabel = textNodes.find((item) => item.text === "$b$");
  const cLabel = textNodes.find((item) => item.text === "$c$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fill);
  assert.equal(fill.style.fillOpacity, 0.3);
  assert.ok(bLabel, "expected the positional x tick label at x=3");
  assert.ok(cLabel, "expected the positional y tick label at y=3");
  assert.ok(Math.abs(bLabel.x - 6.013) < 0.01);
});

test("pgfplots fillbetween reports its reviewed partial support boundary", () => {
  const [library] = collectPgfplotsLibraries(String.raw`\usepgfplotslibrary{fillbetween}`);

  assert.equal(library.implementationStatus, "partial");
  assert.equal(library.implementedBy, "src/pgfplots/fillBetween.js");
  assert.match(library.localSourceReviewed, /tikzlibrarypgfplots\.fillbetween\.code\.tex$/);
  assert.match(library.notes, /soft clip=\{domain=a:b\}/);
});
