import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { renderAxisOverlayStatements } from "../src/pgfplots/axisOverlay.js";

const ranges = { xMin: 0, xMax: 4, yMin: -1, yMax: 1 };
const options = { "axis lines": "middle", "enlarge x limits": "true", "enlarge y limits": "true",
  xmin: 0, xmax: 4, ymin: -1, ymax: 1, width: "12cm", height: "8cm" };
const close = (a, b, tolerance = 0.001) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const clip = command => command.match(/tikzkit clip rect=\{([^}]+)\}/)?.[1].split(",").map(Number);
const finalBox = geometry => {
  const limits = geometry.lineRanges;
  const a = geometry.mapPoint({ x: limits.xMin, y: limits.yMin });
  const b = geometry.mapPoint({ x: limits.xMax, y: limits.yMax });
  return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
};

test("enlarged 2D function, coordinate and parametric paths clip to the final mapped axis limits", () => {
  const plots = [
    { type: "function", expression: "x", options: { domain: "-2:6", samples: 17 } },
    { type: "coordinates", points: [{ x: -2, y: 0.5 }, { x: 6, y: 0.5 }], options: {} },
    { type: "parametric", xExpression: "x", yExpression: "0.5*x", options: { domain: "-2:6", samples: 17 } }
  ];
  for (const extra of [{}, { "x dir": "reverse", "y dir": "reverse" }]) {
    const axisOptions = { ...options, ...extra };
    const geometry = createAxisGeometry(axisOptions, ranges);
    for (const plot of plots) {
      const command = renderAddplot(plot, axisOptions, ranges, geometry, {}).find(c => c.startsWith("\\draw[axis plot"));
      assert.ok(clip(command), "The final paint path must carry a clip");
      clip(command).forEach((value, i) => close(value, finalBox(geometry)[i]));
    }
  }
});

test("axis overlays and clipped marker paths use the same enlarged rectangle as plot lines", () => {
  const axisOptions = { ...options, "clip marker paths": "true" };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAddplot({ type: "coordinates", options: { "only marks": true, mark: "square*" },
    points: [{ x: -0.2, y: 0 }, { x: 4.2, y: 0 }] }, axisOptions, ranges, geometry, {});
  commands.push(...renderAxisOverlayStatements(String.raw`\draw (axis cs:-1,0) -- (axis cs:5,0);`, ranges, geometry, axisOptions));
  assert.equal(commands.length, 3, "Both centers in the enlarged margins must survive");
  for (const command of commands) {
    assert.ok(clip(command));
    clip(command).forEach((value, i) => close(value, finalBox(geometry)[i]));
  }
});

test("clip=false and individual overlay clipping retain their existing opt-out behavior", () => {
  const axisOptions = { ...options, clip: "false", "clip marker paths": "true" };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAddplot({ type: "function", expression: "x", options: { domain: "-2:6", samples: 17 } },
    axisOptions, ranges, geometry, {});
  commands.push(...renderAxisOverlayStatements(String.raw`\draw (axis cs:-1,0) -- (axis cs:5,0);`, ranges, geometry, axisOptions));
  assert.ok(commands.every(c => !clip(c)));
  const individual = renderAxisOverlayStatements(String.raw`\draw (axis cs:-1,0) -- (axis cs:5,0);`, ranges, geometry,
    { ...options, "clip mode": "individual" });
  assert.ok(individual.every(c => !clip(c)));
});

test("cos-fixpoint final SVG preserves the curve portions in the enlarged margins", () => {
  const result = tikzToSvg(readFileSync("test/fixtures/examples/latex-examples/cos-fixpoint.tex", "utf8"));
  assert.deepEqual(result.diagnostics, []);
  const paths = result.ir.items.filter(item => item.subtype === "axis-plot");
  assert.equal(paths.length, 2);
  for (const item of paths) {
    const { minX, minY, maxX, maxY } = item.clipRect;
    // A path can pass a lowering-only test yet disappear inside the SVG clip.
    for (const point of [item.commands[0], item.commands.at(-1)]) {
      assert.ok(point.x >= minX - 0.001 && point.x <= maxX + 0.001, "Endpoint outside the actual x clip");
      assert.ok(point.y >= minY - 0.001 && point.y <= maxY + 0.001, "Endpoint outside the actual y clip");
    }
    assert.ok(minX < 0 && minY < 0, "The viewport must include the enlarged margins");
  }
  // Native probe: width=12cm, height=8cm, each minus PGFPlots' 45pt reserve.
  const box = paths[0].clipRect;
  const ptPerCm = 72.27 / 2.54;
  close((box.maxX - box.minX) * ptPerCm, 296.43137, 0.08);
  close((box.maxY - box.minY) * ptPerCm, 182.62025, 0.08);
  assert.match(result.svg, /<clipPath\b/);
});
