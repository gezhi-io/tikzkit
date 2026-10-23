import assert from "node:assert/strict";
import test from "node:test";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { tikzToSvg } from "../src/index.js";

test("real and imaginary part symbols use native CMSY slots in every math size", () => {
  // MacTeX fontmath.ltx declares these ordinary symbols at CMSY 3C/3D,
  // not Euler fraktur letters or the spelled-out operators Re/Im.
  for (const size of [5, 7, 10, 12]) {
    for (const [command, glyph] of [["Re", "\u211c"], ["Im", "\u2111"]]) {
      for (const bold of [false, true]) {
        const box = layoutNativeMath(`\\${command}(p_0)`, {
          preferNativeMath: true, fontSizePt: size, mathVersion: bold ? "bold" : "normal"
        });
        assert.ok(box, `${command} at ${size}pt, bold=${bold}`);
        assert.equal(box.items[0].text, glyph);
        assert.match(box.items[0].family, bold ? /^TikZKitCMBSY/ : /^TikZKitCMSY/);
        assert.equal(box.items[0].size, size);
      }
    }
  }
});

test("3D real and imaginary labels share native glyphs in default and export SVG", () => {
  const source = String.raw`\begin{tikzpicture}
    \begin{axis}[xlabel=$\Re(p_0)$,ylabel=$\Im(p_0)$]
      \addplot3 coordinates {(0,0,0) (1,1,1)};
    \end{axis}\end{tikzpicture}`;
  for (const options of [{}, { mathRenderer: "svg-text" }]) {
    const result = tikzToSvg(source, options);
    assert.deepEqual(result.diagnostics, []);
    assert.match(result.svg, /data-math-layout="cm-tex-box"/);
    assert.ok(result.svg.includes("\u211c"));
    assert.ok(result.svg.includes("\u2111"));
  }
});
