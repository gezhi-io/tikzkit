import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { layoutArrowedPath } from "../src/renderers/svg/paths.js";

// pgfmanual-en-library-petri.tex, transition example. The ordinary TikZ
// styles isolate the edge operation from the Petri library and its tokens.
function transition(name = "") {
  const { ir, diagnostics } = tikzToSvg(String.raw`\usetikzlibrary{positioning}
    \tikzset{place/.style={circle,draw,inner sep=0pt,minimum size=5ex},
      transition/.style={rectangle,draw,inner sep=0pt,minimum size=4mm},
      pre/.style={<-,shorten <=1pt},post/.style={->,shorten >=1pt}}
    \begin{tikzpicture}
      \node[place,label=above:$p_1$] (p1) {};
      \node[place,label=above:$p_2\ge1$,right=of p1] (p2) {};
      \node[transition,below right=of p1,label=below:$t_1$] ${name} {}
        edge[pre] (p1) edge[post] node[auto] {2} (p2);
    \end{tikzpicture}`, { mathRenderer: "svg-text" });
  assert.deepEqual(diagnostics, []);
  return ir.items;
}

const ptPerCm = 72.27 / 2.54;
function nativePoint({ x, y }, [px, py]) {
  assert.ok(Math.hypot(x * ptPerCm - px, y * ptPerCm - py) < .005,
    `(${x * ptPerCm}, ${y * ptPerCm}) != (${px}, ${py}) TeX pt`);
}

test("both anonymous-node edges start at the rectangle border and shorten at their own arrow", () => {
  const edges = transition().filter(p => p.subtype === "edge");
  assert.equal(edges.length, 2);
  // Border intersections from MacTeX with arrows disabled, then dvisvgm's
  // actual shaft endpoints and tip transforms with the manual's pre/post.
  const expected = [
    { borders: [[36.20625,-36.20535],[7.75261,-7.75261]],
      shaft: [[35.17389,-35.17303],[7.75261,-7.75261]], side: "start", outward: [.70710,-.70708] },
    { borders: [[43.255,-36.20535],[48.2635,-10.75723]],
      shaft: [[43.255,-36.20535],[47.98161,-12.1897]], side: "end", outward: [.19308,.98116] }
  ];
  for (const [i, edge] of edges.entries()) {
    const { borders, shaft, side, outward } = expected[i];
    assert.deepEqual(edge.commands.map(p => p.type), ["moveTo","lineTo"]);
    edge.commands.forEach((p, j) => nativePoint(p, borders[j]));
    const { commands, placements } = layoutArrowedPath(edge, 100);
    commands.forEach((p, j) => nativePoint(p, shaft[j]));
    assert.deepEqual(placements.map(p => p.side), [side]);
    nativePoint(placements[0].point, shaft[side === "start" ? 0 : 1]);
    assert.ok(Math.hypot(placements[0].outward.x - outward[0], placements[0].outward.y - outward[1]) < .0001);
  }
});

for (const [kind, name] of [["named","(tr)"], ["anonymous",""]]) {
  test(`the ${kind} transition's auto weight belongs to the outgoing edge, not to the source node`, () => {
    const items = transition(name);
    const weights = items.filter(p => p.type === "textNode" && p.text === "2");
    assert.equal(weights.length, 1);
    // Native \pgfpointanchor{weight}{center}: the unshortened post midline
    // anchors the label's south east corner, independently of below right=of.
    nativePoint(weights[0], [39.72627,-16.72610]);
    assert.equal(weights[0].font.sizePt, 10);
    const outgoing = items.find(p => p.subtype === "edge" && p.style.markerEnd);
    assert.ok(outgoing && items.indexOf(outgoing) < items.indexOf(weights[0]));
  });
}
