import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);

function renderFixture(name) {
  const source = readFileSync(new URL(`${name}.tex`, FIXTURE_ROOT), "utf8");
  return tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
}

test("case 001: 2048 preserves the complete 4x4 board contract", () => {
  const result = renderFixture("2048");
  const nodeBoxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const background = nodeBoxes.find((item) => !item.id);
  const tiles = nodeBoxes.filter((item) => item.id?.startsWith("c2048-"));
  const tileText = result.ir.items.filter((item) => item.type === "textNode" && item.text !== "");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(tiles.length, 16);
  assert.equal(result.ir.items.indexOf(background), 0, "background layer should paint before every tile");
  assert.deepEqual(
    [background.x, background.y, background.width, background.height, background.style.fill],
    [2.500000000001, -2.499999999999, 4.114058392143, 4.114058392143, "#BBADA0"]
  );

  for (let row = 1; row <= 4; row += 1) {
    for (let column = 1; column <= 4; column += 1) {
      const tile = tiles.find((item) => item.id === `c2048-${column}-${row}`);
      assert.ok(tile, `missing tile ${column},${row}`);
      assert.deepEqual([tile.x, tile.y, tile.width, tile.height], [column, -row, 0.9, 0.9]);
    }
  }

  assert.deepEqual(
    tiles.map((item) => item.style.fill),
    [
      "#CCC0B3", "#EEE4DA", "#F67C5F", "#F65E3B",
      "#EDCC61", "#F2B179", "#EDC850", "#EDE0C8",
      "#EDC53F", "#EDC22E", "#EDE0C8", "#F59563",
      "#3E3933", "#F59563", "#EDCF72", "#EEE4DA"
    ]
  );
  assert.deepEqual(
    tileText.map((item) => item.text),
    ["2", "32", "64", "256", "8", "512", "4", "1024", "2048", "4", "16", "4096", "16", "128", "2"]
  );
  assert.deepEqual(
    tileText.map((item) => item.font.sizePt),
    [14.4, 14.4, 14.4, 12, 14.4, 12, 14.4, 10, 10, 14.4, 14.4, 10, 14.4, 12, 14.4]
  );
  assert.ok(tileText.every((item) => item.font.family === "sans-serif" && item.font.weight === 700));
});

test("case 002: chi-squared CDF preserves raw-gnuplot curves and cycle styles", () => {
  const result = renderFixture("2d-chi-squared-cdf");
  const plots = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-plot");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 6);
  assert.deepEqual(
    plots.map((item) => item.style.stroke),
    ["rgb(255 242 0)", "#00dd00", "#00cccc", "blue", "#aa00aa", "red"]
  );
  assert.deepEqual(plots.map((item) => item.commands.length), [61, 800, 800, 800, 535, 396]);
  assert.deepEqual(
    plots.map((item) => item.style.dashArray || []),
    [
      [],
      [10.543794107480464, 7.029196071653643],
      [10.543794107480464, 10.543794107480464],
      [4.217517642992186, 3.5145980358268214],
      [4.217517642992186, 7.029196071653643],
      [4.217517642992186, 14.058392143307286]
    ]
  );
  assert.ok(plots.every((item) => item.style.lineWidth === 4.217517642992186));
  assert.ok(plots.every((item) => !item.style.markerStart && !item.style.markerEnd));
  for (const text of ["$x$", "$F_k(x)$", "$\\chi^2_k$", "$k = 1$", "$k = 2$", "$k = 3$", "$k = 4$", "$k = 6$", "$k = 9$"]) {
    assert.ok(labels.includes(text), `missing axis or legend label ${text}`);
  }
});

test("case 003: chi-squared PDF preserves conditional raw-gnuplot sampling", () => {
  const result = renderFixture("2d-chi-squared-pdf");
  const plots = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-plot");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 6);
  assert.deepEqual(
    plots.map((item) => item.style.stroke),
    ["rgb(255 242 0)", "#00dd00", "#00cccc", "blue", "#aa00aa", "red"]
  );
  assert.deepEqual(plots.map((item) => item.commands.length), [758, 800, 800, 800, 800, 800]);
  assert.ok(plots.every((item) => item.style.lineWidth === 4.217517642992186));
  assert.ok(plots.every((item) => !item.style.markerStart && !item.style.markerEnd));
  for (const text of ["$x$", "$f_k(x)$", "$\\chi^2_k$", "$k = 1$", "$k = 2$", "$k = 3$", "$k = 4$", "$k = 6$", "$k = 9$"]) {
    assert.ok(labels.includes(text), `missing axis or legend label ${text}`);
  }
});

test("case 004: epochs overfitting preserves plot joins, annotation, and axis contract", () => {
  const result = renderFixture("2d-epochs-overfitting");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const plots = paths.filter((item) => item.subtype === "axis-plot");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const annotation = labels.find((item) => item.subtype === "decoration-text");
  const largeArrow = paths.find((item) => item.style.markerEnd?.kind === "latex");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 4);
  assert.deepEqual(plots.map((item) => item.commands.length), [200, 200, 200, 200]);
  assert.deepEqual(plots.map((item) => item.style.stroke), ["#0072B2", "#009E73", "#0072B2", "#009E73"]);
  assert.deepEqual(
    plots.map((item) => item.style.dashArray || []),
    [[10.543794107480464, 10.543794107480464], [], [10.543794107480464, 10.543794107480464], []]
  );
  assert.ok(plots.every((item) => item.style.lineWidth === 2.811678428661457));
  assert.equal(paths.filter((item) => item.subtype === "axis-minor-tick").length, 29);

  assert.ok(annotation);
  assert.deepEqual([annotation.text, annotation.x, annotation.y, annotation.rotation], ["overfitting", 8.4185, 1.048, 0]);
  assert.ok(largeArrow);
  assert.equal(largeArrow.style.lineWidth, 4.217517642992186);
  assert.ok(largeArrow.style.markerEnd.length > 31 && largeArrow.style.markerEnd.width > 31);

  for (const text of ["Epochs", "Error", "Training set", "Validation set"]) {
    assert.ok(labels.some((item) => item.text === text), `missing axis, annotation, or legend label ${text}`);
  }
});

test("case 005: light-bulb amortization preserves reciprocal curves and legend styles", () => {
  const result = renderFixture("2d-light-bulb");
  const plots = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-plot");
  const labels = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 3);
  assert.deepEqual(plots.map((item) => item.commands.length), [200, 200, 200]);
  assert.deepEqual(plots.map((item) => item.style.stroke), ["red", "rgb(0 255 0)", "blue"]);
  assert.deepEqual(
    plots.map((item) => item.style.dashArray || []),
    [[], [10.543794107480464, 10.543794107480464], [1.4058392143307286, 7.029196071653643]]
  );
  assert.deepEqual(
    plots.map((item) => [item.commands[0].y, item.commands.at(-1).y]),
    [[1.834, 0.092], [3.668, 0.183], [6.113, 0.306]]
  );
  assert.equal(result.ir.items.filter((item) => item.subtype === "axis-minor-tick").length, 33);

  for (const text of [
    "Energy savings",
    "Amortization time in h",
    "1.50 EUR and 0.30 EUR/kWh",
    "3.00 EUR and 0.30 EUR/kWh",
    "5.00 EUR and 0.30 EUR/kWh"
  ]) {
    assert.ok(labels.some((item) => item.text === text), `missing axis or legend label ${text}`);
  }
});

test("case 006: parted function preserves all six domains and continuous joins", () => {
  const result = renderFixture("2d-parted-function");
  const plots = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-plot");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(plots.length, 6);
  assert.deepEqual(plots.map((item) => item.commands.length), [20, 20, 500, 20, 3, 3]);
  assert.deepEqual(
    plots.map((item) => item.style.stroke),
    ["red", "rgb(0 255 0)", "blue", "rgb(191 0 64)", "rgb(255 128 0)", "rgb(255 128 0)"]
  );
  assert.ok(plots.every((item) => item.style.lineWidth === 2.811678428661457));
  for (let index = 0; index < 4; index += 1) {
    assert.deepEqual(
      [plots[index].commands.at(-1).x, plots[index].commands.at(-1).y],
      [plots[index + 1].commands[0].x, plots[index + 1].commands[0].y],
      `piece ${index + 1} should join piece ${index + 2}`
    );
  }
  assert.deepEqual(
    [plots[5].commands.at(-1).x, plots[5].commands.at(-1).y],
    [plots[0].commands[0].x, plots[0].commands[0].y]
  );
  assert.ok(labels.includes("$x$") && labels.includes("$y$"));
});

test("case 007: x-square circle preserves translated points and unshifted axis vectors", () => {
  const result = renderFixture("2d-x-square-with-circle");
  const plot = result.ir.items.find((item) => item.type === "path" && item.subtype === "axis-plot");
  const ellipse = result.ir.items.find((item) => item.type === "path" && item.shape === "ellipse" && item.style.stroke === "blue");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(plot);
  assert.deepEqual([plot.commands.length, plot.style.stroke, plot.style.lineWidth], [50, "red", 2.811678428661457]);
  assert.ok(ellipse);
  assert.deepEqual(
    [ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry, ellipse.commands.length],
    [3.427, 2.583, 1.656, 1.835, 6]
  );
  assert.deepEqual(ellipse.clipRect, { minX: 0, minY: 0, maxX: 6.853, maxY: 5.694 });
  assert.deepEqual([ellipse.style.stroke, ellipse.style.fill, ellipse.style.lineWidth], ["blue", "none", 2.811678428661457]);
});

test("case 008: CMOS loss surface preserves log-axis sampling and faceted opacity", () => {
  const result = renderFixture("3d-cmos-loss-diagram");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 4050);
  assert.equal(fills.length, 2025);
  assert.equal(facets.length, 2025);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 0.9));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));
  for (const text of ["$10^{8}$", "$10^{9}$", "$\\cdot 10^{10}$", "$V_{dd}$ in V", "$f$ in Hz", "$P_v$ in mW"]) {
    assert.ok(labels.includes(text), `missing logarithmic tick or axis label ${text}`);
  }
});

test("case 009: quadratic surface preserves the 56 by 56 mesh and colorbar contract", () => {
  const result = renderFixture("3d-function-2");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 6050);
  assert.equal(fills.length, 3025);
  assert.equal(facets.length, 3025);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));
  assert.deepEqual(
    [fills[0].style.fill, facets.at(-1).style.stroke],
    ["rgb(255 101.706419 9.151804)", "rgb(204,81,7)"]
  );
  for (const text of ["-5", "5", "10", "20", "30", "40", "50", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.includes(text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 010: rational saddle preserves singular sampling and the rotated 3D view", () => {
  const result = renderFixture("3d-function-3");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 6050);
  assert.equal(fills.length, 3025);
  assert.equal(facets.length, 3025);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));
  for (const text of ["-5", "5", "-1", "-0.5", "0", "0.5", "1", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.includes(text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 011: normalized saddle preserves its finite 56 by 56 surface", () => {
  const result = renderFixture("3d-function-4");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 6050);
  assert.equal(fills.length, 3025);
  assert.equal(facets.length, 3025);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));
  for (const text of ["-5", "0", "5", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.includes(text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 012: radial cone preserves its 56 by 56 faceted surface", () => {
  const result = renderFixture("3d-function-5");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 6050);
  assert.equal(fills.length, 3025);
  assert.equal(facets.length, 3025);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));
  for (const text of ["-5", "0", "5", "2", "4", "6", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.includes(text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 013: three-lobed rational surface preserves its signed topology", () => {
  const result = renderFixture("3d-function-6");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 6050);
  assert.equal(fills.length, 3025);
  assert.equal(facets.length, 3025);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));
  for (const text of ["-5", "0", "5", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.includes(text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 014: quartic rational surface preserves asymmetric domains and exact bounds", () => {
  const result = renderFixture("3d-function-7");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 6050);
  assert.equal(fills.length, 3025);
  assert.equal(facets.length, 3025);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));
  for (const text of ["-4", "-2", "0", "2", "4", "5", "-1", "1", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.includes(text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 015: small-amplitude radial surface remains inside its projected 3D box", () => {
  const result = renderFixture("3d-function-8");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const frame = result.ir.items.filter((item) => item.subtype === "axis-line").slice(0, 6);
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const labels = textNodes.map((item) => item.text);
  const commandPoints = (items) => items.flatMap((item) => item.commands || []).filter((command) =>
    Number.isFinite(command.x) && Number.isFinite(command.y)
  );
  const surfacePoints = commandPoints(surface);
  const framePoints = commandPoints(frame);
  const surfaceBounds = {
    minX: Math.min(...surfacePoints.map((point) => point.x)),
    maxX: Math.max(...surfacePoints.map((point) => point.x)),
    minY: Math.min(...surfacePoints.map((point) => point.y)),
    maxY: Math.max(...surfacePoints.map((point) => point.y))
  };
  const frameBounds = {
    minX: Math.min(...framePoints.map((point) => point.x)),
    maxX: Math.max(...framePoints.map((point) => point.x)),
    minY: Math.min(...framePoints.map((point) => point.y)),
    maxY: Math.max(...framePoints.map((point) => point.y))
  };

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 4802);
  assert.equal(fills.length, 2401);
  assert.equal(facets.length, 2401);
  assert.ok(surfaceBounds.minX >= frameBounds.minX - 0.001);
  assert.ok(surfaceBounds.maxX <= frameBounds.maxX + 0.001);
  assert.ok(surfaceBounds.minY >= frameBounds.minY - 0.001);
  assert.ok(surfaceBounds.maxY <= frameBounds.maxY + 0.001);
  const colorbarScale = textNodes
    .filter((item) => item.text === "$\\cdot 10^{-2}$")
    .sort((left, right) => left.y - right.y)[0];
  const colorbarTopTick = textNodes.find((item) => item.text === "1.75");
  const colorbarTitle = textNodes.find((item) => item.text === "$f(x,y)$");
  assert.ok(colorbarScale.x < colorbarTopTick.x, "colorbar scale label should sit left of its top tick label");
  assert.ok(
    colorbarTitle.y - colorbarScale.y >= 0.24,
    "colorbar title should preserve the native baseline clearance above the scale label"
  );
  for (const text of ["-5", "5", "1.55", "1.6", "1.65", "1.7", "1.75", "$\\cdot 10^{-2}$", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.includes(text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 016: sinusoidal ridge preserves its 50 by 50 mesh and measured 3D labels", () => {
  const result = renderFixture("3d-function-9");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 4802);
  assert.equal(fills.length, 2401);
  assert.equal(facets.length, 2401);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));

  const axisLabels = Object.fromEntries(
    labels
      .filter((item) => ["$x$", "$y$", "$z$"].includes(item.text))
      .map((item) => [item.text, item])
  );
  assert.deepEqual(Object.keys(axisLabels).sort(), ["$x$", "$y$", "$z$"]);
  assert.equal(axisLabels["$z$"].rotation, 90);
  assert.ok(axisLabels["$x$"].x < 2, "x label should follow the oblique tick-label edge midpoint");
  assert.ok(axisLabels["$y$"].x > 9, "y label should clear the longest projected tick labels");
  assert.ok(axisLabels["$z$"].x > -0.9, "z label should use its rotated near-ticklabel box");

  for (const text of ["-5", "5", "-4", "-2", "0", "2", "4", "$x$", "$y$", "$z$", "$f(x,y)$"]) {
    assert.ok(labels.some((item) => item.text === text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("case 017: continuous rational surface preserves its 55 by 55 mesh and colorbar", () => {
  const result = renderFixture("3d-function-continuous");
  const surface = result.ir.items.filter((item) => item.subtype === "axis-surface");
  const fills = surface.filter((item) => item.style.fill !== "none");
  const facets = surface.filter((item) => item.style.fill === "none");
  const labels = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(surface.length, 5832);
  assert.equal(fills.length, 2916);
  assert.equal(facets.length, 2916);
  assert.ok(surface.every((item) => item.commands.length === 5 && item.style.opacity === 1));
  assert.ok(fills.every((item) => item.style.stroke === "none"));
  assert.ok(facets.every((item) => item.style.stroke !== "none"));

  const axisLabels = Object.fromEntries(
    labels
      .filter((item) => ["$x$", "$y$", "$z$"].includes(item.text))
      .map((item) => [item.text, item])
  );
  assert.deepEqual(Object.keys(axisLabels).sort(), ["$x$", "$y$", "$z$"]);
  assert.equal(axisLabels["$z$"].rotation, 90);
  for (const text of ["-2", "-1", "0", "1", "2", "-0.5", "0.5", "$f(x,y)$"]) {
    assert.ok(labels.some((item) => item.text === text), `missing surface tick, axis, or colorbar label ${text}`);
  }
});

test("severe-gap acceptance: inverse-function keeps unaligned node text in one TeX hbox", () => {
  const result = renderFixture("inverse-function");
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const ordinaryText = result.ir.items
    .filter((item) => item.type === "textNode" && !item.subtype && item.text)
    .map((item) => item.text);
  const decorationText = result.ir.items
    .filter((item) => item.type === "textNode" && item.subtype === "decoration-text")
    .map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(ordinaryText, ["123", "abc"]);
  assert.equal(boxes.length, 2);
  assert.ok(boxes.every((box) => Math.abs(box.height - 0.702919607165) < 1e-9));
  assert.ok(boxes.every((box) => Math.abs(box.width - 2.811678428661) < 1e-9));
  assert.deepEqual(decorationText, ["Aktion {$a_k$}", "Zustand {$x_k$}"]);
  assert.equal(result.ir.items.filter((item) => item.type === "path").length, 2);
});
