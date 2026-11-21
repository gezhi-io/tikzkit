import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTikz } from "../src/internal.js";

function commands(id) {
  const tex = readFileSync(new URL(`./fixtures/pgfplots-function-bars/${id}.tex`, import.meta.url), "utf8");
  return lower(tex);
}

function lower(tex) {
  const { ast, diagnostics } = parseTikz(tex);
  assert.deepEqual(diagnostics, []);
  const lines = ast.pictures[0].body.split("\n");
  return {
    paint: lines.filter(l => /^\\(?:draw|fill)\[axis (?:bar|mark),/.test(l)),
    bars: lines.filter(l => l.startsWith("\\draw[axis bar,")),
    lines: lines.filter(l => l.startsWith("\\draw[axis plot,")),
    labels: lines.filter(l => l.startsWith("\\node[axis near coord,")),
    ticks: lines.filter(l => l.startsWith("\\node[axis tick label,"))
  };
}

test("the manual cubic stays a line, and the second function yields five bars", () => {
  const plot = commands("manual-cubic-bars");
  assert.equal(plot.lines.length, 1);
  assert.equal(plot.bars.length, 5);
  assert.ok(plot.bars.every(l => l.includes("fill=red") && l.includes("draw=red!60")));
});

test("a sampled and a coordinate series each own a slot and independent point meta", () => {
  const plot = commands("sampled-and-tabulated");
  assert.equal(plot.lines.length, 0);
  assert.equal(plot.bars.length, 10);
  assert.deepEqual(plot.labels.map(l => l.match(/\{\$(.*?)\$\};$/)[1]),
    ["5","2","1","2","5","2","3","4","3","2"]);
});

test("nonuniform samples supply the data tick list and signed horizontal labels", () => {
  const plot = commands("nonuniform-horizontal");
  assert.equal(plot.bars.length, 4);
  assert.deepEqual(plot.labels.map(l => l.match(/anchor=(\w+)/)[1]), ["east","east","west","west"]);
  assert.equal(plot.ticks.filter(l => l.includes("anchor=east")).length, 4);
});

test("bar expressions use declared functions from the picture", () => {
  const plot = lower(String.raw`\begin{tikzpicture}[declare function={lift(\v)=1+\v*\v;}]
    \begin{axis}[ybar,nodes near coords,domain=-1:1,samples=3]
      \addplot {lift(x)};
    \end{axis}\end{tikzpicture}`);
  assert.deepEqual(plot.labels.map(l => l.match(/\{\$(.*?)\$\};$/)[1]), ["2","1","2"]);
});

test("unclipped marks paint above later bars; individual and clipped marks stay with the line", () => {
  const tex = readFileSync(new URL("./fixtures/pgfplots-function-bars/individual-marker-phase.tex", import.meta.url), "utf8");
  for (const [mode, deferred] of [["clip mode=global", true], ["clip mode=individual", false], ["clip marker paths", false]]) {
    const plot = lower(tex.replace("clip mode=individual", mode));
    const phases = plot.paint.map(l => l.startsWith("\\draw[axis bar,") ? "bar" : "mark");
    const bars = ["bar","bar","bar"], marks = ["mark","mark","mark"];
    assert.deepEqual(phases, deferred ? [...bars, ...marks] : [...marks, ...bars], mode);
  }
});
