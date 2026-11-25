import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const raw = String.raw;
const box = raw`\fill[red] (-9pt,3pt) rectangle (21pt,17pt);`;
const ellipse = raw`\draw[red,line width=8pt] (20pt,30pt) ellipse [x radius=10pt,y radius=5pt];`;
const multiLine = raw`\draw[red] (0pt,0pt) -- (2pt,1pt);`;
const picture = (options, body) => raw`\begin{tikzpicture}[${options}]
  ${body}
\end{tikzpicture}`;

const pictures = {
  baseline: picture("framed,gridded,show background top,thick,red", raw`\draw[blue] (0,0) -- (2,1);`),
  default: picture("show background rectangle", box),
  transformed: picture("scale=2,rotate=90,red,line width=6pt,framed",
    raw`\draw (2pt,4pt) -- (5pt,12pt);`),
  polyline: picture("tight background,framed",
    raw`\draw[red,line width=8pt] (9pt,4pt) -- (10pt,30pt) -- (11pt,4pt);`),
  ellipse: picture("tight background,framed", ellipse),
  rotatedEllipse: picture("rotate=30,tight background,framed", ellipse),
  sides: picture(`loose background,inner frame xsep=3pt,outer frame sep=4pt,outer frame xsep=7pt,
    background bottom/.style={draw=blue,line width=9pt},
    show background bottom,show background right,framed,show background top,
    show background left,show background bottom`, box),
  repeatedOptions: picture(`inner frame xsep=11pt,inner frame sep=2pt,inner frame xsep=5pt,
    outer frame ysep=12pt,outer frame sep=1pt,outer frame ysep=4pt,
    pair/.style={show background right,show background top},
    pair,show background left,pair`, box),
  falseArguments: picture("framed=false,show background left=false,show background left=false", box),
  grid: picture("gridded,show background rectangle,show background grid,framed", box),
  gridBasis: picture(`x=12pt,y=7pt,rotate=90,scale=2,tight background,
    help lines/.style={color=blue,line width=.9pt},
    background grid/.append style={step=1},gridded`, raw`\fill[red] (-1,-1) rectangle (2,2);`),
  styled: picture(`background rectangle/.style={fill=blue!25,draw=blue,line width=2.5pt},
    background grid/.append style={step=8pt,line width=1.3pt},
    framed,gridded`, box),
  fillOnly: picture("background rectangle/.style={fill=blue},framed", box),
  everyPath: picture(`scale=2,every path/.style={line width=1.7pt},
    every on background layer/.style={draw=blue,line width=13pt},framed`, box),
  interleaved: picture(raw`scale=2,line width=6pt,red,tight background,
    execute at end picture={\draw (5pt,1pt) -- (9pt,1pt);},
    show background left,execute at end picture={\draw (20pt,2pt) -- (25pt,2pt);},
    framed,execute at end picture={\draw (30pt,3pt) -- (32pt,3pt);}`,
    raw`\draw (0pt,0pt) -- (2pt,0pt);`),
  boxFirst: picture("inner frame sep=3pt,framed", raw`
    \useasboundingbox (-4pt,-2pt) rectangle (8pt,10pt);
    \draw[red,line width=8pt] (-20pt,-30pt) -- (20pt,30pt);`),
  boxLater: picture("tight background,framed", raw`
    \draw[red,line width=4pt] (-12pt,-5pt) -- (-6pt,2pt);
    \useasboundingbox (-4pt,-2pt) rectangle (8pt,10pt);
    \fill[red] (40pt,35pt) rectangle (60pt,45pt);`),
  boxInScope: picture("tight background,framed", raw`
    \begin{scope}
      \useasboundingbox (-4pt,-2pt) rectangle (8pt,10pt);
      \draw[red,line width=8pt] (-20pt,-30pt) -- (20pt,30pt);
    \end{scope}
    \draw[red,line width=4pt] (10pt,12pt) -- (12pt,14pt);`),
  earlierBackground: picture("tight background,show background left,framed", raw`
    \draw[red] (0pt,0pt) -- (10pt,6pt);
    \begin{scope}[on background layer]
      \fill[blue] (-6pt,4pt) rectangle (8pt,12pt);
    \end{scope}`),
  firstPicture: picture("loose background,background rectangle/.style={draw=blue},framed", multiLine),
  plainPicture: picture("", multiLine),
  lastPicture: picture("tight background,inner frame ysep=2pt,show background right", multiLine)
};
const adjacent = ["firstPicture", "plainPicture", "lastPicture"];

// Reference: pdfTeX 1.40.28 (TeX Live 2025), PGF 3.1.11a. Normal runs need neither.
// To remeasure these exact same pictures:
// TIKZKIT_TEST_PDFLATEX=1 node --test test/backgrounds-native.test.js
// node test/backgrounds-native.test.js --record-native   (requires pdflatex + PyMuPDF)
const fixture = name => new URL(`./fixtures/native-backgrounds-tests/${name}`, import.meta.url);
const record = process.argv.includes("--record-native");
const live = record || process.env.TIKZKIT_TEST_PDFLATEX === "1";
const oracle = JSON.parse(live
  ? execFileSync("python3", [fileURLToPath(fixture("measure.py"))], {
    input: JSON.stringify({ pictures, adjacent }), encoding: "utf8", timeout: 45000
  })
  : readFileSync(fixture("texlive-2025.json"), "utf8"));
if (record) {
  const rows = Object.entries(oracle).map(([id, data]) => `  "${id}": ${JSON.stringify(data)}`);
  writeFileSync(fixture("texlive-2025.json"), "{\n" + rows.join(",\n") + "\n}\n");
  process.exit(0);
}
const { tikzToSvg } = await import("../src/index.js");

const ptPerCm = 72.27 / 2.54;
const unit = 100;
const ptTolerance = .012; // well below a thin pen; allows TeX fixed-point transform/length rounding
const samePoint = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < ptTolerance;
const red = "#ff0000";

function cssColor(value) {
  if (value === "none" || value == null) return null;
  const named = { black: "#000000", gray: "#808080", red, blue: "#0000ff", white: "#ffffff" };
  if (named[value]) return named[value];
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(value)) return "#" + [...value.slice(1)].map(c => c + c).join("").toLowerCase();
  const rgb = value.match(/^rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)$/);
  assert.ok(rgb, `unrecognized paint color: ${value}`);
  return "#" + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, "0")).join("");
}

// Compare visible contours, not item subtypes, rectangle winding/start vertex, or
// the number of IR items used for an opaque grid. A move by itself paints nothing.
function contours(tokens) {
  const parts = [];
  let points = [], rect;
  function finish(closed = false) {
    if (points.length > 1) {
      if (samePoint(points[0], points.at(-1))) {
        points.pop();
        closed = true;
      }
      parts.push({ points, closed });
    }
    points = [];
  }
  for (const [op, x, y] of tokens) {
    if (op === "M") { finish(); points = [[x, y]]; }
    else if (op === "L") points.push([x, y]);
    else if (op === "Z") finish(true);
    else if (op === "R") { finish(); rect = [x, y]; }
    else if (op === "S") {
      const [a, b] = rect;
      points = [[a, b], [a + x, b], [a + x, b + y], [a, b + y]];
      finish(true);
    } else assert.fail(`unexpected frame softpath operation ${op}`);
  }
  finish();
  return parts;
}

function sameContour(a, b) {
  if (a.closed !== b.closed || a.points.length !== b.points.length) return false;
  const n = b.points.length;
  for (const ordered of [b.points, [...b.points].reverse()]) {
    for (let start = 0; start < (a.closed ? n : 1); start++) {
      if (a.points.every((p, i) => samePoint(p, ordered[(i + start) % n]))) return true;
    }
  }
  return false;
}

function drawing(source) {
  const { ir, diagnostics } = tikzToSvg(raw`\usetikzlibrary{backgrounds}` + "\n" + source, { unit });
  assert.deepEqual(diagnostics, []);
  return ir.items.filter(item => item.type === "path" &&
    (cssColor(item.style.stroke) !== null || cssColor(item.style.fill) !== null));
}

function publicPaint(items, foreground, dx, dy) {
  return items.flatMap(({ commands, style }) => {
    const stroke = cssColor(style.stroke), fill = cssColor(style.fill);
    const penPt = style.lineWidth * ptPerCm / unit;
    // The fixtures use distinguishable foreground ink; no renderer layer flag needed.
    if (foreground.has(stroke) || foreground.has(fill)) {
      let boundsPt;
      if (commands?.length && commands.every(c => ["moveTo", "lineTo", "closePath"].includes(c.type))) {
        const pts = commands.filter(c => c.type !== "closePath");
        const xs = pts.map(p => (p.x - dx) * ptPerCm), ys = pts.map(p => (p.y - dy) * ptPerCm);
        boundsPt = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      }
      return [{ layer: "main", stroke, fill, penPt, boundsPt }];
    }
    const tokens = commands.map(({ type, x, y }) => {
      if (type === "closePath") return ["Z"];
      assert.ok(type === "moveTo" || type === "lineTo", `unexpected painted frame operation ${type}`);
      return [type === "moveTo" ? "M" : "L", (x - dx) * ptPerCm, (y - dy) * ptPerCm];
    });
    return contours(tokens).map(part => ({ layer: "background", stroke, fill, penPt, part }));
  });
}

function assertPaint(id, items, ordered = false, dx = 0, dy = 0) {
  const { bodyPt, paint } = oracle[id];
  assert.equal(bodyPt.length, 4);
  const foreground = new Set(paint.filter(p => p.layer === "main").flatMap(p => [p.fill, p.stroke]).filter(Boolean));
  let actual = publicPaint(items, foreground, dx, dy);
  // For geometry-focused cases diagnose the frame before checking the foreground.
  const byLayer = list => [...list.filter(p => p.layer === "background"), ...list.filter(p => p.layer === "main")];
  if (!ordered) actual = byLayer(actual);
  let cursor = 0;
  for (const native of ordered ? paint : byLayer(paint)) {
    const parts = native.pathPt ? contours(native.pathPt) : [null];
    const batch = actual.slice(cursor, cursor + parts.length);
    const label = `${id} paint ${cursor} (native ${native.layer}, PGF content box ${bodyPt.join(", ")} pt)`;
    assert.equal(batch.length, parts.length, `${label}: missing painted contour(s)`);
    for (const ink of batch) {
      assert.deepEqual([ink.layer, ink.stroke, ink.fill], [native.layer, native.stroke, native.fill], label);
      if (native.stroke) assert.ok(Math.abs(ink.penPt - native.penPt) < .002,
        `${label}: pen ${ink.penPt} pt, native ${native.penPt} pt`);
      if (ink.layer === "main") {
        if (ink.boundsPt) assert.ok(ink.boundsPt.every((p, i) => Math.abs(p - native.boundsPt[i]) < ptTolerance),
          `${label}: foreground bounds ${ink.boundsPt}, native ${native.boundsPt} (pt)`);
        continue;
      }
      const index = parts.findIndex(part => sameContour(ink.part, part));
      assert.notEqual(index, -1,
        `${label}: got ${JSON.stringify(ink.part)}, native ${JSON.stringify(parts)} (pt)`);
      parts.splice(index, 1);
    }
    cursor += batch.length;
  }
  assert.equal(actual.length, cursor, `${id}: extra painted contours`);
}

const cases = [
  ["baseline", "frame, grid and top paint behind the thick foreground at the measured coordinates", true],
  ["default", "default rectangle uses PGF's content bounds and the native ex separation"],
  ["transformed", "end frame resets the picture transform and the red 6pt pen"],
  ["polyline", "tight frame uses the stroked polyline register bounds, not a rendered miter tip"],
  ["ellipse", "tight frame includes half the ellipse pen on both axes"],
  ["rotatedEllipse", "tilted ellipse uses PGF's recorded curve bounds before framing"],
  ["sides", "all four asymmetric sides share one box, including repeated hooks", true],
  ["repeatedOptions", "ordered style expansion preserves repeated hooks and separation assignments", true],
  ["falseArguments", "show styles ignore a false argument and still register each occurrence", true],
  ["grid", "native help lines and both grid/rectangle aliases paint in registration order", true],
  ["gridBasis", "end grid retains the coordinate basis for a unitless step and respects a redefined help lines", true],
  ["styled", "a styled rectangle and grid paint their measured fill, stroke, width and lattice", true],
  ["fillOnly", "replacing background rectangle with a fill-only style removes its stroke"],
  ["everyPath", "every path can set the frame pen; every on background layer does not style end hooks"],
  ["interleaved", "callbacks around the first frame see native pen/transform changes and the saved box", true],
  ["boxFirst", "an initial useasboundingbox excludes later oversized ink"],
  ["boxLater", "useasboundingbox preserves previous ink, adds its path, then freezes"],
  ["boxInScope", "leaving a useasboundingbox scope resumes picture-size tracking"],
  ["earlierBackground", "end hooks follow earlier background-layer paint and precede foreground", true]
];
for (const [id, title, ordered] of cases) test(title, () => {
  assertPaint(id, drawing(pictures[id]), ordered);
});

test("adjacent pictures keep their own frame geometry, styles, ordering and unframed middle", () => {
  const items = drawing(adjacent.map(id => pictures[id]).join("\n"));
  const ids = [...adjacent].sort((a, b) => oracle[a].firstOnPage - oracle[b].firstOnPage);
  let start = 0;
  for (const id of ids) {
    const end = items.findIndex((item, i) => i >= start && cssColor(item.style.stroke) === red);
    assert.notEqual(end, -1, `missing ${id} foreground`);
    // Each real foreground starts at (0,0); subtract only the presentation translation.
    const { x, y } = items[end].commands[0];
    assertPaint(id, items.slice(start, end + 1), true, x, y);
    start = end + 1;
  }
  assert.equal(start, items.length, "paint leaked past the last picture");
});
