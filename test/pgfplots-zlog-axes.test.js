import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { axisPointIsValidForScale } from "../src/pgfplots/logAxis.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";
import { renderAxis3DTicks } from "../src/pgfplots/axis3d.js";
import { pgfplotsSurfaceColor } from "../src/pgfplots/surface.js";

test("three-dimensional logarithmic coordinates reject non-positive z values", () => {
  const options = { zmode: "log" };
  assert.equal(axisPointIsValidForScale({ x: 1, y: 1, z: 0 }, options), false);
  assert.equal(axisPointIsValidForScale({ x: 1, y: 1, z: 1 }, options), true);
});

test("three-dimensional logarithmic ranges retain small positive z values", () => {
  const ranges = computeAxisRanges(
    { zmode: "log" },
    [{
      type: "coordinates",
      is3d: true,
      options: {},
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1e-4 },
        { x: 2, y: 2, z: 1e4 }
      ]
    }]
  );
  assert.equal(ranges.zMin, 1e-4);
  assert.equal(ranges.zMax, 1e4);
});

test("three-dimensional base-two z ticks use power labels", () => {
  const options = { zmode: "log", "log basis z": 2, zmin: 1, zmax: 64, view: "{35}{25}", "pgfplots 3d surface": true };
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 1, zMax: 64 };
  const commands = renderAxis3DTicks(options, ranges, createAxisGeometry(options, ranges));
  const labels = commands.filter((command) => command.includes("axis tick label"));
  assert.ok(labels.some((command) => command.endsWith("{$2^{0}$};")));
  assert.ok(labels.some((command) => command.endsWith("{$2^{2}$};")));
  assert.ok(labels.some((command) => command.endsWith("{$2^{4}$};")));
  assert.ok(labels.some((command) => command.endsWith("{$2^{6}$};")));
  assert.equal(commands.some((command) => command.includes("axis tick scale label")), false);
});

test("three-dimensional z logarithms map equal powers to equal projected gaps", () => {
  const options = {
    zmode: "log",
    "log basis z": 2,
    view: "{35}{25}",
    width: "10cm",
    height: "7cm",
    "pgfplots 3d surface": true
  };
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 1, zMax: 16 };
  const geometry = createAxisGeometry(options, ranges);
  const points = [1, 2, 4, 8, 16].map((z) => geometry.mapPoint3d({ x: 0, y: 0, z }));
  const gaps = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.01);
});

test("default surface colors use the transformed logarithmic z coordinate", () => {
  const color = pgfplotsSurfaceColor(10, { zMin: 1, zMax: 100 }, 0, { zmode: "log" });
  assert.equal(color, "rgb(255,192,0)");
});

test("addplot3 drops non-positive z coordinates before painting", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\begin{document}
\begin{tikzpicture}
\begin{axis}[zmode=log,log basis z=2,zmin=1,zmax=16]
  \addplot3[mark=*] coordinates {(0,0,0) (1,0,1) (2,0,2) (3,0,4) (4,0,8) (5,0,16)};
\end{axis}
\end{tikzpicture}
\end{document}`);
  assert.equal(diagnostics.length, 0);
  const plot = ir.items.find((item) => item.semanticRole === "axis-plot" || item.subtype === "axis-plot");
  const points = plot.commands.filter((command) => command.type === "moveTo" || command.type === "lineTo");
  assert.equal(points.length, 5);
});
