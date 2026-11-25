import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTikz } from "../src/internal.js";
import { normalizeOptions, parseOptions } from "../src/engine/options.js";

const source = id => readFileSync(new URL("./fixtures/pgfplots-bar-paint/" + id + ".tex", import.meta.url), "utf8");
const paint = raw => {
  const { style } = normalizeOptions("draw", parseOptions(raw), { styles: {}, variables: {} });
  return [style.fill, style.stroke, style.lineWidth, style.dashArray, style.lineJoin ?? "miter",
    style.fillOpacity ?? 1, style.strokeOpacity ?? 1, style.opacity ?? 1];
};
function chart(tex) {
  const { ast, diagnostics } = parseTikz(tex);
  assert.deepEqual(diagnostics, []);
  const paths = ast.pictures[0].body.split("\n");
  return key => paths.flatMap(line => {
    const match = line.match(/^\\(?:draw|fill)\[([^\]]+)\]/);
    return match?.[1].startsWith(key + ",") ? [paint(match[1])] : [];
  });
}

for (const [id, n] of [["manual-vertical",5],["manual-horizontal",6]]) {
  test(id + ": per-plot bar handler keeps line-cycle marks and adds no fill", () => {
    const drawn = chart(source(id));
    assert.deepEqual(drawn("axis bar"), Array(n).fill(paint("draw=blue,fill=none")));
    assert.deepEqual(drawn("axis mark"), Array(n).fill(paint("draw=blue,fill=blue!80!black")));
  });
}

test("bar data can be fill-only while a legend draw restarts its outline", () => {
  const drawn = chart(source("grouped-ink"));
  const options = ["draw=teal,fill=none,very thick,dashed", "draw=none,fill=orange,fill opacity=.4",
    "draw=blue,fill=yellow,line width=1.2pt,draw opacity=.5,fill opacity=.65"];
  for (const [key,n] of [["axis bar",3],["axis legend image",2]]) {
    const paints = options.map((o, i) => key === "axis legend image" && i === 1 ? o + ",draw=black" : o);
    assert.deepEqual(drawn(key), paints.flatMap(o => Array(n).fill(paint(o))));
  }
});

test("bare fill uses the fill ink, and opacity changes both paint channels in order", () => {
  const drawn = chart(source("horizontal-ink"));
  const options = ["draw=blue,fill=red,line width=1pt,draw opacity=.6,fill opacity=.24",
    "draw=purple,fill=none,line width=1.5pt,line join=round,dash pattern=on 3pt off 2pt,draw opacity=.8,fill opacity=.8"];
  for (const [key,n] of [["axis bar",3],["axis legend image",2]]) {
    assert.deepEqual(drawn(key), options.flatMap(o => Array(n).fill(paint(o))));
  }
});

test("a color override replaces both cycle inks, a pen override changes only the stroke", () => {
  const drawn = chart(source("cycle-ink"));
  const options = ["draw=blue,fill=blue!30!white","draw=orange,fill=orange",
    "draw=purple,fill=brown!30!white","draw=blue,fill=black"];
  assert.deepEqual(drawn("axis bar"), options.flatMap(o => Array(2).fill(paint(o))));
  assert.deepEqual(drawn("axis legend image"), options.flatMap(o => Array(2).fill(paint(o))));
  assert.deepEqual(drawn("axis mark"), Array(4).fill(paint("draw=orange,fill=orange")));
});

test("a repeated key occupies its final position, even across the cycle and the author's options", () => {
  const cycle = chart(source("cycle-ink").replace("orange,mark=*", "orange,fill=green,mark=*"));
  assert.deepEqual(cycle("axis bar")[2], paint("draw=orange,fill=green"));
  const repeated = chart(source("horizontal-ink").replace("draw opacity=.2,opacity=.8",
    "opacity=.4,draw opacity=.2,opacity=.8"));
  assert.deepEqual(repeated("axis bar")[3], paint(
    "draw=purple,fill=none,line width=1.5pt,line join=round,dash pattern=on 3pt off 2pt,draw opacity=.8,fill opacity=.8"));
});
