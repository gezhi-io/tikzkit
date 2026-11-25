import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const frame = "hide axis,scale only axis,width=4cm,height=6cm,xmin=0,xmax=4,ymin=0,ymax=6,enlargelimits=false";
const viewport = { minX: 0, minY: 0, maxX: 4, maxY: 6 };
const variants = [
  ["const plot mark left",  "M-1,1 L2,1 L2,4 L5,4 L5,7"],
  ["const plot mark right", "M-1,1 L-1,4 L2,4 L2,7 L5,7"],
  ["const plot mark mid",   "M-1,1 L0.5,1 L0.5,4 L2,4 L3.5,4 L3.5,7 L5,7"],
  ["jump mark left",        "M-1,1 L2,1 M2,4 L5,4 M5,7"],
  ["jump mark right",       "M-1,1 M-1,4 L2,4 M2,7 L5,7"],
  ["jump mark mid",         "M-1,1 L0.5,1 M0.5,4 L2,4 L3.5,4 M3.5,7 L5,7"]
];
const sampled = variants.flatMap(([handler, path]) => ["{x+2}", "({x},{x+2})"].map(source => ({
  handler, path, source, axis: "domain=-1:5,samples=3", marks: [[2,4]]
})));
const missedCorner = {
  handler: "const plot", source: "{3*x+7}", axis: "domain=-2:1,samples=2",
  path: "M-2,1 L1,1 L1,10", marks: []
};
const rows = "coordinates {(0,2)(1,4)(2,nan)(3,1)(4,3)}";
const breaks = [
  ["const plot mark right", "jump", "M0,2 L0,4 L1,4 M3,1 L3,3 L4,3"],
  ["jump mark mid", "jump", "M0,2 L0.5,2 M0.5,4 L1,4 M3,1 L3.5,1 M3.5,3 L4,3"],
  ["jump mark mid", "discard", "M0,2 L0.5,2 M0.5,4 L1,4 L2,4 M2,1 L3,1 L3.5,1 M3.5,3 L4,3"]
].map(([handler, policy, path]) => ({ handler, source: rows, axis: "unbounded coords=" + policy,
  path, marks: [[0,2],[1,4],[3,1],[4,3]] }));
const blankRow = { ...breaks[1], axis: "empty line=jump", source: rows.replace("(2,nan)", "\\par ") };

function picture(c, native = false) {
  return String.raw`\begin{tikzpicture}\begin{axis}[${frame},${c.axis},${c.handler}]
    \addplot[mark=*] ${c.source}${native ? String.raw` \pgfextra{\steppath{plot}}` : ""};
    \end{axis}\end{tikzpicture}`;
}

function items(source) {
  const { ir, diagnostics } = tikzToSvg("\\pgfplotsset{compat=1.18}" + source);
  assert.deepEqual(diagnostics, []);
  return ir.items;
}

function trace(commands, origin = { x: 0, y: 0 }) {
  return commands.map(p => p.type === "closePath" ? "Z" : ({ moveTo: "M", lineTo: "L" })[p.type] +
    Number((p.x - origin.x).toFixed(6)) + "," + Number((p.y - origin.y).toFixed(6))).join(" ");
}

function render(c) {
  const scene = items(picture(c));
  const plots = scene.filter(p => p.subtype === "axis-plot");
  assert.equal(plots.length, 1, "the staircase should produce a path");
  const [plot] = plots;
  const marks = scene.filter(p => p.subtype === "axis-mark").map(p => [p.cx, p.cy]);
  return { path: trace(plot.commands), marks, clip: plot.clipRect };
}

test("sampled staircases clip the finished path, never the chords or synthetic mark positions", () => {
  for (const c of sampled) {
    assert.deepEqual(render(c), { path: c.path, marks: c.marks, clip: viewport }, c.handler + " " + c.source);
  }
});

test("a step corner can be visible even when the chord and both observations miss the frame", () => {
  assert.deepEqual(render(missedCorner), { path: missedCorner.path, marks: [], clip: viewport });
});

test("PGFPlots restarts step handlers at a NaN or blank-row jump but connects across a discard", () => {
  for (const c of [...breaks, blankRow]) {
    assert.deepEqual(render(c), { path: c.path, marks: c.marks, clip: viewport }, c.handler + " " + c.axis);
  }
});

test("a dashed jump legend restarts its stroke at the native miniature plot's jump positions", () => {
  const scene = items(String.raw`\begin{tikzpicture}\begin{axis}[${frame}]
    \addplot[jump mark mid,dashed,mark=*] coordinates {(0,1)(2,4)(4,1)};
    \addlegendentry{$s$}\end{axis}\end{tikzpicture}`);
  const image = scene.find(p => p.style?.dashArray && p.subtype !== "axis-plot");
  assert.ok(image, "expected a dashed legend sample");
  const start = image.commands[0];
  // Native PDF in bp: 0m 4.25204l 4.25204m 8.50412l 12.75616l 12.75616m 17.00826l.
  assert.equal(trace(image.commands, start), "M0,0 L0.15,0 M0.15,0 L0.3,0 L0.45,0 M0.45,0 L0.6,0");
  const marks = scene.slice(scene.indexOf(image) + 1).filter(p => p.subtype === "axis-mark");
  assert.equal(marks.length, 1);
  assert.ok(Math.abs(marks[0].cx - start.x - 0.3) < 0.00001);
  assert.equal(marks[0].cy, start.y);
});

test("the reversed stacked baseline mirrors connected const handlers but not jump handlers", () => {
  for (const [handler, tail] of [
    ["const plot mark left", "L2,1 L2,2 L1,2 L1,1 L0,1 Z"],
    ["const plot mark right", "L2,1 L1,1 L1,2 L0,2 L0,1 Z"],
    ["jump mark left", "L2,1 L1,1 M1,2 L0,2 M0,1 Z"],
    ["jump mark right", "L2,1 M2,2 L1,2 M1,1 L0,1 Z"]
  ]) {
    const scene = items(String.raw`\begin{tikzpicture}\begin{axis}[${frame},stack plots=y,${handler}]
      \addplot[mark=none] coordinates {(0,1)(1,2)(2,1)} \closedcycle;
      \addplot[red,mark=none] coordinates {(0,2)(1,1)(2,3)} \closedcycle;
      \end{axis}\end{tikzpicture}`);
    const upper = scene.find(p => p.subtype === "axis-closed-cycle" && p.style.stroke === "red");
    assert.equal(trace(upper.commands.slice(-6)), tail, handler);
  }
});

// Replay the same inputs through PGFPlots. Log the actual PGF soft path both
// at the plot tail and when PGF consumes the clip, plus the mark origins.
test("MacTeX staircase paths, paint clips and marker centers match the recorded geometry", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const cases = [...sampled, missedCorner, ...breaks, blankRow];
  const tex = String.raw`\documentclass{article}\usepackage{pgfplots}\pgfplotsset{compat=1.18}
\makeatletter
\def\stepop#1#2#3{\typeout{STEP|\stepid|\stepkind|#1|\strip@pt\dimexpr#2\relax|\strip@pt\dimexpr#3\relax}}
\def\steppath#1{\begingroup\def\stepkind{#1}\pgfgetpath\steptokens
  \def\pgfsyssoftpath@movetotoken{\stepop{M}}\def\pgfsyssoftpath@linetotoken{\stepop{L}}%
  \def\pgfsyssoftpath@closepathtoken##1##2{\typeout{STEP|\stepid|\stepkind|Z}}\steptokens\endgroup}
\let\stepusepath\pgfusepath \def\stepclip{clip}
\def\pgfusepath#1{\def\stepaction{#1}\ifx\stepaction\stepclip\steppath{clip}\fi\stepusepath{#1}}
\let\stepusemark\pgfuseplotmark
\def\pgfuseplotmark#1{\begingroup\def\stepkind{mark}\pgfpointtransformed{\pgfpointorigin}%
  \stepop{M}{\pgf@x}{\pgf@y}\endgroup\stepusemark{#1}}
\begin{document}` + cases.map((c, i) => `\\def\\stepid{${i}}` + picture(c, true)).join("\n") + "\\end{document}";
  const cwd = mkdtempSync(join(tmpdir(), "pgfplots-staircase-"));
  try {
    writeFileSync(join(cwd, "probe.tex"), tex);
    execFileSync("pdflatex", ["-draftmode", "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "probe.tex"],
      { cwd, timeout: 30000 });
    const log = readFileSync(join(cwd, "probe.log"), "utf8").split(/\r?\n/);
    for (const [i, c] of cases.entries()) {
      const recordsFor = kind => log.filter(line => line.startsWith(`STEP|${i}|${kind}|`)).map(line => line.split("|").slice(3));
      // The native data scaling can place the axis SW away from (0,0).
      const origin = recordsFor("clip")[0].slice(1).map(Number);
      for (const [kind, tokens] of [["plot", c.path.split(" ")], ["clip", ["M0,0","L4,0","L4,6","L0,6","Z"]],
        ["mark", c.marks.map(([x,y]) => `M${x},${y}`)]]) {
        const records = recordsFor(kind);
        assert.equal(records.length, tokens.length, `${c.handler} ${kind}: ${JSON.stringify(records)}`);
        for (const [j, [op, ...pt]] of records.entries()) {
          assert.equal(op, tokens[j][0]);
          const xy = tokens[j].slice(1).split(",").map(Number);
          pt.forEach((v, k) => assert.ok(Math.abs((Number(v) - origin[k]) * 2.54 / 72.27 - xy[k]) < 0.001,
            `${c.handler} ${kind}: ${v - origin[k]}pt vs ${xy[k]}cm`));
        }
      }
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
