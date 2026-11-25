import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

// One SVG unit per TeX point. Expected widths/centers below were measured
// with MacTeX, not with the renderer or its copy of the TFM tables.
const ptPerCm = 72.27 / 2.54;

function glyphs(text, length, options = "", kind = "text along path") {
  const result = tikzToSvg(String.raw`\usetikzlibrary{decorations.text}
    \begin{tikzpicture}
      \path[decorate,decoration={${kind},text={${text}},${options}}] (0,0) -- (${length},0);
    \end{tikzpicture}`, { unit: ptPerCm, mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return Array.from(result.svg.matchAll(/<text class="tikz-decoration-glyph" x="([^"]+)"[^>]*?font-size="([^"]+)"[^>]*>([^<]*)<\/text>/g),
    ([, x, size, char]) => ({ x: Number(x), size: Number(size), char }));
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < .001, `expected ${expected} TeX pt, got ${actual}`);
}

const letters = items => items.map(item => item.char).join("");

test("a grouped formula can start a path or follow another formula without losing adjacent glyphs", () => {
  for (const [source, expected] of [
    ["{$x$}B", ["math-box:x", "glyph:B"]],
    ["A{$x$}{$y$}", ["glyph:A", "math-box:x", "math-box:y"]],
    ["{$x$}", ["math-box:x"]]
  ]) {
    const { svg, diagnostics } = tikzToSvg(String.raw`\usetikzlibrary{decorations.text}
      \begin{tikzpicture}\path[decorate,decoration={text along path,text={${source}}}]
        (0,0) -- (2,0);\end{tikzpicture}`, { mathRenderer: "svg-text" });
    assert.deepEqual(diagnostics, []);
    assert.deepEqual([...svg.matchAll(/<text class="tikz-decoration-([^"]+)"[^>]*>([^<]+)<\/text>/g)]
      .map(([, kind, text]) => kind + ":" + text), expected);
  }
});

test("non-repeating path text stops at the first prewidth that cannot be traversed", () => {
  const short = glyphs("ABCDEFGHIJKLMN", "1cm");
  assert.equal(letters(short), "ABCD");
  close(short.at(-1).x, 25.62505); // D is painted although its trailing half overhangs.
  assert.equal(letters(glyphs("Wi", "3pt")), ""); // Do not skip W in search of a narrower token.
  assert.equal(letters(glyphs("ABCD", "17pt", "text align={left indent=2pt,right indent=5pt}")), "A");
});

test("exhausting the path in before-typeset never enters the zero-width typeset state", () => {
  // cmbx12 c has an exactly 6pt box. At exactly 3pt the PGF automaton
  // switches to final; with a little distance left it paints the first c.
  const text = String.raw`|\large\bfseries|cc`;
  assert.equal(letters(glyphs(text, "3pt")), "");
  assert.equal(letters(glyphs(text, "3.01pt")), "c");
});

test("typewriter and roman path text advance by their own TFM widths", () => {
  for (const [text, width, count] of [
    [String.raw`|\ttfamily|iiiiiiiiiiii||`, 5.24995, 13],
    [String.raw`|\ttfamily|iiiiiiiiiiii`, 5.24995, 12],
    ["iiiiiiiiiiii", 2.77779, 12]
  ]) {
    const items = glyphs(text, "3.8cm");
    assert.equal(letters(items), "i".repeat(count));
    items.forEach(({ x }, i) => close(x, (i + .5) * width));
  }
});

test("a terminal format replays the last painted box, not part of the measured text", () => {
  const text = String.raw`|\ttfamily|iW|+\large|||`;
  for (const [length, align, expected, centers] of [
    ["40pt", "center", "iWW", [17.37502, 22.62495, 27.87490]],
    ["40pt", "right", "iW", [32.12506, 37.37500]],
    ["40pt", "fit to path", "iW", [2.62497, 37.37500]],
    ["12pt", "left", "iW", [2.62497, 7.87491]]
  ]) {
    const items = glyphs(text, length, `text align={${align}}`);
    assert.equal(letters(items), expected);
    items.forEach(({ x, size }, i) => {
      close(x, centers[i]);
      close(size, 10);
    });
  }
  assert.equal(letters(glyphs("W||i", "40pt")), "Wi");
  assert.equal(letters(glyphs("||", "40pt")), "");
});

test("format replace, append and reset measure each glyph and space at the selected size", () => {
  const items = glyphs(String.raw`|\ttfamily|i W|+\scriptsize|i|\sffamily\small|i|\large\bfseries|c||i`, "60pt");
  assert.equal(letters(items), "iWiici");
  // cmtt10 (including space), cmtt8 at 7pt, cmss9, cmbx12, cmr10.
  const widths = [5.24995, 5.24995, 5.24995, 3.71880, 2.20830, 6, 2.77779];
  const centers = [];
  let cursor = 0;
  for (const [i, width] of widths.entries()) {
    if (i !== 1) centers.push(cursor + width / 2);
    cursor += width;
  }
  items.forEach(({ x, size }, i) => {
    close(x, centers[i]);
    close(size, [10, 10, 7, 9, 12, 10][i]);
  });
});

test("alignment and fitting use the same formatted box widths and reserve the right indent", () => {
  for (const [align, centers] of [
    ["center", [14.98613, 20.23608, 24.24995]],
    ["right", [25.34729, 30.59724, 34.61110]],
    ["right,fit to path", [4.62497, 20.23605, 34.61105]]
  ]) {
    const items = glyphs(String.raw`|\ttfamily|iW||i`, "40pt", `text align={${align},left indent=2pt,right indent=4pt}`);
    assert.equal(letters(items), "iWi");
    items.forEach(({ x }, i) => close(x, centers[i]));
  }
});

test("overlong aligned text follows its decoration's native starting distance", () => {
  for (const [align, kind, expected, centers] of [
    ["center", "text along path", "ABC", [-4.97224, 2.31943, 9.47221]],
    ["right", "text along path", "ABCD", [-13.69450, -6.40283, .74995, 8.18051]],
    ["center", "text effects along path", "AB", [3.75000, 11.04167]],
    ["right", "text effects along path", "AB", [3.75000, 11.04167]]
  ]) {
    const options = `text align=${align}` + (kind === "text effects along path" ? ",text effects/.cd,characters={text along path}" : "");
    const items = glyphs("ABCD", "12pt", options, kind);
    assert.equal(letters(items), expected);
    items.forEach(({ x }, i) => close(x, centers[i]));
  }
});

test("text-effects repetition retains complete copies and a printable last partial copy", () => {
  const options = "text effects/.cd,characters={text along path}";
  for (const [length, repeat, expected] of [
    ["60pt", ",repeat text=1", "ABAB"],
    ["20pt", ",repeat text", "ABA"],
    ["12pt", "", "AB"]
  ]) {
    assert.equal(letters(glyphs("AB", length, options + repeat, "text effects along path")), expected);
  }
  const centered = glyphs("AB", "40pt", `text align=center,${options},repeat text`, "text effects along path");
  assert.equal(letters(centered), "AB");
  close(centered[0].x, 16.45833);
  close(centered[1].x, 23.75000);
});
