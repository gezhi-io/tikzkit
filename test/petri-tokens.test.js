import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tikzToSvg } from "../src/index.js";
import { expandForeachScalarList } from "../src/tikz/commands/foreachScalarList.js";

const pt = 2.54 / 72.27;
const factors = [
  [], [[0,0]], [[-.5,0],[.5,0]], [[0,.57],[-.5,-.306025],[.5,-.306025]],
  [[-.5,.5],[.5,.5],[-.5,-.5],[.5,-.5]],
  [[0,.85],[-.808398,.26266],[.808398,.26266],[-.499617,-.687664],[.499617,-.687664]],
  [[-1,.5],[0,.5],[1,.5],[-1,-.5],[0,-.5],[1,-.5]],
  [[0,1],[-1,.5],[0,0],[1,.5],[-1,-.5],[0,-1],[1,-.5]],
  [[-.5,1],[.5,1],[-1,0],[0,0],[1,0],[-1,-1],[0,-1],[1,-1]],
  [[-1,1],[0,1],[1,1],[-1,0],[0,0],[1,0],[-1,-1],[0,-1],[1,-1]],
  Array.from({ length: 10 }, () => [0,0])
];

function scene(body, options = "", loaded = true) {
  const source = (loaded ? "\\usetikzlibrary{petri}\n" : "") +
    String.raw`\begin{tikzpicture}[${options}]${body}\end{tikzpicture}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
}

const boxes = items => items.filter(item => item.type === "nodeBox" && item.style.fill !== "none");
const paths = items => items.filter(item => item.type === "path");
const texts = items => items.filter(item => item.type === "textNode" && item.text).map(item => item.text);
function near(point, x, y, tolerance = .00005) {
  assert.ok(Math.abs(point.x-x) < tolerance && Math.abs(point.y-y) < tolerance,
    `(${point.x},${point.y}) != (${x},${y})`);
}

test("one through nine Petri layouts follow native child order; ten overlap and zero paints nothing", () => {
  for (const [count, positions] of factors.entries()) {
    const items = scene(`\\node[tokens=${count}] (p) at (2,-1) {};`, "token distance=10mm");
    const tokens = boxes(items);
    assert.equal(tokens.length, count, `tokens=${count}`);
    assert.equal(paths(items).length, 0);
    tokens.forEach((token, i) => {
      assert.equal(token.shape, "circle");
      assert.equal(token.style.fill, "black");
      near(token, 2+positions[i][0], -1+positions[i][1]);
    });
  }
  assert.equal(boxes(scene(String.raw`\node[tokens=-2] {}; \node[structured tokens={}] {};`)).length, 0);
});

test("token lists use foreach ranges, grouping, and styles; a token is a regular text node", () => {
  const grouped = scene(String.raw`\foreach \n in {5} {\node[structured tokens={1,3,...,\n,{u,v},x/y}] (p) {};}`,
    "every token/.style={fill=blue,text=red}");
  assert.deepEqual(texts(grouped), ["1","3","5","u,v","x/y"]);
  assert.ok(boxes(grouped).every(b => b.style.fill === "blue"));
  assert.ok(grouped.filter(t => t.type === "textNode" && t.text).every(t => t.style.fill === "red"));
  const colors = scene(String.raw`\node[colored tokens={red,blue,black,red!50!black}] {};`,
    "every token/.style={fill=yellow}");
  assert.deepEqual(boxes(colors).slice(0,3).map(t => t.style.fill), ["red","blue","black"]);
  assert.notEqual(boxes(colors)[3].style.fill, "yellow");
  assert.deepEqual(texts(scene(String.raw`\node[structured tokens={E,C,...,A}] {};`)), ["E","C","A"]);
});

test("token offsets follow the outer transform, not the xy basis or the parent's local options", () => {
  const items = scene(String.raw`
    \node[tokens=2,rotate=60,token distance=20pt] (p) at (1,1) {};
    \begin{scope}[rotate=90,xscale=2,x=3cm]
      \node[tokens=2] (s) at (0,0) {};
    \end{scope}
    \draw (p-1.center) -- (p-2.center);
  `, "token distance=10pt");
  const tokens = boxes(items);
  assert.equal(tokens.length, 4);
  near(tokens[0], 1-5*pt, 1); near(tokens[1], 1+5*pt, 1);
  near(tokens[2], 0, -10*pt); near(tokens[3], 0, 10*pt);
  assert.equal(paths(items).length, 1);
  near(paths(items)[0].commands[0], 1-5*pt, 1);
  near(paths(items)[0].commands[1], 1+5*pt, 1);
});

test("explicit token children suppress edges, preserve explicit and automatic names, and leave the next tree alone", () => {
  const items = scene(String.raw`
    \path node (p) at (2,3) {} [children are tokens,token distance=1cm]
      child {node[token] (named) {A}} child {node[rectangle,fill=blue] {B}};
    \draw (named.center) -- (p-2.center);
    \node (r) at (0,0) {} child {node (regular) {R}};
  `);
  assert.deepEqual(texts(items), ["A","B","R"]);
  assert.deepEqual(boxes(items).map(b => b.shape), ["circle","rectangle"]);
  assert.equal(paths(items).length, 2);
  near(paths(items)[0].commands[0], 1.5, 3); near(paths(items)[0].commands[1], 2.5, 3);
  near(items.find(t => t.text === "R"), 0,-1.5);
});

test("unloaded keys are inert; ordinary nodes, names, and child edges still work", () => {
  const items = scene(String.raw`\node[tokens=2] (p) {} [children are tokens] child {node (q) {Q}};
    \draw (p.center) -- (q.center);`, "", false);
  assert.equal(boxes(items).length, 0);
  assert.equal(paths(items).length, 2);
  near(items.find(t => t.text === "Q"), 0,-1.5);
});

test("explicit growth is inherited by grandchildren; a child-local grow changes placement but not edge suppression", () => {
  const items = scene(String.raw`\node (p) {} [/tikz/children are tokens,/tikz/token distance=10pt]
    child {node (a) {A} child {node {C}}}
    child[grow=up] {node {B}};`);
  const locate = text => items.find(i => i.type === "textNode" && i.text === text);
  near(locate("A"), -5*pt, 0); near(locate("C"), -5*pt, 0); near(locate("B"), 0, 1.5);
  assert.equal(paths(items).length, 0);
});

test("repeated token keys append in source order from the preceding group's last child", () => {
  const result = scene(String.raw`
    \node[tokens=2,structured tokens={A,B},tokens=1] (p) {};
    \draw (p-1.center) -- (p-2-1.center) -- (p-2-2-1.center);
  `, "token distance=1cm");
  assert.deepEqual(texts(result), ["A","B"]);
  assert.deepEqual(boxes(result).map(b => b.x), [-.5,.5,0,1,1]);
  assert.deepEqual(paths(result)[0].commands.map(c => c.x), [-.5,0,1]);
});

test("path-local appended nodes are named immediately and use the ambient 1.5ex distance", () => {
  const result = scene(String.raw`\draw (1,2) node[tokens=2] (p) {} (p-1.center) -- (p-2.center);`);
  const tokens = boxes(result);
  assert.equal(tokens.length, 2);
  near(tokens[0], 1-3.22916*pt, 2); near(tokens[1], 1+3.22916*pt, 2);
  near(paths(result)[0].commands.at(-1), 1+3.22916*pt, 2);
});

test("an invalid count or exhausted foreach budget reports the error without a partial node", () => {
  for (const [key, code] of [["tokens=oops","petri-invalid-token-count"],["tokens=20000","foreach-expansion-limit"],
    ["structured tokens={1,1,...,5}","foreach-nonprogressing-range"],["structured tokens={,,,,,,,,}","foreach-expansion-limit"]]) {
    const r = tikzToSvg(String.raw`\usetikzlibrary{petri}\begin{tikzpicture}
      \node[${key}] (bad) {bad}; \node (good) {good};\end{tikzpicture}`,
      { foreachLimits: { maxIterations: 5, maxCharacters: key.includes(",,") ? 8 : 50 } });
    assert.ok(r.diagnostics.some(d => d.code === code), JSON.stringify(r.diagnostics));
    assert.deepEqual(texts(r.ir.items), ["good"]);
  }
});

test("scalar PGF foreach ranges use scaled-point increments, context and literal-item history", () => {
  const list = expandForeachScalarList;
  assert.deepEqual(list("0,.1,...,.5"), ["0",".1","0.20001","0.30002","0.40002"]);
  assert.deepEqual(list("A_1,..._1,C_1"), ["A_1","B_1","C_1"]);
  assert.deepEqual(list("1,...,3,...,5"), ["1","2","3","2","3","4","5"]);
  assert.deepEqual(list("a,,{u,v},(x,y),x/y,"), ["a","","u,v","(x,y)","x/y",""]);
  assert.deepEqual(list(""), []);
  const env = { foreachBudget: { remainingIterations: 5, remainingCharacters: 50, remainingListScan: 3 } };
  assert.throws(() => list(",,,,", env), { code: "foreach-expansion-limit" });
  assert.equal(env.foreachBudget.remainingIterations, 5, "reject excessive scans before expansion");
});

test("recursive every-token appends fail with a diagnostic, not an interpreter stack overflow", () => {
  const result = tikzToSvg(String.raw`\usetikzlibrary{petri}\begin{tikzpicture}[every token/.style={tokens=1}]
    \node[tokens=1] (bad) {}; \node {good}; \end{tikzpicture}`);
  assert.ok(result.diagnostics.some(d => d.code === "foreach-expansion-limit"));
  assert.deepEqual(texts(result.ir.items), ["good"]);
});

test("installed TikZ agrees on all child anchors and PGF scalar-list expansions", t => {
  const engine = process.env.QA_LATEX_ENGINE || "pdflatex";
  if (spawnSync(engine, ["--version"]).error?.code === "ENOENT") return t.skip("TeX not installed");
  const dir = mkdtempSync(join(tmpdir(), "tikz-petri-tokens-"));
  try {
    const rows = [];
    for (let n = 1; n <= 10; n++) {
      rows.push(`\\node[tokens=${n}] (p${n}) {};`);
      for (let i = 1; i <= n; i++) rows.push(`\\probe{p${n}-${i}}`);
    }
    const lists = ["0,.1,...,.5", "Z,X,...,T", "s1,s...,s4", "1,...,3,...,5", "(x,y),{u,v},x/y,,"];
    const src = String.raw`\documentclass{article}\usepackage{tikz}\usetikzlibrary{petri}\makeatletter
      \def\probe#1{\pgf@process{\pgfpointanchor{#1}{center}}\typeout{TOKEN|#1|\the\pgf@x|\the\pgf@y}}
      \begin{document}\begin{tikzpicture}[token distance=10pt]
      ${rows.join("\n")}
      ${lists.map((s,i) => String.raw`\foreach \v in {${s}} {\typeout{SCALAR|${i}|\v}}`).join("\n")}
      \end{tikzpicture}\end{document}`;
    writeFileSync(join(dir,"t.tex"), src);
    const run = spawnSync(engine, ["-no-shell-escape","-draftmode","-interaction=nonstopmode","-halt-on-error","t.tex"],
      { cwd: dir, encoding: "utf8", timeout: 15000 });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout.slice(-1500));
    const records = [...run.stdout.matchAll(/^TOKEN\|p(\d+)-(\d+)\|([-\d.]+)pt\|([-\d.]+)pt/gm)];
    assert.equal(records.length, 55);
    const scenes = factors.map((_,n) => boxes(scene(`\\node[tokens=${n}] {};`, "token distance=10pt")));
    for (const [,n,i,x,y] of records) near(scenes[n][i-1], Number(x)*pt, Number(y)*pt);
    const scalars = [...run.stdout.matchAll(/^SCALAR\|(\d+)\|([^\r\n]*)$/gm)];
    for (const [i,s] of lists.entries()) {
      assert.deepEqual(expandForeachScalarList(s), scalars.filter(row => Number(row[1]) === i).map(row => row[2]), s);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
