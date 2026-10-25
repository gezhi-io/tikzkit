import assert from "node:assert/strict";
import test from "node:test";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";
import { renderAxisSurfacePlot, renderAxisParametricSurfacePlot } from "../src/pgfplots/surface.js";
import { samplePgfplotsSurfaceDomain } from "../src/pgfplots/sampling.js";

const common = { "pgfplots 3d surface": true, enlargelimits: "false", samples: 5 };
const surface = expression => ({ type: "function", is3d: true, expression, options: { surf: true } });

test("CMOS surface discards the complete zero-y log sample during survey", () => {
  const ranges = computeAxisRanges({ ...common, ymode: "log", domain: "1.5:6", "y domain": "0:1e9", samples: 46 },
    [surface("x*x*y")], { enlargeZ: false });
  // Independent MacTeX FPU survey, not the ideal real-number endpoints.
  // The JS arithmetic still differs below one part per million.
  assert.ok(Math.abs(ranges.zMin / 49997234 - 1) < 1e-6, String(ranges.zMin));
  assert.ok(Math.abs(ranges.zMax / 35998011500 - 1) < 1e-6, String(ranges.zMax));
});

test("surface step division follows the native normalized FPU mantissas", () => {
  // SAMPLE records in pgfplots-log-surface-metrics.tex.
  for (const [start, end, count, second, last] of [
    [1.5, 6, 46, 1.6, 6], [0, 1e9, 46, 22221000, 999945000],
    [-5, 5, 25, -4.58334, 4.99984]
  ]) {
    const samples = samplePgfplotsSurfaceDomain({ start, end }, count);
    assert.equal(samples[1], second);
    assert.equal(samples.at(-1), last);
  }
});

test("log-surface colors average transformed vertex meta like native PGF", () => {
  const options = { ...common, zmode: "log", domain: "-2:2", "y domain": "-2:2" };
  const plot = surface("x+y");
  const commands = renderAxisSurfacePlot(plot, options, computeAxisRanges(options, [plot]),
    { mapPoint3d: p => ({ x: p.x, y: p.y + p.z * .1 }) }, {});
  // Native log-surface-z.svg: (59.550476%,59.550476%,40.447998%),
  // (75.135803%,75.135803%,24.862671%), (100%,82.653809%,0%),
  // (100%,63.86261%,0%), rounded to RGB8. Keep the same one-byte bound
  // while accepting fractional CSS channels from native fixed-point lookup.
  const fills = commands.filter(command => command.includes("axis surface fill"))
    .map(command => command.match(/fill=rgb\(([^)]+)\)/)?.[1].split(/[,\s]+/).map(Number));
  assert.equal(fills.length, 4);
  for (const rgb of [[152, 152, 103], [192, 192, 63], [255, 211, 0], [255, 163, 0]])
    assert.ok(fills.some(fill => fill?.every((channel, i) => Math.abs(channel - rgb[i]) <= 1)), String(rgb));
});

test("invalid logarithmic coordinates cannot contribute other surface limits", () => {
  for (const axis of ["x", "y", "z"]) {
    const options = { ...common, [`${axis}mode`]: "log", domain: "-2:2", "y domain": "-2:2" };
    const functionPlot = surface("x+y");
    const parametric = { type: "parametric", is3d: true, options: { surf: true },
      xExpression: "x", yExpression: "y", zExpression: "x+y" };
    const expected = computeAxisRanges(options, [parametric], { enlargeZ: false });
    assert.deepEqual(computeAxisRanges(options, [functionPlot], { enlargeZ: false }), expected, axis);
  }
});

test("nondegenerate log ranges narrower than a decade keep their limits", () => {
  for (const axis of ["x", "y"]) {
    const options = { ...common, [`${axis}mode`]: "log", domain: "1:2", "y domain": "1:2" };
    const ranges = computeAxisRanges(options, [surface("x+y")], { enlargeZ: false });
    assert.equal(ranges[`${axis}Min`], 1);
    assert.equal(ranges[`${axis}Max`], 2);
  }
});

test("discarded log samples retain native mesh column count instead of making holes", () => {
  const options = { ...common, xmode: "log", domain: "-2:2", "y domain": "-2:2", "z buffer": "none" };
  const plot = surface("x+y");
  const ranges = computeAxisRanges(options, [plot]);
  const geometry = { mapPoint3d: p => ({ x: p.x, y: p.y + p.z * .1 }) };
  // pgfplotscoordprocessing drops invalid points before serialization;
  // pgfplotsmeshplothandler keeps the original five-column scanline.
  const expected = [
    "(1,-2.1) -- (2,-2) -- (1,1.2) -- (2,0.2)",
    "(2,-2) -- (1,-1) -- (2,1.3) -- (1,1.2)",
    "(1,-1) -- (2,-0.9) -- (1,2.3) -- (2,1.3)",
    "(2,-0.9) -- (1,0.1) -- (2,2.4) -- (1,2.3)"
  ];
  const parametric = { ...plot, type: "parametric", xExpression: "x", yExpression: "y", zExpression: "x+y" };
  for (const commands of [renderAxisSurfacePlot(plot, options, ranges, geometry, {}),
    renderAxisParametricSurfacePlot(parametric, options, ranges, geometry, {})]) {
    const paths = commands.filter(command => command.includes("axis surface fill"));
    assert.equal(paths.length, 4);
    for (const path of expected) assert.ok(paths.some(command => command.includes(path)), path);
  }
  const jump = renderAxisSurfacePlot(plot, { ...options, "unbounded coords": "jump" }, ranges, geometry, {});
  assert.ok(jump.some(command => command.includes("(1,-2.1) -- (2,-2) -- (2,-0.9) -- (1,-1)")),
    "jump must retain holes in the original matrix");
});
