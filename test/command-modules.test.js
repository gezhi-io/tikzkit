import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  addplotCommand,
  axisCommand,
  drawCommand,
  knownTikzCommands,
  nodeCommand,
  tikzCommandCatalog,
  tikzpictureCommand
} from "../src/commands/index.js";

const OBSERVED_TIKZ_COMMANDS = ["tikzpicture", "draw", "path", "node", "coordinate", "axis", "addplot"];

test("keeps common TikZ commands in one module per command or environment", () => {
  assert.deepEqual(knownTikzCommands, OBSERVED_TIKZ_COMMANDS);
  for (const command of OBSERVED_TIKZ_COMMANDS) {
    assert.equal(
      existsSync(path.resolve("src", "commands", `${command}.js`)),
      true,
      `missing src/commands/${command}.js`
    );
  }

  assert.equal(tikzCommandCatalog.draw.kind, "command");
  assert.equal(tikzCommandCatalog.axis.kind, "environment");
  assert.equal(tikzCommandCatalog.addplot.package, "pgfplots");
});

test("documents the user-facing tikzpicture style options", () => {
  const optionNames = optionNamesFor(tikzpictureCommand);
  assert.ok(optionNames.includes(">=Stealth"));
  assert.ok(optionNames.includes("font=\\tt"));
  assert.ok(optionNames.includes("name/.style={...}"));
  assert.ok(optionNames.includes("node distance"));
});

test("documents draw and node option families that drive visual parity", () => {
  assert.ok(optionNamesFor(drawCommand).includes("thin / thick / very thick / line width"));
  assert.ok(optionNamesFor(drawCommand).includes("dashed / densely dashed / dotted / dash pattern"));
  assert.ok(optionNamesFor(drawCommand).includes("-> / -latex / -Stealth / stealth-stealth"));
  assert.ok(optionNamesFor(drawCommand).includes("node[midway, above] {text}"));

  assert.ok(optionNamesFor(nodeCommand).includes("circle / rectangle / ellipse / diamond"));
  assert.ok(optionNamesFor(nodeCommand).includes("minimum size / minimum width / minimum height"));
  assert.ok(optionNamesFor(nodeCommand).includes("inner sep / outer sep"));
  assert.ok(optionNamesFor(nodeCommand).includes("right=of / below=of / node distance"));
  assert.ok(optionNamesFor(nodeCommand).includes("anchor / node.north / node.120"));
});

test("documents pgfplots axis and addplot option families", () => {
  assert.ok(optionNamesFor(axisCommand).includes("xmin / xmax / ymin / ymax / domain"));
  assert.ok(optionNamesFor(axisCommand).includes("xtick / ytick / tick distance"));
  assert.ok(optionNamesFor(axisCommand).includes("legend style / legend pos / legend entries"));

  assert.ok(optionNamesFor(addplotCommand).includes("{x} / {-x*ln(x)}"));
  assert.ok(optionNamesFor(addplotCommand).includes("coordinates {(x,y) ...}"));
  assert.ok(optionNamesFor(addplotCommand).includes("domain / samples"));
  assert.ok(optionNamesFor(addplotCommand).includes("color / thick / dashed / mark"));
});

function optionNamesFor(command) {
  return command.options.map((option) => option.name);
}
