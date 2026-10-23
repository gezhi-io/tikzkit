import assert from "node:assert/strict";
import test from "node:test";
import { renderScopedUprightMathContent } from "../src/renderers/svg/mathUprightFallback.js";
import { renderSvgMathFallbackContent } from "../src/renderers/svg/textLineContent.js";
import { tikzToSvg } from "../src/index.js";
import { assertNativeText } from "./helpers/native-math-svg.js";

test("upright alphabet fallback declines formulas without an upright alphabet", () => {
  for (const source of [String.raw`x_i`, String.raw`\hat x_1`, String.raw`\sum_{i=1}^{10} x_i`]) {
    assert.equal(renderScopedUprightMathContent(source, 12), "", source);
  }
});

test("inline sum scripts use the operator handler instead of the generic script handler", () => {
  const content = renderSvgMathFallbackContent(String.raw`\sum_{i=1}^{10} x_i`, 12);
  assert.match(content, /tikz-sum-sidescripts-content/);
  assert.match(content, />i=1</);
  assert.doesNotMatch(content, />i = 1</);
  const uprightLimit = renderSvgMathFallbackContent(String.raw`\sum_{i=\mathrm{min}}^{10} x_i`, 12);
  assert.match(uprightLimit, /tikz-sum-sidescripts-content/);
});

test("native hats remain available after an unrelated upright fallback formula", () => {
  renderScopedUprightMathContent(String.raw`a_{\mathrm{unit}}`, 12);
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \node {$\hat x_1$};\end{tikzpicture}`, { mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  const group = assertNativeText(result.svg, "\u02c6x1");
  assert.equal(group.glyphs[0].family, "TikZKitCMR10");
  assert.equal(group.glyphs[1].family, "TikZKitCMMI10");
  assert.equal(group.glyphs[2].size, 7);
});

test("upright alphabet dispatch is repeatable and keeps scripts attached", () => {
  const source = String.raw`a_{\mathrm{unit}}`;
  const first = renderScopedUprightMathContent(source, 12);
  assert.match(first, /unit/);
  assert.match(first, /baseline-shift="sub"/);
  assert.equal(renderScopedUprightMathContent(source, 12), first);
});
