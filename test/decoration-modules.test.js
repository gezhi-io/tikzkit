import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import * as morphing from "../src/tikz/libraries/decorations.pathmorphing.js";
import * as replacing from "../src/tikz/libraries/decorations.pathreplacing.js";
import * as snakes from "../src/tikz/libraries/snakes.js";
import * as fractals from "../src/tikz/libraries/decorations.fractals.js";

const commands = [
  { type: "moveTo", x: 0, y: 0 },
  { type: "lineTo", x: 3, y: 0 },
  { type: "lineTo", x: 3, y: 2 }
];
const sourcePath = "(0,0) -- (3,0) -- (3,2)";

function interpretedPath(options) {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \draw[blue,${options}] ${sourcePath};
  \end{tikzpicture}`, { mathRenderer: "svg-text", fontUrlPrefix: "/fonts/" });
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.find((item) => item.type === "path" && item.style.stroke === "blue").commands;
}

test("library modules own executable decoration behavior, not just descriptors", () => {
  for (const [module, functions] of [
    [morphing, ["applyPathMorphingDecoration"]],
    [replacing, ["applyBraceDecoration", "applyTicksDecoration", "applyBorderDecoration", "applyWavesDecoration"]],
    [snakes, ["legacySnakeSpec", "applyLegacySnakePath"]],
    [fractals, ["applyKochSnowflakeDecoration"]]
  ]) {
    for (const name of functions) assert.equal(typeof module[name], "function", name);
  }
  const evaluator = readFileSync(new URL("../src/engine/evaluate.js", import.meta.url), "utf8");
  assert.doesNotMatch(evaluator, /function (?:appendNative\w+Polyline|applyBraceDecoration|flattenDecorationPath|legacySnakeSpec)\(/);
});

for (const mode of ["snake", "zigzag", "straight zigzag", "coil", "saw", "bumps", "bent", "random steps"]) {
  test(`isolated ${mode} geometry matches interpreter dispatch without mutating input`, () => {
    const original = structuredClone(commands);
    const decoration = {
      [mode]: true, "segment length": "8mm", amplitude: "2mm",
      "pre length": "1mm", "post length": "2mm", mirror: true, raise: "1pt"
    };
    const env = { variables: {} };
    const actual = morphing.applyPathMorphingDecoration(commands, decoration, env);
    assert.deepEqual(commands, original);
    assert.deepEqual(env, { variables: {} });
    assert.deepEqual(actual, interpretedPath(`decorate,decoration={${mode},segment length=8mm,amplitude=2mm,pre length=1mm,post length=2mm,mirror,raise=1pt}`));
  });
}

for (const [mode, name] of [
  ["brace", "applyBraceDecoration"], ["ticks", "applyTicksDecoration"],
  ["border", "applyBorderDecoration"], ["waves", "applyWavesDecoration"],
  ["expanding waves", "applyWavesDecoration"]
]) {
  test(`isolated ${mode} replacement matches interpreter dispatch`, () => {
    const original = structuredClone(commands);
    const decoration = { [mode]: true, "segment length": "8mm", amplitude: "2mm", mirror: true, raise: "1pt" };
    const actual = replacing[name](commands, decoration, { variables: {} });
    assert.deepEqual(commands, original);
    assert.deepEqual(actual, interpretedPath(`decorate,decoration={${mode},segment length=8mm,amplitude=2mm,mirror,raise=1pt}`));
  });
}

test("legacy snake and Koch replacement retain their separate entry points", () => {
  const spec = snakes.legacySnakeSpec({ snake: "snake", "segment length": "8mm", "gap before snake": "1mm" }, { variables: {} });
  assert.deepEqual(snakes.applyLegacySnakePath(commands, spec), interpretedPath("snake=snake,segment length=8mm,gap before snake=1mm"));
  assert.deepEqual(fractals.applyKochSnowflakeDecoration(commands), interpretedPath("decorate,decoration={Koch snowflake}"));
});

test("decoration settings alone do not decorate the path", () => {
  assert.deepEqual(interpretedPath("decoration={snake,amplitude=2mm}"), commands);
  assert.deepEqual(morphing.applyPathMorphingDecoration(commands, { unknown: true }, { variables: {} }), commands);
});
