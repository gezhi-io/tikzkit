import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const coords = Array.from({ length: 10 }, (_, i) => '(' + (i + 1) + ',' + (i % 2) + ')').join('');
const cases = [
  ["all", "", [1,2,3,4,5,6,7,8,9,10]],
  ["repeat", "mark repeat=3", [1,4,7,10]],
  ["late-phase", "mark repeat=3,mark phase=6", [6,9]],
  ["too-late", "mark phase=11", []],
  ["early-phase", "mark repeat=3,mark phase=0", [1,4,7,10]],
  ["zero-repeat", "mark repeat=0,mark phase=3", [3,4,5,6,7,8,9,10]],
  ["list", "mark indices={1,4,...,10,2,8,2}", [1,2,4,7,8,10]],
  ["count-offset", "mark repeat=4,mark phase=2,mark indices={1,3,6,8}", [1,4,6]],
  ["descending", "mark indices={9,7,...,1}", [1,3,5,7,9]],
  ["grouped", "mark indices={{1},{3},5}", [1,3,5]],
  ["successive-ranges", "mark indices={1,...,3,5,...,7}", [1,2,3,5]],
  ["fractional-dots", "mark indices={0,0.1,...,2}", []],
  ["token-list", "mark indices={01,2.0,+3,4}", [4]],
  ["empty-list", "mark repeat=4,mark indices={}", [1,5,9]],
  ["mark-options", "mark repeat=5,mark options={mark repeat=3,mark phase=2}", [2,5,8]],
  ["qualified", "/tikz/mark indices={2,7}", [2,7]],
];

function items(body, options = "") {
  const result = tikzToSvg('\\begin{tikzpicture}[' + options + ']' + body + '\\end{tikzpicture}');
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
}

function centers(shapes) {
  // The first stroke of a "+" is horizontal and centered on the observation.
  return shapes.filter(s => s.shape === "plot-mark").map(({ commands: [a, b] }) => (a.x + b.x) / 2);
}

for (const [id, keys, expected] of cases) {
  test("TikZ marker stream: " + id, () => {
    const stream = items('\\draw plot[mark=+,smooth,' + keys + '] coordinates {' + coords + '};');
    assert.deepEqual(centers(stream), expected);
    const [line] = stream.filter(s => s.type === "path" && !s.mark);
    assert.equal(line.commands.filter(c => c.type === "curveTo").length, 9);
  });
}

test("selection restarts for each plot and every mark is executed inside the plot group", () => {
  const segment = ' coordinates {(1,1)(2,0)(3,0)(4,1)(5,0)}';
  const stream = items('\\draw plot' + segment + ' plot[mark options={mark repeat=4,mark phase=3}]' + segment + ' plot' + segment + ';',
    'every plot/.style={mark=+},every mark/.style={mark repeat=2}');
  assert.deepEqual(centers(stream), [1,3,5,3,1,3,5]);
});

test("a mark-index list macro is one PGF key value, also inside a named style", () => {
  const preamble = '\\def\\series{1,3,...,7}\\def\\period{3}' +
    '\\tikzset{selected/.style={mark indices=\\series,mark repeat=\\period}}';
  for (const keys of ["selected", "mark indices=\\series,mark repeat=\\period"]) {
    const result = tikzToSvg(preamble + '\\begin{tikzpicture}\\draw plot[mark=+,' + keys +
      '] coordinates {' + coords + '};\\end{tikzpicture}');
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(centers(result.ir.items), [1,3,5]);
  }
});

test("sampled marks paint after the whole path, including on a path with no stroke", () => {
  const coords = 'plot[mark=+,mark indices={2,4},domain=0:4,samples=5] (\\x,\\x)';
  for (const command of ["draw", "path"]) {
    const stream = items('\\' + command + ' ' + coords + ' -- (6,0);');
    assert.deepEqual(centers(stream), [1,3]);
    const painted = stream.filter(s => s.type === "path");
    assert.deepEqual(painted.map(s => s.mark || "line"), command === "draw" ? ["line","+","+"] : ["+","+"]);
  }
});

test("plot-local mark assignments and the no marks aliases obey source order", () => {
  const plot = keys => items('\\draw plot[' + keys + '] coordinates {(1,0)(2,0)};');
  for (const keys of ["mark=+,no marks", "mark=+,no markers", "mark=+,mark={}", "mark=+,mark=none"]) {
    assert.deepEqual(centers(plot(keys)), [], keys);
  }
  for (const keys of ["mark=o,no marks,mark=+", "no markers,/tikz/mark=+"]) {
    assert.deepEqual(centers(plot(keys)), [1,2], keys);
  }
});

test("an unpainted curve still sizes the picture if no observations receive a mark", () => {
  const stream = items("\\path plot[mark=+,mark phase=20] coordinates {(1,0)(2,1)(3,0)};");
  assert.deepEqual(centers(stream), []);
  assert.deepEqual(stream.filter(s => s.type === "bbox").flatMap(s => s.commands.map(c => [c.x, c.y])),
    [[1,0], [2,1], [3,0]]);
});

test("a selected quick mark bounds the page by its shape, not by the suppressed stream or its pen", () => {
  for (const [mark, paint, size] of [["*", "", 4], ["probe", "qstroke", 4], ["probe", "{stroke}", 6]]) {
    const declare = paint ? '\\pgfdeclareplotmark{probe}{\\pgfpathcircle{\\pgfpointorigin}{2pt}\\pgfusepath' + paint + '}' : "";
    const source = declare + '\\begin{tikzpicture}\\path[red,line width=2pt] plot[only marks,mark=' + mark +
      ',mark indices={2}] coordinates {(1,0)(2,0)(3,0)};\\end{tikzpicture}';
    const result = tikzToSvg(source, { margin: 0 });
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.ir.items.find(s => s.mark)?.style.stroke, "red");
    const width = Number(result.svg.match(/\bwidth="([\d.]+)pt"/)[1]) * 72.27 / 72;
    assert.ok(Math.abs(width - size) < .001, mark + ": expected " + size + " TeX pt, got " + width);
  }
});

test("native PGF records identical marker ordinals in scaled points", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "tikz-marker-ordinals-"));
  try {
    const plots = cases.map(([id, keys]) => '\\def\\caseid{' + id + '}\\tikz[x=1pt]\\draw plot[mark=probe,' +
      keys + '] coordinates {' + coords + '};').join('\n');
    const tex = '\\documentclass{article}\\usepackage{tikz}\\begin{document}' +
      '\\newwrite\\trace\\immediate\\openout\\trace=positions.txt ' +
      '\\pgfdeclareplotmark{probe}{\\pgfgettransformentries{\\aa}{\\bb}{\\cc}{\\dd}{\\xx}{\\yy}' +
      '\\immediate\\write\\trace{\\caseid:\\number\\dimexpr\\xx\\relax}}' + plots + '\\end{document}';
    execFileSync("pdflatex", ["-no-shell-escape", "-halt-on-error", "-interaction=batchmode", "-jobname=probe", tex], { cwd: dir, timeout: 30000 });
    const lines = readFileSync(join(dir, "positions.txt"), "utf8").trim().split(/\r?\n/);
    assert.deepEqual(lines, cases.flatMap(([id,, expected]) => expected.map(i => id + ':' + i * 65536)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
