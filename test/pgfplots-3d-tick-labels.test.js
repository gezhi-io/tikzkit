import assert from "node:assert/strict";
import test from "node:test";
import { axis3DParentBounds, renderAxis3DTicks } from "../src/pgfplots/axis3d.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2, zMin: 0, zMax: 10 };

function geometryFor(options = {}) {
  return createAxisGeometry(
    { width: "10cm", height: "7cm", view: "{35}{25}", "pgfplots 3d surface": true, ...options },
    ranges
  );
}

function tickLabelCommands(options) {
  return renderAxis3DTicks(options, ranges, geometryFor(options))
    .filter((command) => command.includes("axis tick label"));
}

test("pgfplots 3d axes use positional x, y, and z tick-label lists", () => {
  const commands = tickLabelCommands({
    xtick: "{0,1,2}",
    xticklabels: "{Input,Render,Ship}",
    ytick: "{0,1,2}",
    yticklabels: "{$0$,{$\\pi/2$},{$\\pi$}}",
    ztick: "{0,5,10}",
    zticklabels: "{$0$,,{$10$}}"
  });

  assert.ok(commands.some((command) => command.endsWith("{Input};")));
  assert.ok(commands.some((command) => command.endsWith("{Render};")));
  assert.ok(commands.some((command) => command.endsWith("{Ship};")));
  assert.ok(commands.some((command) => command.endsWith("{$\\pi/2$};")));
  assert.equal(commands.some((command) => command.endsWith("{5};")), false);
  assert.equal(commands.length, 8);
});

test("pgfplots 3d tick-label templates substitute formatted tick values", () => {
  const commands = tickLabelCommands({
    xtick: "{0,1,2}",
    ytick: "{}",
    ztick: "{0,5,10}",
    xticklabel: "$\\pgfmathprintnumber{\\tick}\\,\\mathrm{s}$",
    zticklabel: "$\\pgfmathprintnumber{\\tick}\\,\\mathrm{m\\,s^{-1}}$"
  });

  assert.ok(commands.some((command) => command.endsWith("{$1\\,\\mathrm{s}$};")));
  assert.ok(commands.some((command) => command.endsWith("{$5\\,\\mathrm{m\\,s^{-1}}$};")));
  assert.equal(commands.some((command) => command.includes("\\tick")), false);
});

test("pgfplots 3d tick-label styles preserve explicit rotation and anchor", () => {
  const commands = tickLabelCommands({
    xtick: "{0}",
    ytick: "{}",
    ztick: "{}",
    xticklabels: "{Input stage}",
    "x tick label style": "{rotate=15,anchor=north east,font=\\scriptsize,inner sep=1pt}"
  });

  assert.equal(commands.length, 1);
  assert.match(commands[0], /anchor=north east/);
  assert.match(commands[0], /rotate=15/);
  assert.match(commands[0], /font=.*scriptsize/);
  assert.match(commands[0], /inner sep=1pt/);
});

test("pgfplots 3d parent bounds reserve space for custom labels", () => {
  const compact = { xtick: "{0}", ytick: "{}", ztick: "{}", xticklabels: "{A}" };
  const wide = { xtick: "{0}", ytick: "{}", ztick: "{}", xticklabels: "{A very long pipeline stage}" };
  const compactBounds = axis3DParentBounds(compact, ranges, geometryFor(compact));
  const wideBounds = axis3DParentBounds(wide, ranges, geometryFor(wide));

  assert.ok(wideBounds.width > compactBounds.width + 1);
});
