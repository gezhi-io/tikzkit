import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseOptions } from "../src/engine/options.js";
import { explicitFillBetweenClipBox } from "../src/pgfplots/fillBetweenClipSelectors.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

const paths = {
  frame: "(axis description cs:0,0) rectangle (axis description cs:1,1)",
  bare: "(3,6) rectangle (4,7)",
  ax: "(axis cs:3,6) rectangle (axis cs:4,7)",
  phys: "(0pt,0pt) rectangle (1cm,7pt)",
  pt: "(10pt,20pt) rectangle (30pt,40pt)",
  mixed: "(1cm,6) rectangle (3,7pt)",
  rel: "(rel axis cs:.25,.75) rectangle (rel axis cs:.75,.25)",
  logmid: "(100,6) rectangle (200,7)",
  axlogmid: "(axis cs:100,6) rectangle (axis cs:200,7)"
};

// Literal MacTeX measurements in picture-space TeX pt: M and the second L of
// the activated clipping rectangle. Raw scanner A/B are NOT these vertices.
const linearFrame = [85.36008, 99.58647], logFrame = [85.35728, 99.58647];
const unscaledFrame = [85.35928, 99.58519];
const dataCorners = [142.26468, 142.26378, 199.16928, 156.48955];
const physical = [85.36008, 99.58647, 113.81282, 106.58647];
const modern = {
  bare: dataCorners, ax: dataCorners, phys: physical, pt: [95.36008, 119.58647, 115.36008, 139.58647],
  mixed: [0.00362, 142.26378, 142.26468, 63.90916]
};
const unscaled = {
  bare: [142.26428, 142.26378, 199.16928, 156.48997],
  phys: [-28.45071, 56.9066, 0.00203, 63.9066], mixed: [0.00203, 142.26378, 142.26428, 63.9066]
};
const logData = [199.16928, 142.26378, 233.42555, 156.48955];
const logPhysical = [-28.45471, 99.58647, -0.00197, 106.58647];
const variants = [
  ["modern", "1.18", "", linearFrame, modern],
  ["1.11 substitution threshold", "1.11", "", linearFrame, { bare: dataCorners }],
  ["legacy", "1.10", "", linearFrame, {
    bare: [87.06721, 100.44002, 87.63626, 100.58228], ax: dataCorners, phys: physical,
    mixed: [113.81282, 100.44002, 87.06721, 106.58647]
  }],
  ["legacy resized", "1.10", "width=4cm,height=6cm", [199.17415, 85.36557], {
    bare: [200.0277, 87.07266, 200.31221, 87.35718], mixed: [227.62689, 87.07266, 200.0277, 92.36557]
  }],
  ["both axes reversed", "1.18", "x dir=reverse,y dir=reverse", linearFrame, {
    bare: [256.07388, 142.26378, 199.16928, 128.03801], phys: [312.97849, 184.94109, 341.43123, 191.94109],
    mixed: [455.24043, 142.26378, 256.07388, 234.6184], rel: [142.26468, 163.60243, 256.07388, 120.92513]
  }],
  ["legacy reversed", "1.10", "x dir=reverse,y dir=reverse", linearFrame, {
    bare: [311.27135, 184.08754, 310.7023, 183.94528], mixed: [341.43123, 184.08754, 311.27135, 191.94109]
  }],
  ["log", "1.18", "xmode=log", logFrame, { logmid: logData, axlogmid: logData, phys: logPhysical }],
  ["legacy log", "1.10", "xmode=log", logFrame, {
    bare: [119.82927, 100.44002, 169.25726, 100.58228], ax: [25.84624, 142.26378, 40.0669, 156.48955],
    phys: logPhysical
  }],
  ["reversed log", "1.18", "xmode=log,x dir=reverse", logFrame, {
    logmid: [199.16928, 142.26378, 164.91301, 156.48955], phys: [426.79327, 99.58647, 455.24602, 106.58647]
  }],
  ["disabled data scaling", "1.18", "disabledatascaling", unscaledFrame, unscaled],
  ["legacy disabled data scaling", "1.10", "disabledatascaling", unscaledFrame, {
    ...unscaled, pt: [-18.45071, 76.9066, 1.54929, 96.9066]
  }]
];

const ptPerCm = 72.27 / 2.54;
const localCorners = (corners, frame) => corners.map((n, i) => n - frame[i % 2]);
function nearPt(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, label + ": got " + actual + "pt, native " + expected + "pt");
}

for (const [label, compat, extras, frame, probes] of variants) {
  const axis = parseOptions("compat=" + compat + ",scale only axis,width=8cm,height=3cm,enlargelimits=false," + extras);
  const ranges = { xMin: axis.xmode === "log" ? 10 : 2, xMax: axis.xmode === "log" ? 1000 : 6, yMin: 3, yMax: 9 };
  Object.assign(axis, { xmin: ranges.xMin, xmax: ranges.xMax, ymin: 3, ymax: 9 });
  const geometry = createAxisGeometry(axis, ranges);
  for (const [id, corners] of Object.entries(probes)) {
    test("native soft-clip rectangle: " + label + ", " + paths[id], () => {
      const box = explicitFillBetweenClipBox(paths[id], ranges, geometry, axis);
      assert.ok(box, "missing rectangle");
      const [x0, y0, x1, y1] = localCorners(corners, frame);
      const { minX, minY, maxX, maxY, ...flags } = box;
      // 0.03 TeX pt (<0.011 mm) accommodates fixed-point axis basis rounding.
      nearPt(minX * ptPerCm, Math.min(x0, x1), .03, "minX");
      nearPt(minY * ptPerCm, Math.min(y0, y1), .03, "minY");
      nearPt(maxX * ptPerCm, Math.max(x0, x1), .03, "maxX");
      nearPt(maxY * ptPerCm, Math.max(y0, y1), .03, "maxY");
      assert.deepEqual(flags, { ...(x0 > x1 && { flipX: true }), ...(y0 > y1 && { flipY: true }) });
    });
  }
}

test("local pdflatex replays the painted vertices of modern bare, physical and mixed rectangles", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-corner-coordinates-"));
  try {
    const ids = ["frame", "bare", "phys", "pt", "mixed"];
    const windows = ids.map(id => "\\Window{" + paths[id] + "}").join("\n");
    const tex = String.raw`\documentclass{article}
\usepackage{pgfplots}
\usepgfplotslibrary{fillbetween}
\pgfplotsset{compat=1.18}
\makeatletter
\newwrite\tracefile
\def\vertex#1#2#3{\immediate\write\tracefile{#1 \number\dimexpr#2\relax\space\number\dimexpr#3\relax}}
\let\originalactivate\tikzlibsoftclip@setkey@@activate
\def\tikzlibsoftclip@setkey@@activate{\originalactivate\begingroup
  \def\pgfsyssoftpath@movetotoken##1##2{\vertex{M}{##1}{##2}}%
  \def\pgfsyssoftpath@linetotoken##1##2{\vertex{L}{##1}{##2}}%
  \def\pgfsyssoftpath@closepathtoken##1##2{\immediate\write\tracefile{Z}}%
  \pgfretval\endgroup}
\makeatother
\def\Window#1{\addplot[draw=none,fill=none,forget plot] fill between[of=A and B,soft clip={#1}];}
\begin{document}
\immediate\openout\tracefile=oracle.trace
\begin{tikzpicture}
\begin{axis}[scale only axis,width=8cm,height=3cm,at={(7cm,5cm)},anchor=center,
  xmin=2,xmax=6,ymin=3,ymax=9,xtick=\empty,ytick=\empty,enlargelimits=false,clip=false]
\addplot[mark=none,name path=A] coordinates {(2,3)(6,9)};
\addplot[mark=none,name path=B] coordinates {(2,3)(6,3)};
${windows}
\end{axis}
\end{tikzpicture}
\immediate\closeout\tracefile
\end{document}`;
    writeFileSync(join(dir, "oracle.tex"), tex);
    execFileSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "oracle.tex"],
      { cwd: dir, timeout: 30000 });
    const rows = readFileSync(join(dir, "oracle.trace"), "utf8").trim().split(/\r?\n/).map(row => row.split(" "));
    assert.equal(rows.length, 5 * ids.length);
    const point = row => row.slice(1).map(x => Number(x) / 65536);
    const sw = point(rows[0]);
    ids.forEach((id, i) => {
      const ring = rows.slice(i * 5, i * 5 + 5);
      assert.deepEqual(ring.map(row => row[0]), ["M", "L", "L", "L", "Z"]);
      if (id === "frame") return;
      const got = localCorners([...point(ring[0]), ...point(ring[2])], sw);
      localCorners(modern[id], linearFrame).forEach((n, j) => nearPt(got[j], n, .001, id + " vertex " + j));
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
