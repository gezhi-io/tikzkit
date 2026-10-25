import assert from "node:assert/strict";
import test from "node:test";
import { layoutNativeMixedText } from "../src/tex/textBox.js";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";

const cases = [
  ["$V_{dd}$ in V", 37.1591, 6.83331, 1.49998],
  ["$f$ in Hz", 32.91673, 6.94444, 1.94444],
  ["$P_v$ in mW", 44.7825, 6.83331, 1.49998]
];

test("mixed axis descriptions use the MacTeX inline math and text hbox", () => {
  // Independent pdflatex probe: fixtures/pgfplots-log-surface-metrics.tex.
  for (const [source, width, height, depth] of cases) {
    const box = layoutNativeMixedText(source);
    assert.ok(box);
    for (const [key, value] of Object.entries({ width, height, depth })) {
      assert.ok(Math.abs(box[key] - value) < .001, `${source} ${key}: ${box[key]} vs ${value}pt`);
    }
  }
});

test("mixed descriptions measure and paint the same native box in both browser modes", async () => {
  for (const [text, width, height, depth] of cases) {
    const source = `\\begin{tikzpicture}\\node[draw,tikzkit native math,tikzkit tex node anchors,inner sep=0pt,outer sep=0pt,anchor=base west]{${text}};\\end{tikzpicture}`;
    const expectedViewBox = tikzToSvg(source, { mathRenderer: "svg-text" }).svg.match(/viewBox="([^"]+)"/)[1];
    for (const mathRenderer of [undefined, "svg-text"]) {
      for (const result of [tikzToSvg(source, { mathRenderer }), await tikzToSvgAsync(source, { mathRenderer })]) {
        assert.deepEqual(result.diagnostics, []);
        const node = result.ir.items.find(item => item.type === "nodeBox");
        assert.ok(Math.abs(node.width * 72.27 / 2.54 - width) < .001);
        assert.ok(Math.abs(node.height * 72.27 / 2.54 - height - depth) < .001);
        assert.match(result.svg, /data-text-layout="cm-tex-box"/);
        assert.doesNotMatch(result.svg, /foreignObject/);
        assert.equal(result.svg.match(/viewBox="([^"]+)"/)[1], expectedViewBox,
          "default bounds must not reserve an unused rich-text box");
      }
    }
  }
});

test("unsupported mixed text is not partially consumed", () => {
  for (const source of ["$x$ broken $", "$$x$$ text", String.raw`$x$ \unknown{text}`, "$x$\ntext"])
    assert.equal(layoutNativeMixedText(source), null);
  assert.equal(layoutNativeMixedText("$x$ text", { family: "Helvetica" }), null);
});

test("sans descriptions retain CM math and use the measured CMSS prose box", () => {
  const box = layoutNativeMixedText("$x$ text", { family: "sans-serif" });
  // fixtures/cmss-native-metrics.tex: math remains CMMI without sansmath.
  assert.ok(Math.abs(box.width - 25.3264) < .001);
  assert.equal(box.items[0].family, "TikZKitCMMI10");
  assert.ok(box.items.slice(1).every(g => g.family === "TikZKitCMSS10"));
});
