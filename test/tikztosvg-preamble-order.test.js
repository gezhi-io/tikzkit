import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderExampleFixtures } from "../scripts/render-example-fixtures.js";

test("tikztosvg preamble libraries run before declarations that use their keys", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-preamble-order-"));
  const outputRoot = path.join(fixtureRoot, "output");
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await writeFile(path.join(fixtureRoot, "library-order.tex"), String.raw`
\documentclass{standalone}
\usepackage{tikz}
\usepackage{relsize,bm}
\usetikzlibrary{arrows,shapes.misc}
\tikzset{>=stealth',point/.style={cross out,draw}}
\usepgfplotslibrary{fillbetween}
\pgfplotsset{every axis/.append style={clip=false}}
\begin{document}
\begin{tikzpicture}\draw[->] (0,0) -- (1,0);\end{tikzpicture}
\end{document}
`);
  let wrapper;
  const summary = await renderExampleFixtures({
    fixtureRoot, outputRoot,
    external: {
      async commandExists(command) { return command === "tikztosvg"; },
      async runCommand(command, args) {
        assert.equal(command, "tikztosvg");
        const packages = args.flatMap((value, index) => value === "-p" ? [args[index + 1]] : []);
        assert.ok(packages.includes("relsize"), "Native relative math needs relsize.sty");
        assert.ok(packages.includes("bm"), "Native bold math needs bm.sty");
        wrapper = await readFile(path.join(outputRoot, ".tikzkit-preamble-inputs",
          "library-order", "tikzkit-library-order-preamble.sty"), "utf8");
        await writeFile(args[args.indexOf("-o") + 1], '<svg width="10pt" height="10pt"></svg>');
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });
  assert.equal(summary.renderedTikztosvg, 1);
  assert.match(wrapper, /\\usetikzlibrary\{arrows,shapes\.misc\}/);
  assert.match(wrapper, /\\usepgfplotslibrary\{fillbetween\}/);
  assert.ok(wrapper.indexOf("\\usetikzlibrary") < wrapper.indexOf("\\tikzset"));
  assert.ok(wrapper.indexOf("\\usepgfplotslibrary") < wrapper.indexOf("\\pgfplotsset"));
});
