import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { normalizeColor } from "../src/engine/options.js";
import { tikzToSvg } from "../src/index.js";
import { parsePgfplotsFillBetween, splitXMonotoneFillBetweenPaths } from "../src/pgfplots/fillBetween.js";
import { collectPgfplotsLibraries } from "../src/pgfplots/index.js";

const LATEX_EXAMPLE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);

function renderLatexExample(name) {
  return tikzToSvg(readFileSync(new URL(name, LATEX_EXAMPLE_ROOT), "utf8"), { mathRenderer: "svg-text" });
}

function fillBetweenAreas(result) {
  return result.ir.items.filter((item) => (
    item.type === "path" &&
    item.style?.fill &&
    item.style.fill !== "none" &&
    item.style.stroke === "none"
  ));
}

const band = String.raw`
\usepackage{pgfplots}
\usepgfplotslibrary{fillbetween}
\begin{tikzpicture}
  \begin{axis}[hide axis,xmin=0,xmax=4,ymin=0,ymax=2,enlargelimits=false,
               width=4cm,height=2cm,scale only axis]
    \addplot[draw=none,name path=upper limit] coordinates {(0,1.5) (4,1.5)};
    \addplot[draw=none,name path=lower limit] coordinates {(4,.5) (0,.5)};
    \addplot[fill=red] fill between[of=upper limit and lower limit];
  \end{axis}
\end{tikzpicture}`;

test("oppositely traced named boundaries make a solid band, not a bow tie", () => {
  const result = tikzToSvg(band);
  assert.deepEqual(result.diagnostics, []);
  const [area] = fillBetweenAreas(result);
  assert.deepEqual(area?.commands.filter(p => p.type !== "closePath").map(p => [p.x, p.y]),
    [[0, 1.5], [4, 1.5], [4, .5], [0, .5]]);
});

test("the axis viewport clips the fill's paint without moving its boundary", () => {
  const input = band.replace("(0,1.5) (4,1.5)", "(-1,1.5) (5,1.5)");
  const area = fillBetweenAreas(tikzToSvg(input))[0];
  assert.deepEqual(area?.clipRect, {minX: 0, minY: 0, maxX: 4, maxY: 2});
  const unclipped = fillBetweenAreas(tikzToSvg(input.replace("hide axis", "hide axis,clip=false")))[0];
  assert.ok(!unclipped?.clipRect);
  assert.ok(unclipped?.commands.some(p => p.x === -1));
});

test("fill-between options use the addplot option reader and allow spaces in path names", () => {
  const [fill] = parsePgfplotsFillBetween(String.raw`
    \addplot[name path=upper limit] coordinates {(0,1) (4,1)};
    \addplot+[fill=red] fill between[of={upper limit and lower limit},
      every segment/.style={postaction={draw={[blue]}}},reverse=false];`);
  assert.equal(fill?.first, "upper limit");
  assert.equal(fill.second, "lower limit");
  assert.equal(fill.options.reverse, "false");
  assert.equal(fill.plotOptions.fill, "red");
  const [bracket] = parsePgfplotsFillBetween(
    String.raw`\addplot fill between[of=A and B,every segment/.style={name={a]b}},/pgf/fill between/reverse];`
  );
  assert.equal(bracket.options["every segment/.style"], "name={a]b}");
  assert.equal(bracket.options.reverse, true);
});

const qualifiedClipBand = band.replace("of=upper limit and lower limit", `/tikz/fill between/of=upper limit and lower limit,
    soft clip first={domain=0:1},soft clip={domain=1:3},/tikz/fill between/soft clip first={domain=2:4}`);
const clipOrderCases = [
  [qualifiedClipBand, [1, 3]],
  [qualifiedClipBand.replace("soft clip={domain=1:3}", "soft clip={domain=3:1}"), [3, 1]],
  [qualifiedClipBand.replace("domain=2:4}", "domain=2:4},reverse=true"), [3, 1]]
];

test("qualified and unqualified soft clips apply where each was written", () => {
  // The descending lower input sets auto-reverse to false BEFORE clipping.
  // PGF emits its two line hits in box-edge order, not original line direction.
  for (const [source, [a, b]] of clipOrderCases) {
    const result = tikzToSvg(source);
    assert.deepEqual(result.diagnostics, []);
    const areas = fillBetweenAreas(result);
    assert.equal(areas.length, 1);
    assert.deepEqual(areas[0].commands, [
      { type: "moveTo", x: 2, y: 1.5 }, { type: "lineTo", x: 4, y: 1.5 },
      { type: "lineTo", x: a, y: .5 }, { type: "lineTo", x: b, y: .5 }, { type: "closePath" }
    ]);
  }
});

test("local pdflatex paints the qualified clips and both reversal controls in the recorded order", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "fillbetween-clip-order-"));
  try {
    for (const [source, lower] of clipOrderCases) {
      const wrapped = "\\documentclass[border=0pt]{standalone}\n\\pdfcompresslevel=0\n" +
        source.replace("\\begin{tikzpicture}", "\\begin{document}\n\\begin{tikzpicture}") + "\n\\end{document}";
      writeFileSync(join(dir, "probe.tex"), wrapped);
      execFileSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "probe.tex"],
        { cwd: dir, timeout: 30000 });
      // This fixture has a single red fill. Inspect its actual PDF painting
      // operators in bp, independently of the JS renderer and PGF trace hooks.
      const lines = readFileSync(join(dir, "probe.pdf"), "latin1").split(/\r?\n/).map(line => line.trim());
      const red = lines.indexOf("1 0 0 rg");
      assert.ok(red >= 0);
      assert.equal(lines.lastIndexOf("1 0 0 rg"), red);
      const ops = lines.slice(red + 1, red + 7).map(line => line.split(/\s+/));
      assert.deepEqual(ops.map(op => op.at(-1)), ["m", "l", "l", "l", "h", "f"]);
      const nativeX = { 1: 28.34389, 3: 85.03682 };
      assert.deepEqual(ops.slice(0, 4).map(([x, y]) => [Number(x), Number(y)]),
        [[56.69121, 42.5184], [113.38414, 42.5184], ...lower.map(x => [nativeX[x], 14.17279])]);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("split does not repaint the unsplit band when PGF omits every thin piece", () => {
  const source = band.replace("(0,1.5) (4,1.5)", "(0,1) (4,1.02)")
    .replace("(4,.5) (0,.5)", "(4,1) (0,1.02)")
    .replace("of=upper limit and lower limit", "of=upper limit and lower limit,split");
  assert.equal(fillBetweenAreas(tikzToSvg(source)).length, 0);
  const keep = source.replace(",split]", ",split,/pgf/fill between/omit empty segments=false]");
  assert.equal(fillBetweenAreas(tikzToSvg(keep)).length, 2);
});

const crossingPlots = String.raw`
\usepackage{pgfplots}
\usepgfplotslibrary{fillbetween}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=1,ymin=-1.2,ymax=1.2,axis lines=none]
    \addplot[name path=A,domain=0:1,samples=65] {sin(360*x)};
    \addplot[name path=B,domain=0:1,samples=65] {cos(360*x)};
    % FILL_BETWEEN
  \end{axis}
\end{tikzpicture}`;

test("splits fill-between regions at every function-plot intersection", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[orange] fill between[
      of=A and B,
      split,
      every odd segment/.style={yellow}
    ];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(areas.length, 3);
  assert.deepEqual(
    areas.map((area) => area.style.fill),
    [normalizeColor("orange"), normalizeColor("yellow"), normalizeColor("orange")]
  );
  assert.ok(areas.every((area) => area.commands.at(-1)?.type === "closePath"));
});

test("applies native fill-between segment style precedence", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[fill=gray] fill between[
      of=A and B,
      split=true,
      every segment/.style={fill=blue},
      every segment no 1/.style={fill=orange},
      every odd segment/.style={fill=green},
      every even segment/.style={fill=red},
      every last segment/.style={fill=purple}
    ];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    areas.map((area) => area.style.fill),
    [normalizeColor("red"), normalizeColor("green"), normalizeColor("purple")]
  );
});

test("uses a bare fill-between plot color as the fill color", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[orange] fill between[of=A and B];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(areas.length, 1);
  assert.equal(areas[0].style.fill, normalizeColor("orange"));
});

test("normalizes reversed function traversal before splitting intersections", () => {
  const regions = splitXMonotoneFillBetweenPaths(
    [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 0 }],
    [{ x: 2, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
  );

  assert.equal(regions.length, 3);
  assert.ok(Math.abs(regions[0].first.at(-1).x - 1 / 3) < 1e-9);
  assert.ok(Math.abs(regions[1].first.at(-1).x - 5 / 3) < 1e-9);
  assert.deepEqual(regions[2].second.at(-1), { x: 2, y: 1 });
});

test("applies a soft-clip domain before finding split intersections", () => {
  const source = crossingPlots.replace(
    "% FILL_BETWEEN",
    String.raw`\addplot[fill=blue!30] fill between[
      of=A and B,
      split,
      soft clip={domain=.2:.5},
      every odd segment/.style={fill=red!30}
    ];`
  );
  const result = tikzToSvg(source);
  const areas = fillBetweenAreas(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(areas.length, 1);
  assert.equal(areas[0].style.fill, normalizeColor("blue!30"));
});

test("pgfplots fillbetween closes the softly clipped region before its named curve", () => {
  const result = renderLatexExample("force-distance-diagram.tex");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const fillIndex = paths.findIndex((item) => item.style.fill === "rgb(0 255 0)" && item.commands.some((command) => command.type === "closePath"));
  const curveIndex = paths.findIndex((item) => item.style.stroke === "blue");
  const fill = paths[fillIndex];
  const coordinates = fill?.commands.filter((command) => command.type !== "closePath") || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fillIndex >= 0, "expected a green closed fill-between region");
  assert.ok(curveIndex > fillIndex, "the named blue curve should remain above its area fill");
  assert.equal(fill.style.fillOpacity, 0.3);
  assert.ok(Math.abs(Math.min(...coordinates.map((command) => command.x)) - 2.105) < 0.01);
  assert.ok(Math.abs(Math.max(...coordinates.map((command) => command.x)) - 6.314) < 0.01);
});

test("pgfplots fillbetween supports a constant named function path", () => {
  const result = renderLatexExample("force-distance-diagram-constant.tex");
  const fill = result.ir.items.find(
    (item) => item.type === "path" && item.style.fill === "rgb(0 255 0)" && item.commands.some((command) => command.type === "closePath")
  );
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const bLabel = textNodes.find((item) => item.text === "$b$");
  const cLabel = textNodes.find((item) => item.text === "$c$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fill);
  assert.equal(fill.style.fillOpacity, 0.3);
  assert.ok(bLabel, "expected the positional x tick label at x=3");
  assert.ok(cLabel, "expected the positional y tick label at y=3");
  assert.ok(Math.abs(bLabel.x - 6.013) < 0.01);
});

test("pgfplots fillbetween reports its reviewed partial support boundary", () => {
  const [library] = collectPgfplotsLibraries(String.raw`\usepgfplotslibrary{fillbetween}`);

  assert.equal(library.implementationStatus, "partial");
  for (const file of ["fillBetween", "fillBetweenBoundaries", "fillBetweenAssembly", "fillBetweenSoftClip", "fillBetweenSplit"]) {
    assert.ok(library.implementedBy.split("; ").includes(`src/pgfplots/${file}.js`));
  }
  assert.match(library.localSourceReviewed, /tikzlibrarypgfplots\.fillbetween\.code\.tex$/);
  assert.match(library.notes, /soft clip=\{domain=a:b\}/);
});
