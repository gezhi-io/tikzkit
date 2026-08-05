import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { preprocessTikzSource } from "../src/frontend/latex-shell.js";
import { renderExampleFixtures } from "../scripts/render-example-fixtures.js";

test("lowers PGFPlots' standalone custom legend internals into normal TikZ primitives", () => {
  const source = String.raw`\begin{tikzpicture}
\begingroup
\csname pgfplots@init@cleared@structures\endcsname
[legend entries={one,two},legend style={at={(2,-3)},anchor=center}]
\csname pgfplots@addlegendimage\endcsname{blue,fill=blue!20,area legend}
\csname pgfplots@addlegendimage\endcsname{->,red,sharp plot}
\csname pgfplots@createlegend\endcsname
\endgroup
\end{tikzpicture}`;

  const result = preprocessTikzSource(source);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.source.includes("pgfplots@createlegend"), false);
  assert.equal(result.source.includes("\\begingroup"), false);
  assert.match(result.source, /\\draw\[blue,fill=blue!20,area legend\]/);
  assert.match(result.source, /\\draw\[->,red,sharp plot\]/);
  assert.match(result.source, /font=\\footnotesize/);
});

test("renders the actual standalone PGFPlots custom legend in the dependency graph", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-custom-legend-"));
  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["latex-examples-informatikstudium-kit-abhaengigkeitsgraph"],
    skipTikztosvg: true,
    skipPng: true
  });

  const [entry] = summary.cases;
  assert.deepEqual(entry.diagnostics, []);
  const svg = await readFile(path.join(outputRoot, entry.tikzkitSvg), "utf8");
  assert.match(svg, /Pflichtmodul/);
  assert.match(svg, /Harte Abhängigkeit/);
});
