import test from "node:test";
import assert from "node:assert/strict";

import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisLabels } from "../src/pgfplots/labels.js";

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

  assert.ok(
    commands.includes(
      String.raw`\node[axis label, tikzkit layout bbox, anchor=south east] at (${xTip.x.toFixed(3)},${xTip.y.toFixed(3)}) {$x$};`
    ),
    `xlabel south east anchor must coincide with the positive x-axis endpoint:\n${commands.join("\n")}`
  );
  assert.ok(
    commands.includes(
      String.raw`\node[axis label, tikzkit layout bbox, anchor=north west] at (${yTip.x.toFixed(3)},${yTip.y.toFixed(3)}) {$y$};`
    ),
    `ylabel north west anchor must coincide with the positive y-axis endpoint:\n${commands.join("\n")}`
  );
});

test("PGFPlots legacy outside ticks do not move middle-axis terminal labels beyond current axis anchors", () => {
  const { geometry, commands } = renderLabels({ "tick align": "outside" });
  const xTip = geometry.mapPoint({ x: geometry.lineRanges.xMax, y: 0 });
  const yTip = geometry.mapPoint({ x: 0, y: geometry.lineRanges.yMax });

  assert.ok(
    commands.some((command) => command.includes(`anchor=south east] at (${xTip.x.toFixed(3)},${xTip.y.toFixed(3)}) {$x$}`)),
    `outside ticks must retain the PGFPlots current-axis x terminal:\n${commands.join("\n")}`
  );
  assert.ok(
    commands.some((command) => command.includes(`anchor=north west] at (${yTip.x.toFixed(3)},${yTip.y.toFixed(3)}) {$y$}`)),
    `outside ticks must retain the PGFPlots current-axis y terminal:\n${commands.join("\n")}`
  );
});

test("PGFPlots applies near-ticklabel placement to each middle axis independently", () => {
  const xOnly = renderLabels({ "axis y line": "left" });
  const xTip = xOnly.geometry.mapPoint({ x: xOnly.geometry.lineRanges.xMax, y: 0 });
  assert.ok(
    xOnly.commands.some(
      (command) => command.includes("anchor=south east") && command.includes(`at (${xTip.x.toFixed(3)},${xTip.y.toFixed(3)}) {$x$}`)
    )
  );

  const yOnly = renderLabels({ "axis x line": "bottom" });
  const yTip = yOnly.geometry.mapPoint({ x: 0, y: yOnly.geometry.lineRanges.yMax });
  assert.ok(
    yOnly.commands.some(
      (command) => command.includes("anchor=north west") && command.includes(`at (${yTip.x.toFixed(3)},${yTip.y.toFixed(3)}) {$y$}`)
    )
  );
});

test("explicit axis description coordinates override middle-axis defaults", () => {
  const { geometry, commands } = renderLabels({
    xlabel: "$x$",
    ylabel: "$f(x)$",
    "x label style": "at={(axis description cs:0.5,0)},anchor=north",
    "y label style": "at={(axis description cs:0,0.5)},anchor=south,rotate=90"
  });
  const middleX = (geometry.origin.x + geometry.width * 0.5).toFixed(3).replace(/\.000$/, "");
  const middleY = (geometry.origin.y + geometry.height * 0.5).toFixed(3).replace(/\.000$/, "");

  assert.ok(commands.some((command) => command.includes("anchor=north") && command.includes(`at (${middleX},0) {$x$}`)));
  assert.ok(commands.some((command) => command.includes("anchor=south") && command.includes(`at (0,${middleY}) {$f(x)$}`)));
});
