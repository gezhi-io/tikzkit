import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function render(ticks = "some") {
  return tikzToSvg(String.raw`\usetikzlibrary{datavisualization}
    \tikz\datavisualization[scientific axes=clean,
      x axis={logarithmic,min value=1,max value=1000,ticks={` + ticks + String.raw`}},
      visualize as line] data {x,y
      1,0
      10,1
      100,2
      1000,3
    };`);
}

test("datavis log axes print source numbers, not PGFPlots power labels", () => {
  const result = render();
  assert.deepEqual(result.diagnostics, []);
  const labels = result.ir.items.filter(item => item.type === "textNode").map(item => item.text);
  for (const label of ["1", "10", "100", "1,000"]) assert.ok(labels.includes(label), label);
  assert.ok(labels.every(label => !label.includes("10^{")));
});

test("datavis log minor ticks are opt-in, unlike PGFPlots log axes", () => {
  const minor = source => source.ir.items.filter(item => item.subtype === "axis-minor-tick");
  assert.equal(minor(render()).length, 0);
  assert.equal(minor(render("some,minor steps between steps=2")).length, 6);
});

test("PGFPlots log axes retain power labels and automatic minor ticks", () => {
  const result = tikzToSvg(String.raw`\usepackage{pgfplots}\begin{tikzpicture}
    \begin{semilogxaxis}[xmin=1,xmax=1000,ymin=0,ymax=3]
      \addplot coordinates {(1,0) (10,1) (100,2) (1000,3)};
    \end{semilogxaxis}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some(item => item.text === "$10^{2}$"));
  assert.ok(result.ir.items.some(item => item.subtype === "axis-minor-tick"));
});

test("datavis legend samples reuse the line or smooth-line plot handler", () => {
  for (const [kind, segment] of [["line", "lineTo"], ["smooth line", "curveTo"]]) {
    const result = tikzToSvg("\\usetikzlibrary{datavisualization}\\tikz\\datavisualization[" +
      "scientific axes=clean,visualize as " + kind + "=s,s={label in legend={text={sample}}}]" +
      "data {x,y\n0,0\n1,1\n2,0\n};");
    assert.deepEqual(result.diagnostics, []);
    const line = result.ir.items.find(item => item.type === "path" && item.subtype === "axis-legend-example");
    assert.ok(line, kind);
    assert.deepEqual(line.commands.map(command => command.type), ["moveTo", segment, segment, segment], kind);
  }
});
