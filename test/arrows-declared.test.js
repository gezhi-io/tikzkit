import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lowerDeclaredArrowTips } from "../src/tikz/libraries/arrows.js";

const FIXTURE = new URL("./fixtures/examples/arrows/declared-leaf-tip.tex", import.meta.url);

test("lowers a PGF declared arrow path into endpoint arrow options", () => {
  const diagnostics = [];
  const lowered = lowerDeclaredArrowTips(readFileSync(FIXTURE, "utf8"), diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(lowered, /\\pgfarrowsdeclare/);
  assert.match(lowered, /-\{leaf\[tikzkit declared arrow=/);
  assert.match(lowered, /\{leaf\[tikzkit declared arrow=.*\]\}-/);
});

test("renders declared pgfpath arc arrow tips at both path ends", () => {
  const result = tikzToSvg(readFileSync(FIXTURE, "utf8"), { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-leaf"/);
  assert.match(result.svg, /fill="rgb\(0 179 0\)"/);
  assert.match(result.svg, /fill="rgb\(204 0 0\)"/);
});

test("keeps declared move, line, cubic, and fillstroke geometry reusable", () => {
  const source = String.raw`\pgfarrowsdeclare{kite tip}{kite tip}{}{
    \pgfpathmoveto{\pgfpoint{0pt}{0pt}}
    \pgfpathlineto{\pgfpoint{-3pt}{2pt}}
    \pgfpathcurveto{\pgfpoint{-2pt}{1pt}}{\pgfpoint{-2pt}{-1pt}}{\pgfpoint{-3pt}{-2pt}}
    \pgfpathclose
    \pgfusepathqfillstroke
  }
  \begin{tikzpicture}\draw[blue,-{kite tip}] (0,0) -- (1,0);\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /tikz-arrow-kite tip/);
  assert.match(result.svg, /<path class="tikz-arrow-tip[^>]+fill="blue" stroke="blue"/);
});
