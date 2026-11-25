import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const optional = { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" };
const ptPerCm = 72.27 / 2.54;
const xLog = "xmode=log,log basis x=2,xmin=.25,xmax=16";
const yLog = "ymode=log,log basis y=10,ymin=.1,ymax=1000";
const doubleLog = `${xLog},${yLog}`;
const bothAxes = mode => `x dir=both,x ${mode},y dir=both,y ${mode}`;
const explicit = bothAxes("explicit");
const mixed = "(1,-2) +=(1,5) -=(.5,2) (2,1) +-(2,0) (3,0) +=(-4,-2) -=(2,1)";
const cases = [
  ...["0", "infty"].map(origin => ({ id: `origin-${origin}`, axis: `${xLog},ymin=-4,ymax=4,log origin x=${origin}`,
    errors: explicit, coords: mixed, arms: 10 })),
  { id: "relative", axis: `${yLog},xmin=-4,xmax=4`, errors: bothAxes("explicit relative"), arms: 9,
    coords: "(-2,10) +=(.5,.5) -=(.25,1) (0,1) +=(0,0) -=(.9,-1) (2,10) +=(0,-2) -=(0,1.25)" },
  { id: "fixed", axis: doubleLog, errors: "x dir=both,x fixed=2,y dir=both,y fixed=10",
    coords: "(2,10) (1,1)", arms: 4 },
  { id: "fixed-relative", axis: doubleLog, errors: "x dir=both,x fixed relative=.5,y dir=both,y fixed relative=-.5",
    coords: "(1,1) (4,10)", arms: 8 },
  { id: "linear-factor", axis: `${yLog},xmin=-8,xmax=8`, errors: "x dir=both,x fixed relative=2,y dir=plus,y fixed relative=.25",
    coords: "(-2,10)", arms: 3 },
  { id: "auto", axis: "xmode=log,log basis x=2", errors: explicit,
    coords: "(1,-1) +=(1,3) -=(.5,2) (4,2) +=(4,4) -=(8,0)", arms: 7, limits: [-1, 3, -3, 6] },
  ...["jump", "discard"].map(policy => ({ id: policy, axis: `ymode=log,unbounded coords=${policy}`,
    errors: "x dir=both,x fixed=.25,y dir=plus,y fixed=1", coords: "(1,1) (2,2) (10000,0) (20000,-1) (3,3) (4,4)",
    arms: 12, limits: [.75, 4.25, 0, Math.log(5)], ops: policy === "jump" ? "MLML" : "MLLL" }))
];

// pgfplots.errorbars.code.tex:260-480. Read the actual draw callback, not a JS
// reconstruction of log(x +/- e). Its raw coordinates need the frame offset.
const preamble = String.raw`\documentclass{article}\usepackage{pgfplots}\pgfplotsset{compat=1.18}
\makeatletter
\def\oraclepos#1{\pgf@process{\pgfpointdiff{\pgfpointanchor{oracleSW}{center}}{\pgfpointanchor{#1}{center}}}}
\pgfplotsset{error bars/draw error bar/.code 2 args={%
  \path (rel axis cs:0,0) coordinate (oracleSW) #1 coordinate (oracleFrom) #2 coordinate (oracleTo);
  \oraclepos{oracleFrom}\edef\oraclefromxy{\strip@pt\pgf@x|\strip@pt\pgf@y}
  \oraclepos{oracleTo}\typeout{ARM|\oracleid|\oraclefromxy|\strip@pt\pgf@x|\strip@pt\pgf@y}}}
\def\oracleops{\begingroup\pgfgetpath\oraclepath
  \def\pgfsyssoftpath@movetotoken##1##2{M}\def\pgfsyssoftpath@linetotoken##1##2{L}
  \typeout{OPS|\oracleid|\oraclepath}\endgroup}
\def\oraclelimits{\typeout{LIMIT|\oracleid|\pgfkeysvalueof{/pgfplots/xmin}|\pgfkeysvalueof{/pgfplots/xmax}|\pgfkeysvalueof{/pgfplots/ymin}|\pgfkeysvalueof{/pgfplots/ymax}}}
\begin{document}`;

function picture(c, native = false) {
  const plots = (c.plots || [c]).map(p => String.raw`\addplot[mark=none,error bars/.cd,${p.errors}]
    coordinates {${p.coords}}${native && c.ops ? String.raw` \pgfextra{\oracleops}` : ""};`);
  return String.raw`${native ? `\\def\\oracleid{${c.id}}` : ""}\begin{tikzpicture}
    \begin{axis}[hide axis,scale only axis,width=6cm,height=4cm,enlargelimits=false,clip=false,${c.axis}]
    ${plots.join("\n")}
    ${native && c.limits ? String.raw`\pgfplotsextra{\oraclelimits}` : ""}
    \end{axis}\end{tikzpicture}`;
}

function runNative(inputs, expectError = false) {
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-log-errors-"));
  try {
    writeFileSync(join(dir, "probe.tex"), [preamble, ...inputs.map(c => picture(c, true)), "\\end{document}"].join("\n"));
    const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex", ["-no-shell-escape", "-interaction=nonstopmode",
      ...(expectError ? [] : ["-halt-on-error"]), "probe.tex"], { cwd: dir, encoding: "utf8", timeout: 20000 });
    assert.ifError(run.error);
    assert.equal(run.status, expectError ? 1 : 0, run.stdout.slice(-1500));
    return readFileSync(join(dir, "probe.log"), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function records(log, kind, id) {
  return log.split(/\r?\n/).filter(line => line.startsWith(`${kind}|${id}|`)).map(line => line.split("|").slice(2));
}

function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance,
    `${label}: got ${actual}, expected ${expected} (+/- ${tolerance})`);
}

test("log error-bar origins, tips and automatic limits match installed PGFPlots", optional, async t => {
  const log = runNative(cases);
  for (const c of cases) await t.test(c.id, () => {
    const nativeArms = records(log, "ARM", c.id).map(row => row.map(Number));
    assert.equal(nativeArms.length, c.arms, "native arm count");
    if (c.limits) {
      // Native limit keys are in the survey axis's log base (natural by default).
      const ranges = records(log, "LIMIT", c.id);
      assert.equal(ranges.length, 1);
      c.limits.forEach((value, i) => near(Number(ranges[0][i]), value, .001, `native range ${i}`));
    }
    const { ir, diagnostics } = tikzToSvg(picture(c));
    assert.deepEqual(diagnostics, []);
    if (c.ops) {
      assert.deepEqual(records(log, "OPS", c.id), [[c.ops]], "native measured line");
      const path = ir.items.filter(i => i.subtype === "axis-plot").flatMap(i => i.commands);
      assert.deepEqual(path.map(op => op.type), [...c.ops].map(op => op === "M" ? "moveTo" : "lineTo"));
    }
    const stems = ir.items.filter(i => i.subtype === "axis-error-bar");
    assert.equal(stems.length, nativeArms.length, "public arm count");
    for (const [i, stem] of stems.entries()) {
      assert.deepEqual(stem.commands.map(p => p.type), ["moveTo", "lineTo"]);
      const coords = stem.commands.flatMap(p => [p.x, p.y]);
      coords.forEach((cm, j) => near(cm * ptPerCm, nativeArms[i][j], .03, `arm ${i} coordinate ${j} (TeX pt)`));
    }
  });
});

test("invalid fixed-relative factors report one package error per dimension per plot", optional, () => {
  const c = { id: "bad", axis: doubleLog, plots: [
    { errors: "x dir=plus,x fixed relative=1", coords: "(2,10) (3,5)" },
    { errors: "x dir=plus,x fixed relative=1.5,y dir=minus,y fixed relative=-1.25", coords: "(1,1) (4,10)" }
  ] };
  const log = runNative([c], true);
  const errors = (log.match(/^! [^\n]+(?:\n[^\n]+)*/gm) || []).map(message => message.replace(/\r?\n/g, ""));
  const factors = errors.map(message =>
    message.match(/^! Package pgfplots Error: Sorry, log\(1 ([-+]).*?error bar\/([xy]) fixed relative/)?.slice(1));
  assert.deepEqual(factors, [["-", "x"], ["-", "x"], ["+", "y"]], "native errors, including unrequested sides");
  const { diagnostics } = tikzToSvg(picture(c));
  assert.deepEqual(diagnostics.map(d => [d.code, d.severity]),
    factors.map(() => ["PGFPLOTS_LOG_ERROR_FACTOR", "error"]));
});
