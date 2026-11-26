import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

// Native pgfcircmonopoles.tex saves the southeast corner relative to the
// connection, not the ink bounds or a symmetric rectangle around its center.
const controls = [
  { id: "coordinate", decl: String.raw`\coordinate[ground] (G);`, origin: [0,0], right: [.21,0], down: [0,-.56] },
  { id: "plain", decl: String.raw`\node[ground] (G) at (2,1) {};`, origin: [2,1], right: [.21,0], down: [0,-.56] },
  { id: "south", decl: String.raw`\coordinate[shape=ground,anchor=south,outer sep=6mm,inner sep=8mm] (G) at (2,1);`,
    origin: [2,1.56], right: [.21,0], down: [0,-.56] },
  { id: "se", decl: String.raw`\node[cground,anchor=south east] (G) at (2,1) {};`,
    origin: [1.65,1.7], right: [.35,0], down: [0,-.7] },
  { id: "zero-depth", decl: String.raw`\coordinate[tground,anchor=south east] (G) at (2,1);`,
    origin: [1.79,1], right: [.21,0], down: [0,0] },
  { id: "inline", decl: String.raw`\draw (0,0) -- (2,1) node[rground,rotate=90,scale=2,anchor=south] (G) {};`,
    origin: [1.3,1], right: [0,.42], down: [.7,0] },
  { id: "sloped", decl: String.raw`\draw (0,0) -- (0,4) node[midway,sloped,ground,anchor=south] (G) {};`,
    origin: [-.56,2], right: [0,.21], down: [.56,0] },
  { id: "picture", picture: "scale=2,rotate=90", decl: String.raw`\node[ground] (G) at (1,2) {};`,
    origin: [-4,2], right: [.21,0], down: [0,-.56] },
  { id: "shape", picture: "scale=2,rotate=90,transform shape", decl: String.raw`\node[ground] (G) at (1,2) {};`,
    origin: [-4,2], right: [0,.42], down: [1.12,0] },
  { id: "reset", picture: "xscale=-2,yscale=.5", decl: String.raw`\node[ground] (G) at (1,2) {};`,
    origin: [-2,1], right: [.21,0], down: [0,-.56] },
  { id: "affine", picture: "xscale=-2,yscale=.5,transform shape",
    decl: String.raw`\node[ground,rotate=90,xscale=2,yscale=3,anchor=south east] (G) at (1,2) {};`,
    origin: [1.36,.79], right: [0,.21], down: [-3.36,0] },
  { id: "style", picture: "scale=3,every node/.style={rotate=90,yscale=2}",
    decl: String.raw`\node[ground,xscale=2,anchor=south east] (G) at (1,2) {};`,
    origin: [1.88,5.58], right: [0,.42], down: [1.12,0] },
  { id: "settings", decl: String.raw`\ctikzset{bipoles/length=2cm,grounds/scale=1.5}
    \begin{scope}[circuitikz/monopoles/ground/width=.4]
      \coordinate[sground,circuitikz/grounds/scale=2,anchor=south] (G) at (2,1);
    \end{scope}\ctikzset{grounds/scale=.5}`, origin: [2,3.88], right: [.96,0], down: [0,-2.88] },
  { id: "text", decl: String.raw`\node[ground,anchor=text] (G) at (2,1) {GroundTextProbe};`,
    origin: [2,1], right: [.21,0], down: [0,-.56] },
  ...[["tlground",.21,.14,"center"],["nground",.315,.56,"north"],["pground",.315,.63,"left"],
    ["eground",.385,.595,"right"],["eground2",.385,.595,"north"]].map(([kind,w,d,anchor]) => ({
    id: kind, decl: String.raw`\node[shape=${kind},anchor=${anchor}] (G) at (2,1) {};`,
    origin: [2,1], right: [w,0], down: [0,-d]
  }))
];
const factors = {
  center:[0,0], north:[0,0], left:[0,0], right:[0,0], text:[0,0], "45":[0,0],
  "north east":[1,0], east:[1,.5], "south east":[1,1], south:[0,1],
  "south west":[-1,1], west:[-1,.5], "north west":[-1,0]
};
const anchors = Object.keys(factors);
const picture = (c, probe) => String.raw`\begin{tikzpicture}[${c.picture ?? ""}]
  ${c.decl}
  ${probe}
  \end{tikzpicture}`;
function render(c) {
  const probe = anchors.map((a,i) => String.raw`\coordinate (probe${i}) at (G.${a});`).join("\n");
  const { ir, diagnostics } = tikzToSvg(picture(c, probe));
  assert.deepEqual(diagnostics, []);
  return Object.fromEntries(anchors.map((a,i) => [a,ir.coordinates["probe" + i]]));
}
function near(p, x, y, label) {
  assert.ok(p && Math.max(Math.abs(p.x-x), Math.abs(p.y-y)) < .00012,
    `${label}: expected (${x}, ${y}), got ${JSON.stringify(p)}`);
}

for (const c of controls) test("ground registration and placement: " + c.id, () => {
  const points = render(c);
  for (const [name,[a,b]] of Object.entries(factors)) {
    near(points[name], c.origin[0]+a*c.right[0]+b*c.down[0], c.origin[1]+a*c.right[1]+b*c.down[1], name);
  }
});

test("bare ground endpoints meet the connection from either side, not the symbol border", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\begin{circuitikz}
    \node[ground] (G) at (1,1) {};
    \draw[red] (-1,0) -- (G); \draw[blue] (G) -- (1,-2);
    \end{circuitikz}`);
  assert.deepEqual(diagnostics, []);
  near(ir.items.find(i => i.style?.stroke === "red").commands.at(-1), 1, 1, "end");
  near(ir.items.find(i => i.style?.stroke === "blue").commands[0], 1, 1, "start");
  assert.ok(ir.items.some(i => i.subtype === "circuitikz-ground"));
});

test("registered ground anchors are replaced when the name is reused", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\begin{circuitikz}
    \node[ground] (G) at (0,1) {}; \coordinate (first) at (G.south);
    \draw (2,1) node[cground] (G) {};
    \coordinate[ground] (R) at (2,2); \coordinate (R) at (3,2);
    \coordinate (second) at (R.south);
    \node[ground] (N) at (4,1) {}; \node[rectangle,minimum size=1cm,outer sep=0pt] (N) at (6,2) {};
    \coordinate (third) at (N.south); \end{circuitikz}`);
  assert.deepEqual(diagnostics, []);
  near(ir.coordinates.first, 0, .44, "original saved ground");
  near(ir.coordinates["G.south east"], 2.35, .3, "replacement ground");
  near(ir.coordinates["G.right"], 2, 1, "connection");
  near(ir.coordinates.second, 3, 2, "replacement coordinate");
  near(ir.coordinates.third, 6, 1.5, "replacement rectangle");
});

test("the transformed rground bar ends meet its saved southwest and southeast anchors", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\begin{circuitikz}[xscale=-2,yscale=.5,transform shape]
    \draw (0,0) -- (1,2) node[rground,rotate=30,xscale=.7,yscale=2,anchor=south east] (G) {};
    \end{circuitikz}`);
  assert.deepEqual(diagnostics, []);
  const bar = ir.items.find(i => i.subtype === "circuitikz-rground");
  assert.deepEqual(bar?.commands.map(c => c.type), ["moveTo", "lineTo"]);
  for (const [i,name] of ["south west","south east"].entries()) {
    const anchor = ir.coordinates["G." + name];
    near(bar.commands[i], anchor.x, anchor.y, name);
  }
  near(bar.commands[1], -2, 1, "authored placement");
});

test("installed Circuitikz ground anchor registers match named lookups after the node group closes", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 for MacTeX"
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "ctikz-ground-anchors-"));
  try {
    const header = String.raw`\documentclass{article}\usepackage{circuitikz}\makeatletter
      \def\probe#1#2{\pgf@process{\pgfpointanchor{G}{#2}}\typeout{G|#1|#2|\number\pgf@x|\number\pgf@y}}
      \begin{document}`;
    const tex = controls.map(c => picture(c, "\\pgftransformreset\n" +
      anchors.map(a => `\\probe{${c.id}}{${a}}`).join("\n"))).join("\n");
    writeFileSync(join(dir, "ground.tex"), header + tex + "\\end{document}");
    execFileSync("pdflatex", ["-draftmode", "-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", "ground.tex"],
      { cwd: dir, timeout: 30000 });
    const expected = readFileSync(join(dir, "ground.log"), "utf8").split(/\r?\n/).filter(s => s.startsWith("G|"));
    assert.equal(expected.length, controls.length * anchors.length);
    const runs = new Map(controls.map(c => [c.id,render(c)]));
    const spPerCm = 65536 * 72.27 / 2.54;
    for (const row of expected) {
      const [,id,name,x,y] = row.split("|");
      near(runs.get(id)[name], Number(x)/spPerCm, Number(y)/spPerCm, id+"."+name);
    }
  } finally {
    rmSync(dir, { recursive:true, force:true });
  }
});
