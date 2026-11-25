import test from "node:test";
import assert from "node:assert/strict";

import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisLabels } from "../src/pgfplots/labels.js";
import { parseStatements } from "../src/frontend/parser.js";

function assertLabel(commands, text, anchor, point) {
  const node = parseStatements(commands.join("\n")).find(n => n.text === text);
  assert.equal(node?.options.anchor, anchor);
  const actual = node.at.split(",").map(Number);
  for (const [i, key] of ["x", "y"].entries()) assert.ok(Math.abs(actual[i] - point[key]) <= .0000005);
}

const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };

function renderLabels(overrides = {}) {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    width: "8cm",
    height: "8cm",
    xmin: "-5",
    xmax: "5",
    ymin: "-5",
    ymax: "5",
    enlargelimits: "false",
    xlabel: "$x$",
    ylabel: "$y$",
    ...overrides
  };
  const geometry = createAxisGeometry(axisOptions, ranges);
  return { geometry, commands: renderAxisLabels(axisOptions, ranges, geometry) };
}

test("PGFPlots middle labels anchor exactly at ticklabel* cs:1", () => {
  const { geometry, commands } = renderLabels();
  const xTip = geometry.mapPoint({ x: geometry.lineRanges.xMax, y: 0 });
  const yTip = geometry.mapPoint({ x: 0, y: geometry.lineRanges.yMax });

  assertLabel(commands, "$x$", "south east", xTip);
  assertLabel(commands, "$y$", "north west", yTip);
});

test("PGFPlots legacy outside ticks do not move middle-axis terminal labels beyond current axis anchors", () => {
  const { geometry, commands } = renderLabels({ "tick align": "outside" });
  const xTip = geometry.mapPoint({ x: geometry.lineRanges.xMax, y: 0 });
  const yTip = geometry.mapPoint({ x: 0, y: geometry.lineRanges.yMax });

  assertLabel(commands, "$x$", "south east", xTip);
  assertLabel(commands, "$y$", "north west", yTip);
});

test("PGFPlots applies near-ticklabel placement to each middle axis independently", () => {
  const xOnly = renderLabels({ "axis y line": "left" });
  const xTip = xOnly.geometry.mapPoint({ x: xOnly.geometry.lineRanges.xMax, y: 0 });
  assertLabel(xOnly.commands, "$x$", "south east", xTip);

  const yOnly = renderLabels({ "axis x line": "bottom" });
  const yTip = yOnly.geometry.mapPoint({ x: 0, y: yOnly.geometry.lineRanges.yMax });
  assertLabel(yOnly.commands, "$y$", "north west", yTip);
});

test("explicit axis description coordinates override middle-axis defaults", () => {
  const { geometry, commands } = renderLabels({
    xlabel: "$x$",
    ylabel: "$f(x)$",
    "x label style": "at={(axis description cs:0.5,0)},anchor=north",
    "y label style": "at={(axis description cs:0,0.5)},anchor=south,rotate=90"
  });
  assertLabel(commands, "$x$", "north", { x: geometry.origin.x + geometry.width * .5, y: 0 });
  assertLabel(commands, "$f(x)$", "south", { x: 0, y: geometry.origin.y + geometry.height * .5 });
});
