import assert from "node:assert/strict";
import test from "node:test";
import { layoutNativeText, layoutNativeTextRun } from "../src/tex/textBox.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { layoutNativeMixedParagraph, layoutNativeParagraph } from "../src/tex/paragraphBox.js";

test("CMSS optical designs and bold substitution match MacTeX hboxes", () => {
  // Independent pdflatex values: fixtures/cmss-native-metrics.tex.
  for (const [size, design, width, height, depth] of [
    [5, 8, 15.58179, 3.47221, .97221], [7, 8, 21.81453, 4.8611, 1.3611],
    [8, 8, 24.93091, 5.55556, 1.55556], [9, 9, 27.15257, 6.25, 1.75],
    [10, 10, 29.33342, 6.94444, 1.94444], [12, 12, 34.31903, 8.33331, 2.33331],
    [14.4, 12, 41.1828, 9.99998, 2.79999], [17.28, 17, 47.569, 12, 3.3611],
    [24.88, 17, 68.4906, 17.27779, 4.83937]
  ]) {
    const box = layoutNativeText("ABCgy", { family: "sans-serif", sizePt: size });
    for (const [key, expected] of Object.entries({ width, height, depth }))
      assert.ok(Math.abs(box[key] - expected) < .001, `${size}pt ${key}: ${box[key]}`);
    assert.ok(box.items.every(g => g.family === `TikZKitCMSS${design}` && g.size === size));
  }
  const bold = layoutNativeText("ABCgy", { family: "sans-serif", sizePt: 12, weight: 700 });
  assert.ok(Math.abs(bold.width - 38.63354) < .001);
  assert.ok(bold.items.every(g => g.family === "TikZKitCMSSBX10" && g.weight === 700));
});

test("CMSS declarations and wrappers restore the enclosing font", () => {
  const box = layoutNativeTextRun(normalizeTikzText(String.raw`A {\sffamily B}\textsf{C} D`));
  assert.deepEqual(box.items.map(g => g.family), ["TikZKitCMR10", "TikZKitCMSS10", "TikZKitCMSS10", "TikZKitCMR10"]);
});

test("sans paragraphs use their own native space glue at large and bold sizes", () => {
  for (const [sizePt, weight, width] of [[17.28, 400, 57.85059], [10, 700, 38.4099]]) {
    const font = { family: "sans-serif", sizePt, weight };
    const source = "A B $x$ C";
    for (const box of [layoutNativeParagraph([source], font, 100, "left"),
      layoutNativeMixedParagraph(source, font, 100, "left")]) {
      assert.ok(box);
      assert.equal(box.rows.length, 1);
      assert.ok(Math.abs(box.rows[0].width - width) < .001, `${sizePt}pt/${weight}: ${box.rows[0].width}`);
    }
  }
});
