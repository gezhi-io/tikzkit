import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderExampleFixtures } from "../scripts/render-example-fixtures.js";
import { tikzToSvg } from "../src/index.js";
import { texPackageCatalog } from "../src/packages/index.js";

test("records the implemented ifthen subset without claiming full TeX compatibility", () => {
  const ifthen = texPackageCatalog.ifthen;

  assert.equal(ifthen.status, "partial");
  assert.match(ifthen.implementedBy, /evaluateIfThenElseCondition/);
  assert.ok(ifthen.localSourceReviewed.endsWith("/latex/base/ifthen.sty"));
  assert.ok(ifthen.features.some((feature) => feature.includes("\\ifthenelse")));
  assert.match(ifthen.notes, /\\newboolean/);
  assert.match(ifthen.notes, /\\whiledo/);
});

test("evaluates ifthenelse relations after loop-local math and breaks only the inner foreach", () => {
  const source = [
    "\\begin{tikzpicture}",
    "  \\foreach \\y in {0,...,3}{",
    "    \\pgfmathsetmacro{\\limit}{3-\\y}",
    "    \\foreach \\x in {0,...,3}{",
    "      \\ifthenelse{\\x>\\limit}{\\breakforeach}{}",
    "      \\pgfmathtruncatemacro\\X{\\x}",
    "      \\node[draw,circle] at (\\x,\\y) {};",
    "      \\ifthenelse{\\X<\\limit}{\\draw (\\x,\\y) -- (\\x+1,\\y);}{}",
    "    }",
    "  }",
    "\\end{tikzpicture}"
  ].join("\n");
  const { diagnostics, ir } = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.type === "nodeBox").length, 13);
  assert.equal(ir.items.filter((item) => item.type === "path").length, 6);
});

test("forwards the ifthen package to tikztosvg references", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-ifthen-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-ifthen-output-"));
  await mkdir(path.join(fixtureRoot, "output"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "manifest.json"),
    JSON.stringify({ version: 1, cases: [{ id: "ifthen-loop", title: "Ifthen loop", source: "ifthen-loop.tex" }] }) + "\n",
    "utf8"
  );
  await writeFile(
    path.join(fixtureRoot, "ifthen-loop.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{ifthen}",
      "\\usepackage{tikz}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\foreach \\x in {0,1}{\\ifthenelse{\\x=1}{\\breakforeach}{}\\node at (\\x,0) {};}\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    external: {
      async commandExists(command) {
        return command === "tikztosvg";
      },
      async runCommand(command, args) {
        assert.equal(command, "tikztosvg");
        assert.ok(args.some((arg, index) => arg === "-p" && args[index + 1] === "ifthen"));
        const outputIndex = args.indexOf("-o");
        await writeFile(args[outputIndex + 1], "<svg></svg>", "utf8");
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  assert.equal(summary.renderedTikztosvg, 1);
});
