import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { tikzToSvgAsync } from "../src/index.js";
import { renderAxisLabels } from "../src/pgfplots/labels.js";
import { renderAxisLines } from "../src/pgfplots/axisLines.js";

const LDA_FIXTURES = [
  "lda-gauss-1",
  "lda-gauss-2",
  "lda-gauss-intervariance",
  "lda-gauss-intervariance-big",
  "lda-gauss-variance-big",
  "lda-gauss-variance-small"
];

test("PGFPlots reserves the native TeX descent for explicit middle-axis math labels", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 10,
    height: 6,
    mapPoint: ({ x, y }) => ({ x: (x + 1) * 5, y: (y + 1) * 3 }),
    mapAxisDescriptionPoint: ({ x, y }) => ({ x: x * 10, y: y * 6 })
  };
  const options = {
    "axis lines": "middle",
    xlabel: "$x$",
    "x label style": "at={(axis description cs:0.5,-0.05)},anchor=north,font=\\boldmath\\Large"
  };

  const [mathLabel] = renderAxisLabels(options, ranges, geometry);
  assert.match(mathLabel, /tikzkit layout bbox bottom padding=1\.98pt/);

  const [plainLabel] = renderAxisLabels({ ...options, xlabel: "x" }, ranges, geometry);
  assert.doesNotMatch(plainLabel, /layout bbox bottom padding/);
});

test("PGFPlots arrowed axes include the native arrow-tip paint extent", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = {
    lineRanges: ranges,
    mapPoint: ({ x, y }) => ({ x, y })
  };

  assert.deepEqual(renderAxisLines({ "axis lines": "middle" }, ranges, geometry), [
    String.raw`\draw[axis line, black, line width=0.4pt, -stealth] (-1,0) -- (1.007,0);`,
    String.raw`\draw[axis line, black, line width=0.4pt, -stealth] (0,-1) -- (0,1.007);`
  ]);
  assert.deepEqual(renderAxisLines({ "axis lines": "box" }, ranges, geometry), [
    String.raw`\draw[axis line, black, line width=0.35pt] (-1,0) -- (1,0);`,
    String.raw`\draw[axis line, black, line width=0.35pt] (0,-1) -- (0,1);`
  ]);
});

test("the six LDA fixtures share the tikztosvg canvas contract without diagnostics", async () => {
  const results = await Promise.all(
    LDA_FIXTURES.map(async (name) => {
      const source = await readFile(
        new URL(`./fixtures/examples/latex-examples/${name}.tex`, import.meta.url),
        "utf8"
      );
      return { name, result: await tikzToSvgAsync(source, { margin: 0, mathRenderer: "svg-text" }) };
    })
  );

  for (const { name, result } of results) {
    assert.deepEqual(result.diagnostics, [], `${name} should render without diagnostics`);
    const plotIndices = result.ir.items
      .map((item, index) => item.type === "path" && item.subtype === "axis-plot" ? index : -1)
      .filter((index) => index >= 0);
    const axisLineIndices = result.ir.items
      .map((item, index) => item.type === "path" && item.subtype === "axis-line" && item.style?.stroke === "black" ? index : -1)
      .filter((index) => index >= 0);
    assert.equal(axisLineIndices.length, 2, `${name} should paint both opaque middle axes`);
    assert.ok(Math.min(...axisLineIndices) > Math.max(...plotIndices), `${name} axes should be replayed above the plots`);
    const dimensions = svgDimensions(result.svg);
    assert.ok(Math.abs(dimensions.width - 359.62) <= 0.02, `${name} width was ${dimensions.width}pt`);
    assert.ok(Math.abs(dimensions.height - 216.4) <= 0.03, `${name} height was ${dimensions.height}pt`);
  }
});

function svgDimensions(svg) {
  const root = String(svg).match(/<svg\b[^>]*\bwidth="([0-9.]+)pt"[^>]*\bheight="([0-9.]+)pt"/);
  assert.ok(root, "expected an SVG root with point dimensions");
  return { width: Number(root[1]), height: Number(root[2]) };
}
