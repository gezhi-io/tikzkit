import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { textLineStyles, wrapStyledSvgTextLines } from "../src/renderers/svg/textLayout.js";

function wrap(source, width) {
  const normalized = normalizeTikzText(source);
  const styles = textLineStyles(normalized, normalized.lines.length);
  const original = structuredClone(styles);
  const wrapped = wrapStyledSvgTextLines(normalized.lines, normalized.lines, styles, width, 28.4527559, 10, {
    lineBreakMode: "center"
  });
  assert.deepEqual(styles, original, "wrapping must not mutate the source font runs");
  return wrapped;
}

test("wrapped typewriter lines contain only their own source characters", () => {
  const wrapped = wrap(String.raw`\texttt{"How many outlined objects are above the spade?"}`, 135 / 28.4527559);
  assert.deepEqual(wrapped.lines, ['"How many outlined objects', 'are above the spade?"']);
  assert.deepEqual(wrapped.lineStyles.map(style => style.fontSegments.map(segment => segment.text).join("")), wrapped.lines);
  assert.ok(wrapped.lineStyles.every(style => style.fontSegments.every(segment => segment.family === "monospace")));
});

test("wrapped mixed-font runs consume repeated words once and retain their styles", () => {
  const wrapped = wrap(String.raw`First \texttt{code code code code} then \textit{italic words} last.`, 3);
  assert.deepEqual(wrapped.lines, ["First code code", "code code then", "italic words last."]);
  assert.deepEqual(wrapped.lineStyles.map(style => style.fontSegments.map(segment => segment.text).join("")), wrapped.lines);
  const segments = wrapped.lineStyles.flatMap(style => style.fontSegments);
  assert.equal(segments.filter(segment => segment.family === "monospace").map(segment => segment.text).join(" ").trim(), "code code code code");
  assert.equal(segments.filter(segment => segment.style === "italic").map(segment => segment.text).join(" ").trim(), "italic words");
});

test("native paragraph widths retain bold and scoped optical-size advances", () => {
  assert.deepEqual(wrap(String.raw`Keep \textbf{every bold word in its original order} after wrapping.`, 3).lines,
    ["Keep every bold", "word in its", "original order", "after wrapping."]);
  assert.deepEqual(wrap(String.raw`{\small Smaller repeated repeated repeated words} then normal words.`, 3).lines,
    ["Smaller repeated", "repeated repeated", "words then", "normal words."]);
});

test("a wrapped line with one scoped size run does not drop its font size", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \node[draw,text width=3cm,align=center] {{\small Smaller repeated repeated repeated words} then normal words.};
  \end{tikzpicture}`, { mathRenderer: "svg-text" });
  assert.match(result.svg, /font-size="31\.631382"[^>]*>Smaller repeated<\/tspan>/);
  assert.match(result.svg, /font-size="31\.631382"[^>]*>repeated repeated<\/tspan>/);
});

test("discretionary line-end hyphens keep the split word's font without replaying it", () => {
  const wrapped = wrap(String.raw`\textbf{pro\-gramming} then text`, 1.5);
  assert.deepEqual(wrapped.lineStyles.map(style => style.fontSegments.map(segment => segment.text).join("")), wrapped.lines);
  assert.equal(wrapped.lineStyles.flatMap(style => style.fontSegments).filter(segment => segment.weight === 700)
    .map(segment => segment.text).join("").replace(/[-\s]/g, ""), "programming");
});

test("sync and cached async SVG paint a wrapped paragraph only once", async () => {
  const source = String.raw`\begin{tikzpicture}
    \node[draw,text width=13.5em,align=center] {\texttt{"How many outlined objects are above the spade?"}};
  \end{tikzpicture}`;
  for (const result of [tikzToSvg(source, { mathRenderer: "svg-text" }), await tikzToSvgAsync(source, { mathRenderer: "svg-text" })]) {
    assert.equal(result.diagnostics.length, 0);
    assert.equal([...result.svg.matchAll(/How many/g)].length, 1);
    assert.equal([...result.svg.matchAll(/above the spade/g)].length, 1);
  }
});
