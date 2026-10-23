import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTikzText } from "../src/tikz/text.js";
import { layoutMultilineMathText } from "../src/tikz/textMetrics.js";
import { tikzToSvg } from "../src/index.js";

const label = String.raw`$s_1$\\{\scriptsize$\alpha_{t-1}(s_1)$}`;

test("multiline math packs the native halign box, not accumulated ink heights", () => {
  const box = layoutMultilineMathText(normalizeTikzText(label), { sizePt: 10, baselineSkipPt: 12 });
  assert.ok(box);
  // MacTeX 2025: pgfnodeparttextbox = 31.26382pt x (16.30554pt + 1.83336pt).
  assert.ok(Math.abs(box.width - 31.26382) < 0.001);
  assert.ok(Math.abs(box.height - 16.30554) < 0.001);
  assert.ok(Math.abs(box.depth - 1.83336) < 0.001);
  assert.equal(box.items.find(part => part.text === "s" && part.size === 10).y, -12);
  assert.equal(box.items.find(part => part.text === "\u03b1").y, 0);
});

test("multiline math preserves per-row alignment and the surrounding baseline grid", () => {
  const normalized = normalizeTikzText(label);
  const font = { sizePt: 8, baselineSkipPt: 9.5 };
  const left = layoutMultilineMathText(normalized, font, "left");
  const right = layoutMultilineMathText(normalized, font, "right");
  assert.ok(left && right);
  assert.equal(left.items[0].size, 8);
  assert.equal(left.items[0].y, -9.5);
  assert.equal(left.items[0].x, 0);
  assert.ok(right.items[0].x > 20);
  assert.equal(left.items.find(part => part.text === "\u03b1").size, 7);
  assert.equal(left.width, right.width);
});

test("multiline math uses TeX lineskip for tall rows and rejects partial support", () => {
  const normalized = normalizeTikzText(String.raw`$\dfrac{1}{x}$\\$\dfrac{1}{x}$`);
  const box = layoutMultilineMathText(normalized, { sizePt: 10, baselineSkipPt: 12 });
  assert.ok(box);
  const rows = box.rows;
  assert.ok(rows[1].baseline - rows[0].baseline > 12);
  assert.ok(Math.abs(rows[1].baseline - rows[0].baseline - rows[0].depth - rows[1].height - 1) < 1e-8);
  for (const text of [String.raw`$x$\\plain`, String.raw`$x$\\[2pt]$y$`, String.raw`$x$\\$\notasupportedcommand$`]) {
    assert.equal(layoutMultilineMathText(normalizeTikzText(text)), null);
  }
});

test("multiline circle math uses identical native glyph boxes in both SVG modes", () => {
  const source = String.raw`\begin{tikzpicture}
    \node[align=center,circle,draw,thick] (s) {` + label + String.raw`};
  \end{tikzpicture}`;
  const browser = tikzToSvg(source);
  const exported = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(browser.diagnostics, []);
  assert.deepEqual(exported.diagnostics, []);
  assert.match(browser.svg, /data-math-layout="cm-tex-box"/);
  assert.match(browser.svg, /font-family="TikZKitCMMI7"/);
  assert.doesNotMatch(browser.svg, /foreignObject/);
  assert.equal(browser.svg, exported.svg);
});
