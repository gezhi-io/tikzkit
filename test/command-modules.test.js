import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  addplotCommand,
  axisCommand,
  chaininCommand,
  drawCommand,
  fillCommand,
  foreachCommand,
  knownTikzCommands,
  nodeCommand,
  tikzCommandCatalog,
  tikzpictureCommand
} from "../src/tikz/commands/index.js";
import { foreachIterationVariables } from "../src/tikz/commands/foreach.js";
import { drawCommand as compatDrawCommand } from "../src/commands/index.js";

const OBSERVED_TIKZ_COMMANDS = ["tikzpicture", "draw", "fill", "path", "node", "chainin", "coordinate", "foreach", "axis", "addplot"];

test("keeps common TikZ commands in one module per command or environment", () => {
  assert.deepEqual(knownTikzCommands, OBSERVED_TIKZ_COMMANDS);
  for (const command of OBSERVED_TIKZ_COMMANDS) {
    assert.equal(
      existsSync(path.resolve("src", "tikz", "commands", `${command}.js`)),
      true,
      `missing src/tikz/commands/${command}.js`
    );
  }

  assert.equal(tikzCommandCatalog.draw.kind, "command");
  assert.equal(tikzCommandCatalog.fill.kind, "command");
  assert.equal(tikzCommandCatalog.chainin.kind, "command");
  assert.equal(chaininCommand.name, "chainin");
  assert.equal(tikzCommandCatalog.foreach.kind, "command");
  assert.equal(tikzCommandCatalog.axis.kind, "environment");
  assert.equal(tikzCommandCatalog.addplot.package, "pgfplots");
});

test("keeps legacy src/commands imports as compatibility adapters", () => {
  assert.equal(compatDrawCommand.name, "draw");
  assert.equal(existsSync(path.resolve("src", "commands", "draw.js")), true);
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
  assert.ok(optionNamesFor(fillCommand).includes("fill"));
  assert.ok(optionNamesFor(foreachCommand).includes("\\foreach \\x in {...} { ... }"));

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

test("foreach command module owns loop variable binding semantics", () => {
  const iterations = foreachIterationVariables(
    {
      variables: ["x", "label"],
      values: ["1/A", "3/B"],
      options: {
        count: "\\i from 0",
        evaluate: "\\x as \\next using {int(\\x+1)}"
      }
    },
    { variables: { base: 10 } }
  );

  assert.deepEqual(iterations.map((entry) => entry.variables.x), ["1", "3"]);
  assert.deepEqual(iterations.map((entry) => entry.variables.label), ["A", "B"]);
  assert.deepEqual(iterations.map((entry) => entry.variables.i), [0, 1]);
  assert.deepEqual(iterations.map((entry) => entry.variables.next), [2, 4]);
});

function optionNamesFor(command) {
  return command.options.map((option) => option.name);
}
