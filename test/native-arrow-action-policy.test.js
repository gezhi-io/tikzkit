import assert from "node:assert/strict";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

function scene(source) {
  const parsed = parseTikz(source);
  const result = interpretTikz(parsed.ast);
  assert.deepEqual([...parsed.diagnostics, ...result.diagnostics], []);
  return result.ir.items;
}

const paths = source => scene(source).filter(item => item.type === "path");
const hasTips = item => Boolean(item.style.markerStart || item.style.markerEnd);
const painted = item => hasTips(item) || item.style.stroke !== "none" || item.style.fill !== "none";
const line = "(0,0) -- (2,0)";

// pgfcorepathusage.code.tex:49-173. Fill alone bypasses even tips=true;
// only an empty paint action enters the arrows-only branch.
for (const [key, draw, noPaint, degenerate] of [
  ["", true, false, true],
  ["tips=on draw", true, false, true],
  ["tips", true, true, true],
  ["tips=true", true, true, true],
  ["tips=proper", true, true, false],
  ["tips=on proper draw", true, false, false],
  ["tips=never", false, false, false],
  ["/pgf/tips=false", false, false, false]
]) {
  test(`path actions: ${key || "initial on draw"}`, () => {
    const options = ["<->", key].filter(Boolean).join(",");
    for (const [statement, markers, stroke, fill] of [
      [`\\draw[${options}]`, draw, "black", "none"],
      [`\\path[draw=teal,${options}]`, draw, "teal", "none"],
      [`\\filldraw[fill=red,draw=blue,${options}]`, draw, "blue", "red"],
      [`\\fill[teal,${options}]`, false, "none", "teal"],
      [`\\path[fill=teal,${options}]`, false, "none", "teal"],
      [`\\path[blue,${options}]`, noPaint, "none", "none"],
      [`\\draw[draw=none,blue,${options}]`, noPaint, "none", "none"]
    ]) {
      const items = paths(`${statement} ${line};`).filter(painted);
      const visible = markers || stroke !== "none" || fill !== "none";
      assert.equal(items.length, Number(visible), statement);
      if (!visible) continue;
      const [{ style }] = items;
      assert.equal(style.stroke, stroke, statement);
      assert.equal(style.fill, fill, statement);
      assert.equal(Boolean(style.markerStart), markers, statement);
      assert.equal(Boolean(style.markerEnd), markers, statement);
      if (markers && stroke === "none") assert.equal(style.arrowStroke, "blue", statement);
    }
    for (const geometry of ["(2,1)", "(2,1) -- (2,1)"]) {
      const items = paths(`\\draw[${options}] ${geometry};`);
      assert.equal(items.some(hasTips), degenerate, geometry);
      if (degenerate) assert.deepEqual(items[0].commands.at(-1), {
        type: geometry.includes("--") ? "lineTo" : "moveTo", x: 2, y: 1
      });
    }
  });
}

test("properness resets on each move and tests both cubic controls, not just its endpoint", () => {
  for (const [tail, proper] of [
    ["(2,0)", false], ["(2,0) -- (2,0)", false], ["(2,0) -- (3,0)", true],
    ["(2,0) .. controls (2,0) and (2,0) .. (2,0)", false],
    ["(2,0) .. controls (2,1) and (2,0) .. (2,0)", true],
    ["(2,0) .. controls (2,0) and (3,0) .. (2,0)", true],
    ["(2,0) -- (3,0) -- (2,0)", true]
  ]) {
    const [path] = paths(`\\draw[<->,tips=proper] (0,0) -- (1,0) ${tail};`);
    assert.equal(hasTips(path), proper, tail);
  }
});

test("never, clip, and a failed properness check bypass explicit shortening on both ends", () => {
  for (const [options, tail] of [["tips=never", ""], ["clip,tips=true", ""], ["tips=proper", " (3,0)"]]) {
    const [path] = paths(`\\draw[<->,${options},shorten <=2pt,shorten >=4pt] ${line}${tail};`);
    assert.equal(hasTips(path), false, options);
    assert.equal(path.style.shortenStart || 0, 0, options);
    assert.equal(path.style.shortenEnd || 0, 0, options);
    assert.deepEqual(path.commands.slice(0, 2), [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 2, y: 0 }]);
  }
  assert.deepEqual(paths(String.raw`\path[clip,tips,->] (0,0)--(2,0); \draw[<->,tips];`).filter(painted), []);
});

test("picture, scope, style, and path assignments override in order and do not leak", () => {
  const items = paths(String.raw`\begin{tikzpicture}[/pgf/tips=false,<->,allow/.style={tips=proper}]
    \draw (0,0)--(1,0);
    \begin{scope}[allow]
      \draw (0,1)--(1,1);
      \draw[tips=false,/pgf/tips] (0,2);
      \draw[/pgf/tips,tips=false] (0,3)--(1,3);
      \draw (0,4);
    \end{scope}
    \draw (0,5)--(1,5);
  \end{tikzpicture}`);
  assert.deepEqual(items.map(hasTips), [false, true, true, false, false, false]);
});

test("any closed source contour vetoes every tip, including separately lowered ellipses", () => {
  for (const geometry of [
    "(0,0) circle[radius=2pt]", "(0,0) ellipse[x radius=4pt,y radius=3pt] (3,0)",
    "(0,0) circle[radius=2pt] (2,0) -- (3,0)", "(2,0) -- (3,0) (0,0) rectangle (1,1)",
    "(0,0) -- (1,0) -- cycle (2,0) -- (3,0)"
  ]) {
    const items = paths(`\\draw[<->,tips=true,shorten >=5pt] ${geometry};`);
    assert.ok(items.some(item => item.commands.some(c => c.type === "closePath")), geometry);
    assert.ok(items.every(item => !hasTips(item) && !item.style.shortenEnd), geometry);
  }
  const [mixed] = paths(String.raw`\draw (0,0) -- (1,0) -- cycle (2,0) -- (3,0);`);
  assert.deepEqual(mixed.commands.map(c => c.type), ["moveTo", "lineTo", "closePath", "moveTo", "lineTo"]);
});

test("an edge is a separate paint action and its arrow options do not turn on the parent", () => {
  // TikZ boxes the edge, then ships it after the parent path. With two
  // overlapping strokes the native PDF has a red center and blue margins.
  const overlaid = paths(String.raw`\draw[blue,line width=4pt] (0,0) edge[red,line width=1.5pt] (2,0) -- (2,0);`);
  assert.deepEqual(overlaid.map(p => [p.subtype, p.style.stroke]), [[undefined, "blue"], ["edge", "red"]]);
  const closed = paths(String.raw`\path[draw=teal,>=latex,->] (0,0) rectangle (1,1) (2,0) edge (3,0);`);
  assert.equal(closed.find(item => item.subtype === "edge").style.stroke, "teal");
  assert.deepEqual(closed.filter(hasTips).map(item => item.subtype), ["edge"]);
  const open = paths(String.raw`\path (0,0) -- (1,0) edge[red,->] (2,0);`).filter(painted);
  assert.deepEqual(open.map(item => [item.subtype, item.style.stroke, hasTips(item)]), [["edge", "red", true]]);
  const separate = paths(String.raw`\draw[->] (0,0) edge[tips=false] (2,0);`);
  assert.equal(hasTips(separate.find(item => item.subtype === "edge")), false);
  assert.deepEqual(separate.filter(hasTips).map(item => item.commands), [[{ type: "moveTo", x: 0, y: 0 }]]);
});

test("legacy latex on an edge inherits fill ink independently from its shaft", () => {
  for (const [parent, local, stroke, fill] of [
    ["draw=teal", "", "teal", "black"], ["teal,draw", "", "teal", "teal"],
    ["red,draw=teal", "", "teal", "red"], ["fill=red,draw=teal", "", "teal", "red"],
    ["draw=teal", "draw=blue", "blue", "blue"]
  ]) {
    const edge = paths(`\\path[>=latex,->,${parent}] (0,0) edge[${local}] (2,0);`)
      .find(item => item.subtype === "edge");
    assert.equal(edge.style.stroke, stroke, parent);
    const tip = edge.style.markerEnd;
    assert.equal(tip.fill === "context-stroke" ? edge.style.stroke : tip.fill, fill, parent);
  }
});

test("TikZ defers a bare node border move, unlike an explicit center coordinate", () => {
  const items = paths(String.raw`\node (a) at (0,0) {A};
    \draw[->] (a) edge (2,0); \draw[->] (a); \draw[->] (a.center);`).filter(hasTips);
  assert.deepEqual(items.map(item => item.subtype === "edge"), [true, false]);
  assert.deepEqual(items[1].commands, [{ type: "moveTo", x: 0, y: 0 }]);
});

test("ordinary invisible paths and unpainted closed contours never acquire a shaft", () => {
  for (const statement of [
    String.raw`\path[red] (0,0)--(2,0);`, String.raw`\path[teal,tips] (0,0)--(2,0);`,
    String.raw`\path[red,->] (0,0)--(2,0);`, String.raw`\path[blue,->,tips] (0,0) circle[radius=1cm];`
  ]) assert.deepEqual(paths(statement).filter(painted), [], statement);
  const items = scene(String.raw`\path[teal,->] (0,0) node {A};`);
  assert.equal(items.find(item => item.type === "textNode").style.fill, "teal");
  assert.deepEqual(items.filter(item => item.type === "path" && painted(item)), []);
});

test("a late draw option paints a split source ellipse but never puts tips on it", () => {
  const [ellipse] = paths(String.raw`\path (0,0) circle[radius=1cm] [draw=blue,->,tips];`);
  assert.equal(ellipse.style.stroke, "blue");
  assert.equal(hasTips(ellipse), false);
});

test("a silent arrow path contributes unexpanded coordinates only while picture bounds are active", () => {
  const items = scene(String.raw`\draw[blue,->] (0,0)--(1,0);
    \path[<->,tips=never] (4,1)--(5,1);
    \path[<->,overlay] (6,1)--(7,1);
    \path[use as bounding box] (0,0) rectangle (1,1);
    \path[<->,tips=false] (8,1)--(9,1);`);
  const silent = items.find(item => item.type === "bbox" && item.commands[0]?.x === 4);
  assert.ok(silent);
  assert.equal(silent.retainZeroExtent, true);
  assert.ok(!silent.includeStrokeBounds && !silent.excludeFromBounds);
  assert.deepEqual(silent.commands, [{ type: "moveTo", x: 4, y: 1 }, { type: "lineTo", x: 5, y: 1 }]);
  assert.ok(!items.some(item => !item.overlay && !item.excludeFromBounds && item.commands?.[0]?.x >= 6));
  for (const source of [String.raw`\path[<->,tips=proper] (0,0);`, String.raw`\path[shorten >=2pt] (0,0)--(2,0);`]) {
    assert.equal(scene(source).find(item => item.type === "bbox")?.retainZeroExtent, true);
  }
  assert.equal(items.find(item => item.type === "bbox" && item.commands.some(c => c.type === "closePath"))?.retainZeroExtent, undefined);
});

test("every path overrides ambient tips before path-local options execute", () => {
  const items = paths(String.raw`\begin{tikzpicture}[tips=false,every path/.style={/pgf/tips}]
    \begin{scope}[tips=never]
      \draw[->] (0,0) -- (1,0);
      \draw[->,tips=false] (0,1) -- (1,1);
    \end{scope}
  \end{tikzpicture}`);
  assert.deepEqual(items.map(hasTips), [true, false]);
});

test("disabling draw preserves its last selected ink for arrows-only paint", () => {
  for (const [source, ink] of [
    [String.raw`\draw[draw=teal,draw=none,->,tips] (0,0)--(2,0);`, "teal"],
    [String.raw`\draw[draw=teal,red,draw=none,->,tips] (0,0)--(2,0);`, "red"],
    [String.raw`\draw[draw=teal,->,tips] (0,0)--(2,0) [draw=none];`, "teal"],
    [String.raw`\begin{scope}[draw=teal]\path[->,tips] (0,0)--(2,0);\end{scope}`, "teal"]
  ]) {
    const [item] = paths(source);
    assert.equal(item.style.stroke, "none", source);
    assert.equal(item.style.arrowStroke, ink, source);
  }
});
