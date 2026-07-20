import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { bchartExtension, BUILTIN_EXTENSIONS } from "../src/extensions/index.js";
import { bchartPackage, texPackageCatalog } from "../src/packages/index.js";

const FIXTURE_URL = new URL("./fixtures/examples/latex-examples/bchart-simple.tex", import.meta.url);

test("publishes bchart through the extension and package APIs", () => {
  assert.equal(bchartExtension.name, "bchart");
  assert.equal(bchartExtension.phase, "preprocess");
  assert.ok(bchartExtension.commands.includes("bcbar"));
  assert.ok(BUILTIN_EXTENSIONS.includes(bchartExtension));
  assert.deepEqual(bchartPackage, texPackageCatalog.bchart);
  assert.equal(bchartPackage.status, "extension");
  assert.deepEqual(bchartPackage.requires, ["ifthen", "tikz"]);
  assert.deepEqual(bchartPackage.tikzLibraries, ["calc"]);
});

test("lowers chart and bar options, labels, skips, and x labels to ordinary TikZ", () => {
  const diagnostics = [];
  const expanded = bchartExtension.preprocess(String.raw`
\begin{bchart}[unit=kg,width=10cm,min=10,max=30,step=5,steps={0,10,20},scale=1.5]
  \bclabel{Group}
  \bcbar[color=red!20,text=inside,label=left,value=shown]{15}
  \smallskip[label=small]
  \medskip[label=medium]
  \bigskip[label=large]
  \bcskip[label=custom]{2mm}
  \bcbar[plain]{30}
  \bcxlabel{Mass}
\end{bchart}`, { diagnostics });

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\begin\{tikzpicture\}\[scale=1\.5,font=\\sffamily\]/);
  assert.match(expanded, /fill=red!20/);
  assert.match(expanded, /rectangle \(2\.5,-0\.75\)/);
  assert.match(expanded, /\{shown\}/);
  assert.match(expanded, /\{inside\}/);
  assert.match(expanded, /\{left\}/);
  assert.match(expanded, /\{small\}/);
  assert.match(expanded, /\{medium\}/);
  assert.match(expanded, /\{large\}/);
  assert.match(expanded, /\{custom\}/);
  assert.match(expanded, /\{Mass\}/);
  assert.doesNotMatch(expanded, /\\(?:bcbar|bclabel|bcskip|smallskip|medskip|bigskip|bcxlabel)\b/);
  assert.doesNotMatch(
    expanded,
    /\\node\[anchor=west\] at \(10,[^)]+\) \{30kg\}/,
    "plain bar should suppress its value node"
  );

  const rendered = tikzToSvg(expanded, { mathRenderer: "svg-text" });
  assert.deepEqual(rendered.diagnostics, []);
  const renderedBars = rendered.ir.items.filter(
    (item) => item.type === "path" && item.style?.fill && item.style.fill !== "none"
  );
  const firstBarXs = renderedBars[0].commands.map((command) => command.x).filter(Number.isFinite);
  const renderedTexts = rendered.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  assert.ok(Math.abs(Math.max(...firstBarXs) - Math.min(...firstBarXs) - 3.75) < 1e-9);
  assert.equal(renderedTexts.filter((text) => text === "30kg").length, 1, "plain bar should leave only the 30kg tick");
  for (const tick of ["10kg", "20kg", "30kg"]) assert.ok(renderedTexts.includes(tick));
});

test("supports plain charts and default step progression", () => {
  const plain = tikzToSvg(String.raw`
\usepackage{bchart}
\begin{bchart}[plain,width=4cm,min=-10,max=10,step=5]
  \bcbar{0}
  \bcxlabel{Hidden scale}
\end{bchart}`, { mathRenderer: "svg-text" });

  assert.deepEqual(plain.diagnostics, []);
  const labels = plain.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  assert.ok(labels.includes("0"), "bar value remains visible on a plain chart");
  assert.ok(labels.includes("Hidden scale"));
  assert.equal(labels.includes("-10"), false, "plain chart should suppress scale labels");
  assert.equal(labels.includes("10"), false, "plain chart should suppress scale labels");
});

test("renders the real bchart fixture with native bar and scale geometry", async () => {
  const source = await readFile(FIXTURE_URL, "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");
  const bars = paths.filter((item) => item.style?.fill && item.style.fill !== "none");
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /font-family="TikZKitCMUSans,[^"]+"/);
  assert.doesNotMatch(result.svg, /scale\(0\.79 1\)/);
  assert.equal(bars.length, 12);
  for (const bar of bars) {
    const ys = bar.commands.map((command) => command.y).filter(Number.isFinite);
    assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 0.5) < 1e-9, "each bar should be 5mm high");
  }

  const horizontalAxis = paths.find((item) => {
    const points = item.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y));
    return points.length === 2 && Math.abs(points[0].y - points[1].y) < 1e-9 && Math.abs(points[1].x - points[0].x - 8) < 1e-9;
  });
  assert.ok(horizontalAxis, "expected an 8cm horizontal axis");

  for (let value = 0; value <= 550; value += 50) {
    assert.ok(textNodes.some((item) => item.text === String(value)), `missing ${value} scale label`);
  }
  assert.ok(textNodes.every((item) => /SansSerif|sans/i.test(item.style?.fontFamily || "")), "all bchart text should be sans serif");
});
