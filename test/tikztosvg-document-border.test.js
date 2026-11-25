import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderExampleFixtures } from "../scripts/render-example-fixtures.js";
import { commandExists } from "../src/adapters/externalLatex.js";

test("tikztosvg keeps the original TeX page size after a picture freezes its bounds", async (t) => {
  for (const tool of ["pdflatex", "pdfinfo", "pdf2svg", "tikztosvg"]) {
    if (!await commandExists(tool)) return t.skip(`native comparison requires ${tool}`);
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "tikztosvg-border-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixtures = [
    "scoped-render-parity/manual-circle-lens.tex",
    "decoration-box-qa/bounding-box-shorthand.tex",
    "decoration-box-qa/preview-clip-transform.tex",
    "picture-command/manual-three-paths.tex" // Braced shorthand with tracking still enabled.
  ];
  for (const file of fixtures) {
    await copyFile(new URL(`./fixtures/${file}`, import.meta.url), path.join(root, path.basename(file)));
  }
  // The early clip is scoped; the late clip must still enlarge the box before the margin.
  await writeFile(path.join(root, "end-picture-clip.tex"), String.raw`\documentclass[border={2pt 5pt}]{standalone}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}[execute at end picture={\clip (0,0) rectangle (2,1);\fill[red] (-3,-3) rectangle (3,3);}]
  \begin{scope}\clip (-1,0) circle (4pt);\fill[blue] (-3,-3) rectangle (3,3);\end{scope}
\end{tikzpicture}
\end{document}`);
  const outputRoot = path.join(root, "output");
  const { cases } = await renderExampleFixtures({
    fixtureRoot: root, outputRoot, tikztosvgEngine: "pdflatex", comparisonGrid: false, skipPng: true
  });
  assert.equal(cases.length, fixtures.length + 1);
  for (const entry of cases) {
    await t.test(entry.id, async () => {
      // Compile the untouched document, not a second copy of the normalized converter input.
      const run = (tool, args) => execFileSync(tool, args, { cwd: root, encoding: "utf8", timeout: 20000 });
      run("pdflatex", ["-halt-on-error", "-interaction=nonstopmode", entry.source]);
      const info = run("pdfinfo", [`${entry.id}.pdf`]);
      const size = /^Page size:\s+([\d.]+) x ([\d.]+) pts/m.exec(info);
      assert.ok(size, info);
      assert.equal(entry.referenceKind, "tikztosvg");
      assert.equal(entry.tikztosvgStatus, "rendered");
      const svg = await readFile(path.join(outputRoot, entry.tikztosvgSvg), "utf8");
      const page = /<svg\b[^>]*>/.exec(svg)?.[0];
      const dimensions = size.slice(1).map(Number);
      const physicalSize = ["width", "height"].map((key) => {
        const attribute = new RegExp(`\\b${key}="([\\d.]+)pt"`).exec(page);
        assert.ok(attribute, `missing physical ${key}: ${page}`);
        return Number(attribute[1]);
      });
      assert.deepEqual(physicalSize, dimensions);
      assert.deepEqual(/viewBox="([^"]+)"/.exec(page)?.[1].split(/\s+/).map(Number), [0, 0, ...dimensions]);
    });
  }
});
