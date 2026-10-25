import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisTicks } from "../src/pgfplots/ticks.js";
import { assertNativeText } from "./helpers/native-math-svg.js";

const fixtureUrl = new URL(
  "./fixtures/examples/latex-examples/line-chart-electric-vehicles-sold.tex",
  import.meta.url
);

function electricVehicleTickCommands() {
  const axisOptions = {
    width: "14cm",
    height: "9cm",
    xmin: "2012",
    xmax: "2023",
    ymin: "0",
    ymax: "20",
    xtick: "{2012,2023}",
    xticklabels: String.raw`{2012\\2956,2023\\524219}`,
    "xticklabel style": "rotate=0, anchor=north, align=center",
    "tick label style": String.raw`font=\footnotesize`
  };
  const ranges = { xMin: 2012, xMax: 2023, yMin: 0, yMax: 20 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  return renderAxisTicks(axisOptions, [], ranges, geometry).filter(
    (command) => command.includes("2012\\\\2956") || command.includes("2023\\\\524219")
  );
}

test("PGFPlots lowers centered multiline footnotesize tick labels with native TeX node boxes", () => {
  const commands = electricVehicleTickCommands();

  assert.equal(commands.length, 2, commands.join("\n"));
  assert.match(commands[0], /align=center/);
  assert.match(commands[0], /at \(0,0\)/);
  assert.doesNotMatch(commands.join("\n"), /minimum (?:width|height)|bbox (?:x|bottom) padding/);
  const result = tikzToSvg(`\\begin{tikzpicture}${commands.join("\n")}\\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  for (const [text, width] of [[String.raw`2012\\2956`, 24.0662], [String.raw`2023\\524219`, 32.5662]]) {
    const index = result.ir.items.findIndex(item => item.text === text);
    const box = result.ir.items[index - 1];
    assert.equal(box.subtype, "node-layout");
    const points = box.commands.filter(command => "x" in command);
    const span = key => (Math.max(...points.map(p => p[key])) - Math.min(...points.map(p => p[key]))) * 72.27 / 2.54;
    // Native halign + inner sep; outer sep (.2pt each side) is not paint.
    assert.ok(Math.abs(span("x") - (width - 0.4)) < 0.002);
    assert.ok(Math.abs(span("y") - (21.7215 - 0.4)) < 0.002);
  }
});

test("electric vehicles fixture renders both multiline x tick rows without diagnostics", () => {
  const source = readFileSync(fixtureUrl, "utf8");
  for (const mathRenderer of [undefined, "svg-text"]) {
    const result = tikzToSvg(source, { mathRenderer });
    assert.deepEqual(result.diagnostics, []);
    for (const [first, second] of [["2012", "2956"], ["2023", "524219"]]) {
      const group = assertNativeText(result.svg, first + second);
      assert.ok(group.glyphs.every(glyph => glyph.size === 8 && glyph.family === "TikZKitCMR8"));
      assert.equal(new Set(group.glyphs.slice(0, first.length).map(glyph => glyph.y)).size, 1);
      assert.equal(new Set(group.glyphs.slice(first.length).map(glyph => glyph.y)).size, 1);
      assert.ok(Math.abs(group.glyphs[first.length].y - group.glyphs[0].y - 9.5) < 0.001);
    }
  }
});
