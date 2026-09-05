import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import {
  placeResolvedInlineArrowTips,
  resolveInlineArrowTipSequence,
  resolvedArrowSequenceShortening
} from "../src/renderers/svg/paths.js";
import { lowerDeclaredArrowTips } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/arrows/", import.meta.url);

function source(name) {
  return readFileSync(new URL(name, FIXTURE_ROOT), "utf8");
}

function renderedPath(input) {
  const result = tikzToSvg(input, { mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return { result, path: result.ir.items.find((item) => item.type === "path" && item.style?.markerEnd) };
}

function endTips(path) {
  return resolveInlineArrowTipSequence(path.style.markerEnd, path.style, "end");
}

test("lowers pgfarrowsdeclarecombine into two independently painted arrow tips", () => {
  const input = String.raw`
    \pgfarrowsdeclare{notch}{notch}
      {\pgfarrowsleftextend{-1pt}\pgfarrowsrightextend{1pt}}
      {\pgfpathmoveto{\pgfqpoint{-1pt}{-1pt}}\pgfpathlineto{\pgfqpoint{1pt}{0pt}}\pgfpathlineto{\pgfqpoint{-1pt}{1pt}}\pgfusepathqstroke}
    \pgfarrowsdeclarecombine[1pt]{double notch}{double notch}{notch}{notch}{notch}{notch}
    \begin{tikzpicture}\draw[very thick,-{double notch}] (0,0) -- (3,0);\end{tikzpicture}
  `;
  const lowered = lowerDeclaredArrowTips(input);
  const { path } = renderedPath(input);
  const tips = endTips(path);

  assert.doesNotMatch(lowered, /\\pgfarrowsdeclarecombine/u);
  assert.equal(tips.length, 2);
  assert.equal(tips[0].kind, "notch");
  assert.equal(tips[1].kind, "notch");
  assert.ok(Math.abs(tips[0].separation / lineWidthFromPt(1) - 1) < 1e-9);
  assert.equal(tips[1].separation, 0);
});

test("preserves the starred combine line-end marker when shortening the shaft", () => {
  const input = String.raw`
    \pgfarrowsdeclare{chevron}{chevron}
      {\pgfarrowsleftextend{-1pt}\pgfarrowssetlineend{.25pt}\pgfarrowsrightextend{2pt}}
      {\pgfpathmoveto{\pgfqpoint{-1pt}{-1pt}}\pgfpathlineto{\pgfqpoint{2pt}{0pt}}\pgfpathlineto{\pgfqpoint{-1pt}{1pt}}\pgfusepathqstroke}
    \pgfarrowsdeclare{terminal bar}{terminal bar}
      {\pgfarrowsleftextend{-.5pt}\pgfarrowssetlineend{0pt}\pgfarrowsrightextend{.5pt}}
      {\pgfpathmoveto{\pgfqpoint{0pt}{-2pt}}\pgfpathlineto{\pgfqpoint{0pt}{2pt}}\pgfusepathqstroke}
    \pgfarrowsdeclarecombine*[.5pt]{barred chevron}{barred chevron}{chevron}{chevron}{terminal bar}{terminal bar}
    \begin{tikzpicture}\draw[line width=1pt,-{barred chevron}] (0,0) -- (3,0);\end{tikzpicture}
  `;
  const { path } = renderedPath(input);
  const tips = endTips(path);
  const shorteningPt = resolvedArrowSequenceShortening(tips) / lineWidthFromPt(1);

  assert.equal(tips.length, 2);
  assert.equal(tips[0].lineEndBreakBefore, false);
  assert.equal(tips[1].lineEndBreakBefore, true);
  assert.ok(Math.abs(shorteningPt - 3.25) < 1e-9, `expected 3.25pt, got ${shorteningPt}pt`);
});

test("expands declared double and triple helpers with active-line-width separation", () => {
  const input = String.raw`
    \pgfarrowsdeclare{pulse}{pulse}
      {\pgfarrowsleftextend{-1pt}\pgfarrowsrightextend{1pt}}
      {\pgfpathmoveto{\pgfqpoint{-1pt}{0pt}}\pgfpathlineto{\pgfqpoint{0pt}{1pt}}\pgfpathlineto{\pgfqpoint{1pt}{0pt}}\pgfusepathqstroke}
    \pgfarrowsdeclaredouble[\pgflinewidth]{double pulse}{double pulse}{pulse}{pulse}
    \pgfarrowsdeclaretriple[\pgflinewidth]{triple pulse}{triple pulse}{pulse}{pulse}
    \begin{tikzpicture}
      \draw[line width=1.6pt,-{double pulse}] (0,0) -- (3,0);
      \draw[line width=1.6pt,-{triple pulse}] (0,1) -- (3,1);
    \end{tikzpicture}
  `;
  const result = tikzToSvg(input, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);
  const doubleTips = endTips(paths[0]);
  const tripleTips = endTips(paths[1]);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(doubleTips.length, 2);
  assert.equal(tripleTips.length, 3);
  assert.ok(doubleTips[0].separation > lineWidthFromPt(1.59));
  assert.ok(doubleTips[0].separation < lineWidthFromPt(1.61));
  assert.deepEqual(
    tripleTips.map((tip) => Math.round(tip.separation)),
    [Math.round(lineWidthFromPt(1.6)), Math.round(lineWidthFromPt(1.6)), 0]
  );

  const placements = placeResolvedInlineArrowTips(tripleTips, { x: 3, y: 1 }, -1, 0, 100);
  assert.ok(placements[0].point.x < placements[1].point.x);
  assert.ok(placements[1].point.x < placements[2].point.x);
});

test("renders combination helpers in flowchart, mathematics, and real bond-graph fixtures", () => {
  const expectations = new Map([
    ["declared-combine-flowchart.tex", 8],
    ["declared-double-triple-math.tex", 10],
    ["declared-combine-bondgraph.tex", 6]
  ]);

  for (const [fixture, count] of expectations) {
    const result = tikzToSvg(source(fixture), { mathRenderer: "svg-text" });
    assert.deepEqual(result.diagnostics, [], fixture);
    assert.equal((result.svg.match(/class="tikz-arrow-tip/g) || []).length, count, fixture);

    if (fixture === "declared-combine-bondgraph.tex") {
      const path = result.ir.items.find((item) => item.type === "path" && item.style?.markerEnd);
      const tips = endTips(path);
      assert.equal(tips[1].kind, "legacy-bar");
      assert.equal(tips[1].strokeWidth, path.style.lineWidth);
    }
  }
});
