import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function render(source) {
  const { ir, diagnostics } = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(diagnostics, []);
  return ir.items;
}

function labels(items) {
  return items.filter(item => item.type === "textNode").map(item => ({
    text: item.text, angle: (((item.rotation ?? 0) % 360) + 360) % 360
  }));
}

const spokeText = ["0", "45", "90", "135", "180", "-90", "-45", "-135"];
const angles = {
  straight: [0, 0, 0, 0, 0, 0, 0, 0],
  rotate: [0, 45, 90, 315, 0, 270, 315, 45],
  smart: [0, 45, 0, 315, 0, 0, 315, 45]
};

for (const [mode, expected] of Object.entries(angles)) {
  test(`CircuitikZ manual: eight directed spokes with ${mode} labels`, () => {
    const source = readFileSync(new URL(`./fixtures/native-circuitikz-label-orientation/manual-${mode}.tex`, import.meta.url), "utf8");
    const items = render(source);
    for (const subtype of ["circuitikz-resistor", "circuitikz-terminal-open", "circuitikz-terminal-dot"]) {
      assert.equal(items.filter(item => item.subtype === subtype).length, 8, subtype);
    }
    assert.deepEqual(labels(items), expected.map((angle, i) => ({ text: spokeText[i], angle })));
  });
}

test("CircuitikZ smartlabels is the package default and scoped keys restore the enclosing mode", () => {
  function document(option) {
    return String.raw`\documentclass{standalone}
\usepackage${option}{circuitikz}
\begin{document}
\begin{circuitikz}
  \draw (0,0) to[R=A] (2,2);
  \begin{scope}
    \ctikzset{label/align=straight}
    \draw (0,0) to[R=B] (2,2);
  \end{scope}
  \draw (0,0) to[C=C] (2,2);
  \draw (0,0) to[R=D] (0,2);
\end{circuitikz}
\end{document}`;
  }
  for (const [option, expected] of [
    ["", [45, 0, 45, 0]], ["[smartlabels]", [45, 0, 45, 0]],
    ["[rotatelabels]", [45, 0, 45, 90]], ["[straightlabels]", [0, 0, 0, 0]],
    ["[rotatelabels,straightlabels]", [45, 0, 45, 90]]
  ]) {
    assert.deepEqual(labels(render(document(option))).map(item => item.angle), expected, option || "default");
  }
});
