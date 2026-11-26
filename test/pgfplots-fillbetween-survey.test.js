import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseOptions } from "../src/engine/options.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { parseAddplots } from "../src/pgfplots/addplotParser.js";
import { createAxisModel } from "../src/pgfplots/axis.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { fillBetweenSurveyForGeometry, numericFillBetweenClipBox } from "../src/pgfplots/fillBetweenSurvey.js";
import { preparePgfplotsStackedPlots } from "../src/pgfplots/stackedPlots.js";

const cases = [
  { id: "trunc", limits: [0,5,-5,-2], data: [[1,-10],[2,-1],[4,-3]], key: "domain=2:3", edges: [2,-10.9,3,-.1] },
  { id: "negative", limits: [-20,-10,-8,-2], data: [[-15,-7],[-11,-3]], key: "domain y=-3:-7", edges: [-21,-3,-9,-7] },
  { id: "reverse", limits: [0,4,0,4], axis: "x dir=reverse,y dir=reverse", data: [[-2,2],[6,3]],
    key: "y domain y=3:1", edges: [-2.8,3,6.8,1] },
  { id: "descending-x", limits: [0,4,0,4], data: [[1,1],[3,3]], key: "domain=3:1", edges: [3,-.4,1,4.4] },
  { id: "reverse-both", limits: [0,4,0,4], axis: "x dir=reverse,y dir=reverse", data: [[1,1],[3,3]],
    key: "domain=1:3", edges: [1,-.4,3,4.4] },
  { id: "cancel-x", limits: [0,4,0,4], axis: "x dir=reverse", data: [[1,1],[3,3]],
    key: "domain=3:1", edges: [3,-.4,1,4.4] },
  { id: "log-y", limits: [-10,10,10,20], axis: "ymode=log", data: [[-100,1],[0,12],[100,1000]],
    key: "domain y=12:16", edges: [-12,12,12,16] },
  { id: "log-x", limits: [10,20,-5,5], axis: "xmode=log", data: [[1,-100],[12,0],[1000,100]],
    key: "domain y=2:3", edges: [Math.log(10)-.1*Math.log(2),2,Math.log(20)+.1*Math.log(2),3] },
  { id: "log-zero", limits: [0,4,1,4], axis: "ymode=log,log basis y=2", data: [[1,1],[2,4]],
    key: "domain=2:3", edges: [2,2,3,2.2] },
  { id: "stack-zero", limits: [0,4,0,4], axis: "stack plots=y,stacked ignores zero=true",
    data: [[-10,0],[1,2],[3,3],[10,0]], key: "domain y=1:3", edges: [-12,1,12,3] }
];

function makeModel(c, plots, renderOptions = {}) {
  const [xMin,xMax,yMin,yMax] = c.limits;
  const ranges = { xMin,xMax,yMin,yMax };
  const axisOptions = parseOptions(`width=4cm,height=4cm,scale only axis,enlargelimits=false,xmin=${xMin},xmax=${xMax},ymin=${yMin},ymax=${yMax},${c.axis || ""}`);
  const input = plots ?? [{ type: "coordinates", options: {}, points: c.data.map(([x,y]) => ({ x,y })) }];
  const { addplots } = preparePgfplotsStackedPlots(axisOptions, input);
  return createAxisModel({ axisOptions, ranges, geometry: createAxisGeometry(axisOptions, ranges), renderOptions, addplots });
}

function checkCorners(got, first, second, tol = 1e-10) {
  assert.ok(got);
  for (const [dim, flag, min, max] of [["x","flipX","minX","maxX"], ["y","flipY","minY","maxY"]]) {
    if (first[dim] > second[dim]) assert.equal(got[flag], true, flag);
    else assert.equal(Object.hasOwn(got, flag), false, `${flag} must be absent`);
    const from = got[flag] ? got[max] : got[min], to = got[flag] ? got[min] : got[max];
    assert.ok(Math.abs(from - first[dim]) < tol, `first ${dim}: ${from} versus ${first[dim]}`);
    assert.ok(Math.abs(to - second[dim]) < tol, `second ${dim}: ${to} versus ${second[dim]}`);
  }
}

for (const c of cases) test(`numeric soft-clip rectangle: ${c.id}`, () => {
  const model = makeModel(c), [x,y,u,v] = c.edges;
  checkCorners(numericFillBetweenClipBox(c.key, model.ranges, model.geometry, model.options),
    model.geometry.mapPoint({x,y}), model.geometry.mapPoint({x:u,y:v}));
});

test("survey includes unnamed plots, interval terminals and error tips, not viewport or canvas bars", () => {
  const plots = parseAddplots(String.raw`\addplot[/tikz/ybar interval,bar width=8cm] coordinates {(1,3)(2,4)(3,18)};
    \addplot[forget plot,error bars/.cd,y dir=both,y fixed=2] coordinates {(-5,-4)(7,2)(10,nan)};
    \path[name path=overlay] (-100,-200) -- (200,300);`);
  const model = makeModel(cases[0], plots);
  assert.deepEqual(model.fillBetweenSurvey(), { xMin:-5,xMax:7,yMin:-6,yMax:18 });
  assert.equal(fillBetweenSurveyForGeometry(model.geometry), model.fillBetweenSurvey());
});

test("lazy survey and paint consume one stream even for unnamed sampled plots", () => {
  const [plot] = parseAddplots(String.raw`\addplot[samples at={-1,1,2}] {x*x};`);
  let reads = 0;
  Object.defineProperty(plot, "expression", { get() { reads++; return "x*x"; } });
  const options = {}, model = makeModel(cases[0], [plot], options);
  const before = reads;
  assert.deepEqual(model.fillBetweenSurvey(), { xMin:-1,xMax:2,yMin:1,yMax:4 });
  renderAddplot(plot, model.options, model.ranges, model.geometry, options);
  renderAddplot(plot, model.options, model.ranges, model.geometry);
  assert.equal(model.fillBetweenSurvey(), fillBetweenSurveyForGeometry(model.geometry));
  assert.equal(reads, before + 1);
});

test("only a surveyed observation beyond the frame can bring an outlying overlay into the finite domain box", () => {
  for (const ymax of [4, 6]) {
    const { ir, diagnostics } = tikzToSvg(String.raw`\pgfplotsset{compat=1.18}\usepgfplotslibrary{fillbetween}
      \begin{tikzpicture}\begin{axis}[hide axis,scale only axis,width=4cm,height=4cm,enlargelimits=false,xmin=0,xmax=4,ymin=0,ymax=4]
        \path[name path=A] (axis cs:0,6) -- (axis cs:4,6);
        \path[name path=B] (axis cs:0,1) -- (axis cs:4,1);
        \addplot[draw=none,mark=none] coordinates {(0,0) (4,${ymax})};
        \addplot[fill=red] fill between[of=A and B,soft clip={domain=1:3}];
      \end{axis}\end{tikzpicture}`);
    assert.deepEqual(diagnostics, []);
    const fill = ir.items.filter(item => item.style?.fill === "red");
    assert.equal(fill.length, ymax === 6 ? 1 : 0);
    if (fill.length) assert.deepEqual(fill[0].clipRect, { minX: 0, minY: 0, maxX: 4, maxY: 4 });
  }
});

test("equal orthogonal limits expand by one; unsupported selectors decline without inventing a box", () => {
  const ranges = { xMin:0,xMax:4,yMin:-2,yMax:-2 }, geometry = { mapPoint: p => p };
  assert.deepEqual(numericFillBetweenClipBox("domain=1:2", ranges, geometry, {}, {}), { minX:1,minY:-3,maxX:2,maxY:-1 });
  assert.deepEqual(numericFillBetweenClipBox("domain=2:2", ranges, geometry, {}, {}), { minX:2,minY:-3,maxX:2,maxY:-1 });
  for (const spec of ["domain=foo:1","domain=nan:1","domain=1:2:3","name path=X"]) {
    assert.equal(numericFillBetweenClipBox(spec, ranges, geometry, {}, {}), null);
  }
});

test("installed PGFPlots assigns the same finite soft-clip canvas rectangles and linear data limits", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const header = String.raw`\documentclass{article}\usepackage{pgfplots}\usepgfplotslibrary{fillbetween}
\pgfplotsset{compat=1.18}\makeatletter
\def\fbpoint#1#2#3{\pgf@process{\pgfplotspointaxisxy{#2}{#3}}\typeout{FBOX|\fbid|#1|\the\pgf@x|\the\pgf@y}}
\def\fbrect(axis cs:#1,#2) rectangle (axis cs:#3,#4)\relax{\fbpoint{a}{#1}{#2}\fbpoint{b}{#3}{#4}}
\def\fbfloat#1#2{\pgfmathfloattosci{#2}\typeout{FBOX|\fbid|#1|\pgfmathresult}}
\def\fbtrace{\begingroup\fbpoint{origin}{\fbleft}{\fbbottom}
  \ifpgfplots@xislinear\fbfloat{xMin}{\pgfplots@data@xmin}\fbfloat{xMax}{\pgfplots@data@xmax}\fi
  \ifpgfplots@yislinear\fbfloat{yMin}{\pgfplots@data@ymin}\fbfloat{yMax}{\pgfplots@data@ymax}\fi
  \pgfkeys{/tikz/soft clip assign/path/.code={\fbrect##1\relax}}\fbassign\endgroup}
\begin{document}`;
  const pictures = cases.map(c => {
    const [xMin,xMax,yMin,yMax] = c.limits;
    return String.raw`\def\fbid{${c.id}}\def\fbleft{${xMin}}\def\fbbottom{${yMin}}
      \def\fbassign{\pgfkeys{/tikz/soft clip assign/${c.key}}}
      \begin{tikzpicture}\begin{axis}[hide axis,scale only axis,enlargelimits=false,width=4cm,height=4cm,
        xmin=${xMin},xmax=${xMax},ymin=${yMin},ymax=${yMax},${c.axis || ""}]
      \path[name path=overlay] (rel axis cs:-3,-3) -- (rel axis cs:5,5);
      \addplot[draw=none,execute at begin plot visualization={\fbtrace}]
        coordinates {${c.data.map(p => "(" + p + ")").join(" ")}};
      \end{axis}\end{tikzpicture}`;
  });
  const cwd = mkdtempSync(join(tmpdir(), "pgfplots-fillbetween-survey-"));
  try {
    writeFileSync(join(cwd,"probe.tex"), header + pictures.join("\n") + "\\end{document}");
    execFileSync("pdflatex", ["-draftmode","-no-shell-escape","-interaction=nonstopmode","-halt-on-error","probe.tex"], { cwd, timeout:30000 });
    const lines = readFileSync(join(cwd,"probe.log"),"utf8").split(/\r?\n/);
    for (const c of cases) {
      const model = makeModel(c), origin = model.geometry.mapPoint({ x:c.limits[0], y:c.limits[2] });
      const records = Object.fromEntries(lines.filter(s => s.startsWith(`FBOX|${c.id}|`)).map(s => {
        const [, ,key,...parts] = s.split("|"); return [key,parts.map(parseFloat)];
      }));
      for (const key of ["xMin","xMax","yMin","yMax"]) {
        if (records[key]) assert.equal(model.fillBetweenSurvey()[key], records[key][0], c.id + " " + key);
      }
      const point = key => ({ x:origin.x+(records[key][0]-records.origin[0])*2.54/72.27,
        y:origin.y+(records[key][1]-records.origin[1])*2.54/72.27 });
      checkCorners(numericFillBetweenClipBox(c.key, model.ranges, model.geometry, model.options), point("a"), point("b"), .003);
    }
  } finally {
    rmSync(cwd, { recursive:true, force:true });
  }
});
