import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lowerDeclaredArrowTips, resolveDeclaredArrowGeometry } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/arrows/", import.meta.url);

function source(name) {
  return readFileSync(new URL(name, FIXTURE_ROOT), "utf8");
}

function declaredPayloads(input) {
  return [...lowerDeclaredArrowTips(input).matchAll(/tikzkit declared arrow=([0-9a-f]+)/gi)].map((match) => {
    const encoded = match[1].match(/../g).map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join("");
    return JSON.parse(decodeURIComponent(encoded));
  });
}

test("lowers legacy declared-arrow aliases and reversed declarations", () => {
  const diagnostics = [];
  const lowered = lowerDeclaredArrowTips(source("declared-aliases-flowchart.tex"), diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(lowered, /\\pgfarrowsdeclare(?:alias|reversed)?/u);
  assert.match(lowered, /process alias\[tikzkit declared arrow=/u);
  assert.match(lowered, /process reversed\[tikzkit declared arrow=/u);

  const payloads = declaredPayloads(source("declared-aliases-flowchart.tex"));
  assert.ok(payloads.some((payload) => payload.name === "process alias" && payload.reversed !== true));
  assert.ok(payloads.some((payload) => payload.name === "process reversed" && payload.reversed === true));
});

test("uses the fourth legacy alias argument as PGF's means target", () => {
  const payloads = declaredPayloads(String.raw`
    \pgfarrowsdeclare{ignored target}{ignored target}
      {\pgfarrowsleftextend{-1pt}\pgfarrowsrightextend{1pt}}
      {\pgfpathmoveto{\pgfqpoint{-1pt}{0pt}}\pgfpathlineto{\pgfqpoint{1pt}{0pt}}\pgfusepathqstroke}
    \pgfarrowsdeclare{actual target}{actual target}
      {\pgfarrowsleftextend{-3pt}\pgfarrowsrightextend{2pt}}
      {\pgfpathmoveto{\pgfqpoint{-3pt}{0pt}}\pgfpathlineto{\pgfqpoint{2pt}{0pt}}\pgfusepathqstroke}
    \pgfarrowsdeclarealias{public start}{public end}{ignored target}{actual target}
    \begin{tikzpicture}\draw[-{public start}] (0,0) -- (1,0);\draw[-{public end}] (0,1) -- (1,1);\end{tikzpicture}
  `);

  assert.equal(payloads.length, 2);
  assert.deepEqual(payloads.map((payload) => payload.name), ["public start", "public end"]);
  for (const payload of payloads) {
    assert.ok(Math.abs(payload.backEnd / lineWidthFromPt(1) + 3) < 1e-9);
    assert.ok(Math.abs(payload.tipEnd / lineWidthFromPt(1) - 2) < 1e-9);
  }
});

test("reverses declared geometry and exchanges all longitudinal ends", () => {
  const payloads = declaredPayloads(String.raw`
    \pgfarrowsdeclare{wedge}{wedge}{
      \pgfarrowsleftextend{-2pt}
      \pgfarrowssetlineend{0.25pt}
      \pgfarrowsrightextend{1pt}
    }{
      \pgfpathmoveto{\pgfpoint{-2pt}{0pt}}
      \pgfpathlineto{\pgfpoint{1pt}{1pt}}
      \pgfpathlineto{\pgfpoint{1pt}{-1pt}}
      \pgfpathclose
      \pgfusepathqfill
    }
    \pgfarrowsdeclarereversed{wedge reversed}{wedge reversed}{wedge}{wedge}
    \begin{tikzpicture}\draw[-{wedge reversed}] (0,0) -- (2,0);\end{tikzpicture}
  `);
  assert.equal(payloads.length, 1);

  const geometry = resolveDeclaredArrowGeometry(payloads[0], lineWidthFromPt(0.4));
  const unit = lineWidthFromPt(1);
  assert.ok(Math.abs(geometry.backEnd / unit + 1) < 1e-9);
  assert.ok(Math.abs(geometry.tipEnd / unit - 2) < 1e-9);
  assert.ok(Math.abs(geometry.lineEnd / unit + 0.25) < 1e-9);
  assert.ok(Math.abs(geometry.bounds.minX / unit + 1) < 1e-9);
  assert.ok(Math.abs(geometry.bounds.maxX / unit - 2) < 1e-9);
});

test("renders alias and reversed tips in combination and real-graphic fixtures", () => {
  const expectations = new Map([
    ["declared-aliases-flowchart.tex", { count: 4, names: ["process alias", "process reversed"] }],
    ["declared-aliases-math.tex", { count: 5, names: ["inclusion", "projection"] }],
    ["declared-aliases-tcs-tree.tex", { count: 13, names: ["sprout", "root leaf"] }]
  ]);

  for (const [fixture, expectation] of expectations) {
    const result = tikzToSvg(source(fixture), { mathRenderer: "svg-text" });
    assert.deepEqual(result.diagnostics, [], fixture);
    assert.equal((result.svg.match(/class="tikz-arrow-tip/g) || []).length, expectation.count, fixture);
    for (const name of expectation.names) {
      assert.match(result.svg, new RegExp(`tikz-arrow-${name}`, "u"), fixture);
    }
  }
});
