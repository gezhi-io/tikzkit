import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("elevation-chart smooth plot overrides the axis ybar handler", async () => {
  const source = await readFile(
    new URL("./fixtures/examples/latex-examples/elevation-chart.tex", import.meta.url),
    "utf8"
  );
  const csv = await readFile(
    new URL("./fixtures/examples/latex-examples/resources/elevation-chart/data.csv", import.meta.url),
    "utf8"
  );
  const { diagnostics, ir } = tikzToSvg(source, {
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => name === "data.csv" ? csv : null
  });

  assert.deepEqual(diagnostics, []);
  const plot = ir.items.find((item) => item.type === "path" && item.subtype === "axis-plot");
  assert.ok(plot, "expected the CSV plot to remain a line plot");
  assert.ok(plot.commands.some((command) => command.type === "curveTo"));
  assert.equal(ir.items.filter((item) => item.subtype === "axis-bar").length, 0);
});
