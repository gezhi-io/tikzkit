import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisTicks } from "../src/pgfplots/ticks.js";

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
  assert.match(commands[0], /minimum width=24\.066pt/);
  assert.match(commands[0], /minimum height=21\.722pt/);
  assert.match(commands[0], /tikzkit layout bbox x padding=1\.654pt/);
  assert.match(commands[0], /tikzkit layout bbox bottom padding=1\.125pt/);
  assert.match(commands[0], /at \(0,0\)/);
  assert.match(commands[1], /minimum width=32\.566pt/);
  assert.match(commands[1], /minimum height=21\.722pt/);
  assert.doesNotMatch(commands.join("\n"), /(?:x padding=2\.36|bottom padding=3)pt/);
});

test("electric vehicles fixture renders both multiline x tick rows without diagnostics", () => {
  const source = readFileSync(fixtureUrl, "utf8");
  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, />2012</);
  assert.match(result.svg, />2956</);
  assert.match(result.svg, />2023</);
  assert.match(result.svg, />524219</);
});
