import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  addComparisonGridToSvg,
  formatExampleRenderSummary,
  normalizeTikztosvgInput,
  parseExampleRenderArgs,
  renderExampleFixtures,
  selectActiveFigureSource
} from "../scripts/render-example-fixtures.js";
import { encodePng } from "../scripts/diff-example-pngs.js";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";

test("example fixture renderer writes TikZKit and tikztosvg artifacts from manifest cases", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const calls = [];
  const external = {
    async commandExists(command) {
      calls.push({ type: "exists", command });
      return command === "tikztosvg";
    },
    async runCommand(command, args, options = {}) {
      calls.push({ type: "run", command, args, options });
      assert.equal(args.includes("--xelatex"), true);
      const wrapperDir = String(options.env?.PATH || "").split(path.delimiter)[0];
      const rmWrapper = await readFile(path.join(wrapperDir, "rm"), "utf8");
      assert.match(rmWrapper, /exec \/bin\/rm/);
      const tikztosvgInput = await readFile(args.at(-1), "utf8");
      assert.doesNotMatch(tikztosvgInput, /\\documentclass/);
      assert.doesNotMatch(tikztosvgInput, /\\begin\{document\}/);
      assert.match(tikztosvgInput, /\\begin\{tikzpicture\}/);
      const outputIndex = args.includes("--output") ? args.indexOf("--output") : args.indexOf("-o");
      const outputPath = args[outputIndex + 1];
      await writeFile(outputPath, `<svg data-renderer="tikztosvg" data-source="${path.basename(args.at(-1))}"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.renderedTikzkit, 1);
  assert.equal(summary.renderedTikztosvg, 1);
  assert.equal(summary.cases[0].id, "axis-basic-range");
  assert.equal(calls.some((call) => call.type === "run" && call.command === "tikztosvg"), true);

  const tikzkitSvg = await readFile(path.join(outputRoot, "tikzkit-svg", "axis-basic-range.svg"), "utf8");
  const tikztosvgSvg = await readFile(path.join(outputRoot, "tikztosvg-svg", "axis-basic-range.svg"), "utf8");
  const summaryJson = JSON.parse(await readFile(path.join(outputRoot, "summary.json"), "utf8"));

  assert.match(tikzkitSvg, /<svg class="tikz-render-svg"/);
  assert.match(tikztosvgSvg, /data-renderer="tikztosvg"/);
  assert.equal(summaryJson.cases[0].tikzkitSvg.endsWith("axis-basic-range.svg"), true);
  assert.equal(summaryJson.cases[0].tikztosvgInput.endsWith("axis-basic-range.tex"), true);
});

test("example fixture renderer expands local input files before rendering", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await mkdir(path.join(fixtureRoot, "partials"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "wrapper.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{tikz}",
      "\\begin{document}",
      "\\input{partials/body}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(fixtureRoot, "partials", "body.tex"),
    "\\begin{tikzpicture}\\draw[red] (0,0) -- (1,0);\\end{tikzpicture}\n",
    "utf8"
  );

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    only: ["wrapper"],
    external: {
      async commandExists(command) {
        return command === "tikztosvg";
      },
      async runCommand(_command, args) {
        const tikztosvgInput = await readFile(args.at(-1), "utf8");
        assert.doesNotMatch(tikztosvgInput, /\\input/);
        assert.match(tikztosvgInput, /\\begin\{tikzpicture\}/);
        assert.match(tikztosvgInput, /\\draw\[red\]/);
        const outputIndex = args.indexOf("-o");
        await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  const tikztosvgInput = await readFile(path.join(outputRoot, "tikztosvg-input", "wrapper.tex"), "utf8");

  assert.equal(summary.total, 1);
  assert.equal(summary.renderedTikztosvg, 1);
  assert.doesNotMatch(tikztosvgInput, /\\input/);
  assert.equal(summary.cases[0].diagnostics.some((diagnostic) => /input/i.test(`${diagnostic.code} ${diagnostic.message}`)), false);
});

test("example fixture renderer resolves manifest resources for TikZKit and tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-resources-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await mkdir(path.join(fixtureRoot, "resources", "chart"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "chart.tex"),
    String.raw`\begin{tikzpicture}\begin{axis}\addplot table[x=x,y=y,col sep=comma] {data.csv};\end{axis}\end{tikzpicture}`,
    "utf8"
  );
  await writeFile(path.join(fixtureRoot, "resources", "chart", "data.csv"), "x,y\n0,1\n1,2\n", "utf8");
  await writeFile(
    path.join(fixtureRoot, "manifest.json"),
    `${JSON.stringify({
      version: 1,
      cases: [{
        id: "resource-chart",
        title: "Resource chart",
        source: "chart.tex",
        resources: [{ name: "data.csv", source: "resources/chart/data.csv" }]
      }]
    })}\n`,
    "utf8"
  );

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    external: {
      async commandExists(command) {
        return command === "tikztosvg";
      },
      async runCommand(_command, args) {
        const input = await readFile(args.at(-1), "utf8");
        assert.match(input, /\{resources\/chart\/data\.csv\}/);
        const outputIndex = args.indexOf("-o");
        await writeFile(args[outputIndex + 1], "<svg></svg>", "utf8");
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  assert.equal(summary.cases[0].diagnostics.some((entry) => /Could not resolve pgfplots table/.test(entry.message)), false);
  assert.match(await readFile(path.join(outputRoot, "tikzkit-svg", "resource-chart.svg"), "utf8"), /<path/);
});

test("example fixture renderer can select an active tikzpicture for TikZKit and tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await writeFile(
    path.join(fixtureRoot, "manifest.json"),
    `${JSON.stringify({
      version: 1,
      cases: [
        {
          id: "multi-picture",
          title: "Multi Picture",
          source: "multi.tex",
          activeFigureId: "figure:1",
          semanticOwner: "src/frontend/parser.js",
          features: ["activeFigureId"]
        }
      ]
    })}\n`,
    "utf8"
  );
  await writeFile(
    path.join(fixtureRoot, "multi.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{tikz}",
      "\\tikzset{shared/.style={draw}}",
      "\\begin{document}",
      "\\begin{tikzpicture}",
      "\\node[shared] {First};",
      "\\end{tikzpicture}",
      "middle text that is not part of the selected picture",
      "\\begin{tikzpicture}",
      "\\node[shared] {Second};",
      "\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    only: ["multi-picture"],
    comparisonGrid: false,
    external: {
      async commandExists(command) {
        return command === "tikztosvg";
      },
      async runCommand(_command, args) {
        const tikztosvgInput = await readFile(args.at(-1), "utf8");
        assert.match(tikztosvgInput, /Second/);
        assert.doesNotMatch(tikztosvgInput, /First/);
        assert.doesNotMatch(tikztosvgInput, /middle text/);
        const outputIndex = args.indexOf("-o");
        await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  const tikzkitSvg = await readFile(path.join(outputRoot, "tikzkit-svg", "multi-picture.svg"), "utf8");
  const tikztosvgInput = await readFile(path.join(outputRoot, "tikztosvg-input", "multi-picture.tex"), "utf8");
  const html = await readFile(path.join(outputRoot, "index.html"), "utf8");

  assert.equal(summary.cases[0].activeFigureId, "figure:1");
  assert.match(tikzkitSvg, /Second/);
  assert.doesNotMatch(tikzkitSvg, /First/);
  assert.match(tikztosvgInput, /Second/);
  assert.doesNotMatch(tikztosvgInput, /First/);
  assert.match(html, /active figure: figure:1/);
});

test("does not select a tikzpicture nested inside a preamble environment definition", () => {
  const source = String.raw`\documentclass{standalone}
\newenvironment{diagram}{\begin{tikzpicture}}{\end{tikzpicture}}
\begin{document}
\begin{diagram}\draw (0,0)--(1,0);\end{diagram}
\end{document}`;
  assert.equal(selectActiveFigureSource(source, "figure:0"), source);
});

test("example fixture renderer discovers TikZ files that are not listed in the manifest", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await mkdir(path.join(fixtureRoot, "basic"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "manifest.json"),
    `${JSON.stringify({
      version: 1,
      cases: [
        {
          id: "listed-case",
          title: "Listed Case",
          source: "listed.tikz",
          semanticOwner: "src/tikz/commands/draw.js",
          features: ["draw"]
        }
      ]
    })}\n`,
    "utf8"
  );
  await writeFile(path.join(fixtureRoot, "listed.tikz"), "\\begin{tikzpicture}\\draw (0,0) -- (1,0);\\end{tikzpicture}\n", "utf8");
  await writeFile(path.join(fixtureRoot, "basic", "unlisted.tikz"), "\\begin{tikzpicture}\\draw (0,0) -- (0,1);\\end{tikzpicture}\n", "utf8");

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    external: {
      async commandExists() {
        return false;
      },
      async runCommand() {
        throw new Error("should not run external commands");
      }
    }
  });

  assert.deepEqual(
    summary.cases.map((entry) => entry.id),
    ["basic-unlisted", "listed-case"]
  );
  assert.equal(summary.cases.find((entry) => entry.id === "basic-unlisted").source, "basic/unlisted.tikz");
});

test("example fixture renderer can limit an external corpus render", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-external-corpus-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  for (const name of ["alpha", "beta", "gamma"]) {
    await mkdir(path.join(fixtureRoot, name), { recursive: true });
    await writeFile(
      path.join(fixtureRoot, name, `${name}.tex`),
      `\\begin{tikzpicture}\\draw (0,0) -- (1,0) node[right] {${name}};\\end{tikzpicture}\n`,
      "utf8"
    );
  }

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    limit: 2,
    external: {
      async commandExists() {
        return false;
      },
      async runCommand() {
        throw new Error("should not run external commands");
      }
    }
  });

  assert.equal(summary.total, 2);
  assert.deepEqual(
    summary.cases.map((entry) => entry.id),
    ["alpha-alpha", "beta-beta"]
  );
});

test("example fixture renderer can append a selected batch without removing earlier artifacts", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-preserved-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-preserved-output-"));
  await writeFile(path.join(fixtureRoot, "first.tikz"), "\\begin{tikzpicture}\\draw (0,0) -- (1,0);\\end{tikzpicture}\n", "utf8");
  await writeFile(path.join(fixtureRoot, "second.tikz"), "\\begin{tikzpicture}\\draw (0,0) -- (0,1);\\end{tikzpicture}\n", "utf8");
  const external = {
    async commandExists() {
      return false;
    },
    async runCommand() {
      throw new Error("should not run external commands");
    }
  };

  await renderExampleFixtures({ fixtureRoot, outputRoot, only: ["first"], external });
  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    only: ["second"],
    preserveOutput: true,
    external
  });

  assert.equal(summary.total, 2);
  assert.deepEqual(summary.cases.map((entry) => entry.id), ["first", "second"]);
  await access(path.join(outputRoot, "tikzkit-svg", "first.svg"));
  await access(path.join(outputRoot, "tikzkit-svg", "second.svg"));
});

test("example fixture renderer CLI accepts several case ids after one --only flag", () => {
  const options = parseExampleRenderArgs([
    "--only",
    "first-case",
    "second-case",
    "third-case",
    "--preserve-output",
    "--skip-png",
    "--native-reference",
    "--native-latex-engine",
    "lualatex"
  ]);

  assert.deepEqual(options.only, ["first-case", "second-case", "third-case"]);
  assert.equal(options.preserveOutput, true);
  assert.equal(options.skipPng, true);
  assert.equal(options.nativeReference, true);
  assert.equal(options.nativeLatexEngine, "lualatex");
});

test("example fixture renderer writes an opt-in native MacTeX PNG reference", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-native-reference-"));
  const calls = [];
  const nativePng = encodePng({ width: 1, height: 1, data: Buffer.from([255, 255, 255, 255]) });
  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    skipTikztosvg: true,
    skipPng: true,
    nativeReference: true,
    external: {
      async commandExists(command) {
        return command === "pdflatex" || command === "pdftocairo";
      },
      async runCommand(command, args, options = {}) {
        calls.push({ command, args, options });
        if (command === "pdftocairo") await writeFile(`${args.at(-1)}.png`, nativePng);
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  assert.equal(summary.nativeReferenceRequested, true);
  assert.equal(summary.nativeLatexAvailable, true);
  assert.equal(summary.renderedMacTeXPng, 1);
  assert.equal(summary.cases[0].mactexPngStatus, "rendered");
  await access(path.join(outputRoot, "mactex-png", "axis-basic-range.png"));
  const html = await readFile(path.join(outputRoot, "index.html"), "utf8");
  assert.match(html, /MacTeX PNG/);
  assert.equal(calls.filter((call) => call.command === "pdflatex").length, 2);
  assert.equal(calls.some((call) => call.command === "pdftocairo"), true);
  const compile = calls.find((call) => call.command === "pdflatex");
  assert.equal(compile.args.includes("-jobname=reference"), true);
  assert.match(compile.options.cwd, /\.mactex-work[\\/]axis-basic-range$/);
});

test("native MacTeX references normalize legacy tkz-euclide object loaders", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-native-legacy-tkz-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-native-legacy-tkz-output-"));
  const nativePng = encodePng({ width: 1, height: 1, data: Buffer.from([255, 255, 255, 255]) });
  await writeFile(
    path.join(fixtureRoot, "frame.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{tkz-euclide}",
      "\\begin{document}",
      "\\usetkzobj{all}",
      "\\begin{tikzpicture}\\tkzDefPoints{0/0/A,1/0/B,0/1/C}\\tkzMarkAngle[arc=lll,size=0.6cm](A,B,C)\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    skipTikztosvg: true,
    skipPng: true,
    nativeReference: true,
    external: {
      async commandExists(command) {
        return command === "pdflatex" || command === "pdftocairo";
      },
      async runCommand(command, args) {
        if (command === "pdflatex") {
          const nativeInput = await readFile(args.at(-1), "utf8");
          assert.doesNotMatch(nativeInput, /\\usetkzobj/);
          assert.doesNotMatch(nativeInput, /arc=lll,size=0\.6cm/);
          assert.match(nativeInput, /arc=lll,size=0\.6/);
        }
        if (command === "pdftocairo") await writeFile(`${args.at(-1)}.png`, nativePng);
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  assert.equal(summary.renderedMacTeXPng, 1);
});

test("native MacTeX references materialize manifest resources beside their rewritten source", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-native-resource-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-native-resource-output-"));
  const nativePng = encodePng({ width: 1, height: 1, data: Buffer.from([255, 255, 255, 255]) });
  await mkdir(path.join(fixtureRoot, "resources", "chart"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "chart.tex"),
    String.raw`\documentclass{standalone}\usepackage{pgfplots}\begin{document}\begin{tikzpicture}\begin{axis}\addplot table[x=x,y=y,col sep=comma] {data.csv};\end{axis}\end{tikzpicture}\end{document}`,
    "utf8"
  );
  await writeFile(path.join(fixtureRoot, "resources", "chart", "data.csv"), "x,y\n0,1\n1,2\n", "utf8");
  await writeFile(
    path.join(fixtureRoot, "manifest.json"),
    `${JSON.stringify({
      version: 1,
      cases: [{
        id: "resource-chart",
        title: "Resource chart",
        source: "chart.tex",
        resources: [{ name: "data.csv", source: "resources/chart/data.csv" }]
      }]
    })}\n`,
    "utf8"
  );

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    skipTikztosvg: true,
    skipPng: true,
    nativeReference: true,
    external: {
      async commandExists(command) {
        return command === "pdflatex" || command === "pdftocairo";
      },
      async runCommand(command, args) {
        if (command === "pdflatex") {
          const input = await readFile(args.at(-1), "utf8");
          assert.match(input, /\{resources\/chart\/data\.csv\}/);
          assert.equal(
            await readFile(path.join(path.dirname(args.at(-1)), "resources", "chart", "data.csv"), "utf8"),
            "x,y\n0,1\n1,2\n"
          );
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        assert.equal(command, "pdftocairo");
        await writeFile(`${args.at(-1)}.png`, nativePng);
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  assert.equal(summary.renderedMacTeXPng, 1);
  assert.equal(summary.cases[0].mactexPngStatus, "rendered");
});

test("example fixture renderer writes a comparison index page for generated artifacts", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external: {
      async commandExists() {
        return false;
      },
      async runCommand() {
        throw new Error("should not run external commands");
      }
    }
  });

  const html = await readFile(path.join(outputRoot, "index.html"), "utf8");
  assert.equal(summary.total, 1);
  assert.match(html, /axis-basic-range/);
  assert.match(html, /TikZKit JS PNG/);
  assert.match(html, /tikztosvg PNG/);
  assert.doesNotMatch(html, /<object\b/);
  assert.match(html, /tikztosvg SVG/);
  assert.match(html, /tikzkit-svg\/axis-basic-range\.svg/);
  assert.match(html, /<span class="missing">missing<\/span>/);
});

test("example fixture comparison page shows TikZKit diagnostic details", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await writeFile(
    path.join(fixtureRoot, "warning.tikz"),
    "\\begin{tikzpicture}\\node {Unstable text};\\end{tikzpicture}\n",
    "utf8"
  );
  const textEngine = {
    measure(request) {
      if (request.mode !== "text") return null;
      return {
        cacheKey: `text:${request.text}`,
        pending: true
      };
    },
    async flushPending() {
      return ["still-pending"];
    },
    renderFromCache() {
      return null;
    }
  };

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    only: ["warning"],
    renderOptions: { textEngine, textEngineUnit: 100, maxTextEnginePasses: 1 },
    external: {
      async commandExists() {
        return false;
      },
      async runCommand() {
        throw new Error("should not run external commands");
      }
    }
  });

  const html = await readFile(path.join(outputRoot, "index.html"), "utf8");

  assert.equal(summary.cases[0].diagnostics.length, 1);
  assert.match(html, /diagnostics: 1/);
  assert.match(html, /text-engine-pass-limit/);
  assert.match(html, /Text engine measurement did not settle after 1 passes/);
});

test("example fixture renderer writes SVG-layer comparison grids without changing renderer source inputs", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external: {
      async commandExists(command) {
        return command === "tikztosvg";
      },
      async runCommand(_command, args) {
        const outputIndex = args.indexOf("-o");
        await writeFile(
          args[outputIndex + 1],
          `<svg data-renderer="tikztosvg" width="10pt" height="10pt" viewBox="-15 -25 70 80"><path d="M 0 0 L 10 0"/></svg>`,
          "utf8"
        );
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  const tikzkitSvg = await readFile(path.join(outputRoot, "tikzkit-svg", "axis-basic-range.svg"), "utf8");
  const tikzkitGridSvg = await readFile(path.join(outputRoot, "tikzkit-grid-svg", "axis-basic-range.svg"), "utf8");
  const tikztosvgSvg = await readFile(path.join(outputRoot, "tikztosvg-svg", "axis-basic-range.svg"), "utf8");
  const tikztosvgGridSvg = await readFile(path.join(outputRoot, "tikztosvg-grid-svg", "axis-basic-range.svg"), "utf8");
  const tikztosvgInput = await readFile(path.join(outputRoot, "tikztosvg-input", "axis-basic-range.tex"), "utf8");

  assert.doesNotMatch(tikzkitSvg, /class="tikzkit-comparison-grid"/);
  assert.doesNotMatch(tikztosvgSvg, /class="tikzkit-comparison-grid"/);
  assert.doesNotMatch(tikztosvgInput, /tikzkit compare grid/);
  assert.doesNotMatch(tikztosvgInput, /current bounding box\.south west/);
  assert.match(tikzkitGridSvg, /class="tikzkit-comparison-grid"/);
  assert.match(tikztosvgGridSvg, /class="tikzkit-comparison-grid"/);
  assert.match(tikzkitGridSvg, /stroke-dasharray=/);
  assert.match(tikztosvgGridSvg, /stroke-dasharray=/);
});

test("example fixture renderer can still inject source-level comparison grids when requested", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    comparisonGridMode: "source",
    external: {
      async commandExists(command) {
        return command === "tikztosvg";
      },
      async runCommand(_command, args) {
        const outputIndex = args.indexOf("-o");
        await writeFile(
          args[outputIndex + 1],
          `<svg data-renderer="tikztosvg" width="10pt" height="10pt" viewBox="-15 -25 70 80"><path d="M 0 0 L 10 0"/></svg>`,
          "utf8"
        );
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  const tikzkitSvg = await readFile(path.join(outputRoot, "tikzkit-svg", "axis-basic-range.svg"), "utf8");
  const tikztosvgInput = await readFile(path.join(outputRoot, "tikztosvg-input", "axis-basic-range.tex"), "utf8");

  assert.match(tikztosvgInput, /tikzkit compare grid/);
  assert.match(tikztosvgInput, /current bounding box\.south west/);
  assert.match(tikzkitSvg, /stroke-dasharray=/);
});

test("comparison grid uses global TikZ origin instead of viewBox corner", () => {
  const svg = `<svg width="10pt" height="10pt" viewBox="-15 -25 70 80"><rect x="-15" y="-25" width="70" height="80" fill="white" /></svg>`;
  const withGrid = addComparisonGridToSvg(svg, { unitPerCm: 10 });

  assert.match(withGrid, /class="tikzkit-comparison-grid"/);
  assert.match(withGrid, /M -20 -25 L -20 55/);
  assert.match(withGrid, /M 0 -25 L 0 55/);
  assert.match(withGrid, /M -15 -30 L 55 -30/);
  assert.match(withGrid, /M -15 0 L 55 0/);
  assert.doesNotMatch(withGrid, /M -15 -25 L -15 55/);
});

test("comparison grid stays inside an SVG root after an XML declaration", () => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="10pt" height="10pt" viewBox="0 0 10 10"><path d="M 0 0 L 1 1" /></svg>`;
  const withGrid = addComparisonGridToSvg(svg, { unitPerCm: 10 });

  assert.match(withGrid, /^<\?xml[^>]+>\s*<svg[^>]*>\s*<path class="tikzkit-comparison-grid"/);
  assert.doesNotMatch(withGrid, /^<\?xml[^>]+>\s*<path class="tikzkit-comparison-grid"/);
});

test("comparison grid infers scaled SVG user units from the viewBox and width", () => {
  const svg = `<svg width="60pt" height="60pt" viewBox="0 0 600 600"><rect x="0" y="0" width="600" height="600" fill="white" /></svg>`;
  const withGrid = addComparisonGridToSvg(svg);

  assert.match(withGrid, /class="tikzkit-comparison-grid"/);
  assert.match(withGrid, /M 0 0 L 0 600/);
  assert.match(withGrid, /M 284\.527559 0 L 284\.527559 600/);
  assert.match(withGrid, /M 569\.055118 0 L 569\.055118 600/);
  assert.doesNotMatch(withGrid, /M 28\.452756 0 L 28\.452756 600/);
});

test("comparison grid aligns to tikztosvg canvas-origin transform", () => {
  const svg = [
    `<svg width="60pt" height="20pt" viewBox="0 0 60 20">`,
    `<g transform="matrix(1, 0, 0, -1, 2, 5)">`,
    `<path d="M 0 0 L 28.452756 0" />`,
    `</g>`,
    `</svg>`
  ].join("");
  const withGrid = addComparisonGridToSvg(svg, { unitPerCm: 28.452756 });

  assert.match(withGrid, /class="tikzkit-comparison-grid"/);
  assert.match(withGrid, /M 2 0 L 2 20/);
  assert.match(withGrid, /M 30\.452756 0 L 30\.452756 20/);
  assert.match(withGrid, /M 0 5 L 60 5/);
  assert.doesNotMatch(withGrid, /M 0 0 L 0 20/);
});

test("comparison grid prefers drawing path transform over earlier glyph transforms", () => {
  const svg = [
    `<svg width="60pt" height="20pt" viewBox="0 0 60 20">`,
    `<g class="glyph" transform="matrix(1, 0, 0, -1, 9, 9)">`,
    `<path d="M 0 0 L 1 0" />`,
    `</g>`,
    `<path d="M 0 0 L 28.452756 0" transform="matrix(1, 0, 0, -1, 2, 5)" />`,
    `</svg>`
  ].join("");
  const withGrid = addComparisonGridToSvg(svg, { unitPerCm: 28.452756 });

  assert.match(withGrid, /class="tikzkit-comparison-grid"/);
  assert.match(withGrid, /M 2 0 L 2 20/);
  assert.match(withGrid, /M 0 5 L 60 5/);
  assert.doesNotMatch(withGrid, /M 9 0 L 9 20/);
  assert.doesNotMatch(withGrid, /M 0 9 L 60 9/);
});

test("example fixture renderer can skip unavailable tikztosvg", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external: {
      async commandExists() {
        return false;
      },
      async runCommand() {
        throw new Error("should not run tikztosvg");
      }
    }
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.renderedTikzkit, 1);
  assert.equal(summary.renderedTikztosvg, 0);
  assert.equal(summary.tikztosvgAvailable, false);
  assert.equal(summary.cases[0].tikztosvgSvg, null);
});

test("example fixture renderer can disable the comparison grid for tight TikZKit bbox checks", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const fixtureRoot = path.resolve("test", "fixtures", "examples");
  const sourcePath = path.join(fixtureRoot, "workbench", "line-smoke.tikz");
  const source = await readFile(sourcePath, "utf8");

  await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    only: ["workbench-line-smoke"],
    comparisonGrid: false,
    external: {
      async commandExists() {
        return false;
      },
      async runCommand() {
        throw new Error("should not run external commands");
      }
    }
  });

  const actual = await readFile(path.join(outputRoot, "tikzkit-svg", "workbench-line-smoke.svg"), "utf8");
  const expected = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" }).svg;

  assert.equal(actual.split("\n")[0], expected.split("\n")[0]);
  assert.doesNotMatch(actual, /<foreignObject/);
});

test("example fixture renderer flushes async text-engine measurements before writing TikZKit SVG", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await writeFile(
    path.join(fixtureRoot, "async-text.tikz"),
    "\\begin{tikzpicture}\\node[inner sep=0pt] {Async fixture text};\\end{tikzpicture}\n",
    "utf8"
  );
  const ready = new Set();
  const textEngine = {
    measure(request) {
      if (request.mode !== "text") return null;
      const key = `${request.mode}:${request.text}`;
      if (!ready.has(key)) return { cacheKey: key, pending: true };
      return {
        cacheKey: key,
        width: 240,
        height: 40,
        baselineY: 25,
        midLineY: 20,
        renderSourceText: request.text
      };
    },
    async flushPending() {
      ready.add("text:Async fixture text");
      return ["text:Async fixture text"];
    },
    renderFromCache(cacheKey) {
      if (!ready.has(cacheKey)) return null;
      return {
        cacheKey,
        viewBox: { x: -120, y: -20, width: 240, height: 40 },
        body: `<text class="async-fixture-payload">flushed fixture text</text>`
      };
    }
  };

  await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    only: ["async-text"],
    comparisonGrid: false,
    renderOptions: { textEngine, textEngineUnit: 100 },
    external: {
      async commandExists() {
        return false;
      },
      async runCommand() {
        throw new Error("should not run external commands");
      }
    }
  });

  const actual = await readFile(path.join(outputRoot, "tikzkit-svg", "async-text.svg"), "utf8");
  const expected = await tikzToSvgAsync(
    "\\begin{tikzpicture}\\node[inner sep=0pt] {Async fixture text};\\end{tikzpicture}\n",
    { margin: 0, mathRenderer: "svg-text", textEngine, textEngineUnit: 100 }
  );

  assert.match(actual, /async-fixture-payload/);
  assert.equal(actual.split("\n")[0], expected.svg.split("\n")[0]);
});

test("example fixture renderer passes external command timeout to tikztosvg and png conversion", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const timeoutMs = 1234;
  const calls = [];

  await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    externalCommandTimeoutMs: timeoutMs,
    external: {
      async commandExists(command) {
        return command === "tikztosvg" || command === "rsvg-convert";
      },
      async runCommand(command, args, options = {}) {
        calls.push({ command, timeoutMs: options.timeoutMs });
        if (command === "tikztosvg") {
          const outputIndex = args.indexOf("-o");
          await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
        } else if (command === "rsvg-convert") {
          const outputIndex = args.indexOf("-o");
          await writeFile(args[outputIndex + 1], "png", "utf8");
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    }
  });

  assert.equal(calls.some((call) => call.command === "tikztosvg" && call.timeoutMs === timeoutMs), true);
  assert.equal(calls.some((call) => call.command === "rsvg-convert" && call.timeoutMs === timeoutMs), true);
});

test("example fixture renderer converts SVG artifacts to PNG when rsvg-convert is available", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const converted = [];
  const external = {
    async commandExists(command) {
      return command === "tikztosvg" || command === "rsvg-convert";
    },
    async runCommand(command, args, options = {}) {
      if (command === "tikztosvg") {
        const outputIndex = args.indexOf("-o");
        await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
        return { exitCode: 0, stdout: "", stderr: "" };
      }

      assert.equal(command, "rsvg-convert");
      assert.equal(args.includes("-b"), true);
      assert.equal(args[args.indexOf("-b") + 1], "white");
      const outputIndex = args.indexOf("-o");
      const outputPath = args[outputIndex + 1];
      const inputPath = args.at(-1);
      converted.push({ outputPath, inputPath, options });
      assert.match(options.env?.FONTCONFIG_FILE || "", /fonts\.conf$/);
      assert.equal(options.env?.PANGOCAIRO_BACKEND, "fontconfig");
      assert.match(options.env?.XDG_CACHE_HOME || "", /cache$/);
      await writeFile(outputPath, `png:${path.basename(inputPath)}`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external
  });

  assert.equal(summary.svgToPngAvailable, true);
  assert.equal(summary.renderedTikzkitPng, 1);
  assert.equal(summary.renderedTikztosvgPng, 1);
  assert.equal(converted.length, 4);
  assert.equal(summary.cases[0].tikzkitPng.endsWith("axis-basic-range.png"), true);
  assert.equal(summary.cases[0].tikzkitGridPng.endsWith("axis-basic-range.png"), true);
  assert.equal(summary.cases[0].tikztosvgPng.endsWith("axis-basic-range.png"), true);
  assert.equal(summary.cases[0].tikztosvgGridPng.endsWith("axis-basic-range.png"), true);

  const fontConfig = await readFile(converted[0].options.env.FONTCONFIG_FILE, "utf8");
  assert.match(fontConfig, new RegExp(`${outputRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/fonts`));

  const tikzkitPng = await readFile(path.join(outputRoot, "tikzkit-png", "axis-basic-range.png"), "utf8");
  const tikzkitGridPng = await readFile(path.join(outputRoot, "tikzkit-grid-png", "axis-basic-range.png"), "utf8");
  const tikztosvgPng = await readFile(path.join(outputRoot, "tikztosvg-png", "axis-basic-range.png"), "utf8");
  const tikztosvgGridPng = await readFile(path.join(outputRoot, "tikztosvg-grid-png", "axis-basic-range.png"), "utf8");
  const tikzkitSvg = await readFile(path.join(outputRoot, "tikzkit-svg", "axis-basic-range.svg"), "utf8");

  await access(path.join(outputRoot, "fonts", "TikZKitCMUSerif-Roman.otf"));
  await access(path.join(outputRoot, "fonts", "TikZKitMath_Caligraphic-Regular.ttf"));
  assert.match(tikzkitPng, /png:axis-basic-range\.svg/);
  assert.match(tikzkitGridPng, /png:axis-basic-range\.svg/);
  assert.match(tikztosvgPng, /png:axis-basic-range\.svg/);
  assert.match(tikztosvgGridPng, /png:axis-basic-range\.svg/);
  assert.match(tikzkitSvg, /url\('\.\.\/fonts\/TikZKitCMUSerif-Roman\.otf'\)/);
});

test("example fixture renderer records tikztosvg logs when rendering fails", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const tikztosvgCalls = [];
  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      tikztosvgCalls.push(args);
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], "", "utf8");
      if (tikztosvgCalls.length === 1) {
        assert.equal(args.includes("-q"), true);
        return {
          exitCode: 1,
          stdout: "",
          stderr: ""
        };
      }

      assert.equal(args.includes("-q"), false);
      return {
        exitCode: 1,
        stdout: "tikztosvg stdout detail",
        stderr: "tikztosvg stderr detail"
      };
    }
  };

  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external
  });

  assert.equal(summary.renderedTikztosvg, 0);
  assert.equal(summary.cases[0].tikztosvgStatus, "failed");
  assert.equal(summary.cases[0].tikztosvgLog.endsWith("axis-basic-range.log"), true);
  assert.equal(tikztosvgCalls.length, 2);

  const log = await readFile(path.join(outputRoot, summary.cases[0].tikztosvgLog), "utf8");
  assert.match(log, /exitCode: 1/);
  assert.match(log, /tikztosvg stdout detail/);
  assert.match(log, /tikztosvg stderr detail/);
});

test("example fixture renderer removes stale tikztosvg logs after a successful render", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await mkdir(path.join(outputRoot, "tikztosvg-log"), { recursive: true });
  await writeFile(path.join(outputRoot, "tikztosvg-log", "axis-basic-range.log"), "old failure", "utf8");

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external
  });

  await assert.rejects(readFile(path.join(outputRoot, "tikztosvg-log", "axis-basic-range.log"), "utf8"), {
    code: "ENOENT"
  });
});

test("example fixture renderer clears stale managed artifacts before rendering a selected corpus", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  for (const directory of ["tikzkit-svg", "tikzkit-png", "tikztosvg-svg", "tikztosvg-input", "tikztosvg-log", "tikztosvg-png"]) {
    await mkdir(path.join(outputRoot, directory), { recursive: true });
    await writeFile(path.join(outputRoot, directory, `stale.${directory.endsWith("png") ? "png" : directory.endsWith("input") ? "tex" : directory.endsWith("log") ? "log" : "svg"}`), "stale", "utf8");
  }

  const external = {
    async commandExists(command) {
      return command === "tikztosvg" || command === "rsvg-convert";
    },
    async runCommand(command, args) {
      if (command === "tikztosvg") {
        const outputIndex = args.indexOf("-o");
        await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      assert.equal(command, "rsvg-convert");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `png:${path.basename(args.at(-1))}`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["axis-basic-range"],
    external
  });

  for (const stalePath of [
    ["tikzkit-svg", "stale.svg"],
    ["tikzkit-png", "stale.png"],
    ["tikztosvg-svg", "stale.svg"],
    ["tikztosvg-input", "stale.tex"],
    ["tikztosvg-log", "stale.log"],
    ["tikztosvg-png", "stale.png"]
  ]) {
    await assert.rejects(readFile(path.join(outputRoot, ...stalePath), "utf8"), { code: "ENOENT" });
  }
});

test("example fixture renderer CLI summary includes PNG counts", () => {
  const text = formatExampleRenderSummary({
    total: 2,
    renderedTikzkit: 2,
    renderedTikztosvg: 2,
    renderedTikzkitPng: 2,
    renderedTikztosvgPng: 1,
    outputRoot: "/tmp/out"
  });

  assert.match(text, /Rendered 2\/2 TikZKit SVG files/);
  assert.match(text, /2\/2 TikZKit PNG files/);
  assert.match(text, /1\/2 tikztosvg PNG files/);
});

test("example fixture renderer normalizes LaTeX preview wrappers before tikztosvg", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      const tikztosvgInput = await readFile(args.at(-1), "utf8");
      assert.doesNotMatch(tikztosvgInput, /\\begin\{preview\}/);
      assert.doesNotMatch(tikztosvgInput, /\\end\{preview\}/);
      assert.doesNotMatch(tikztosvgInput, /\\resizebox/);
      assert.match(tikztosvgInput, /\\begin\{tikzpicture\}/);

      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["latex-examples-arc"],
    external
  });

  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards source packages to tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-example-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-examples-"));
  await writeFile(
    path.join(fixtureRoot, "package-case.tex"),
    [
      "\\documentclass{article}",
      "\\usepackage{tikz}",
      "\\usepackage{tikz-3dplot}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\draw (0,0,0) -- (1,0,0);\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      assert.equal(args.includes("-p"), true);
      assert.equal(args[args.indexOf("-p") + 1], "tikz-3dplot");
      assert.equal(args.includes("preview"), false);
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({
    fixtureRoot,
    outputRoot,
    only: ["package-case"],
    external
  });

  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer uses pdfLaTeX for a local brunnian reference", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-brunnian-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-brunnian-output-"));
  await mkdir(path.join(fixtureRoot, "resources", "knot-trefoil"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "resources", "knot-trefoil", "brunnian.sty"), "% local package\n", "utf8");
  await writeFile(
    path.join(fixtureRoot, "knot-trefoil.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{brunnian}",
      "\\usetikzlibrary{arrows}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\draw (0,0) -- (1,0);\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args, options = {}) {
      assert.equal(command, "tikztosvg");
      assert.equal(args.includes("--pdflatex"), true);
      assert.equal(args.includes("--xelatex"), false);
      assert.equal(args[args.indexOf("-p") + 1], "brunnian");
      assert.equal(args[args.indexOf("-l") + 1], "arrows");
      assert.equal(options.env.TEXINPUTS.startsWith(`${path.resolve(fixtureRoot)}//${path.delimiter}`), true);
      const input = await readFile(args.at(-1), "utf8");
      assert.doesNotMatch(input, /\\usepackage|\\usetikzlibrary/);
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external, tikztosvgEngine: "xelatex" });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards packages and preserves package options with a local wrapper", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-font-package-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-font-package-output-"));
  await writeFile(
    path.join(fixtureRoot, "font-package.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{helvet}",
      "\\usepackage[eulergreek]{sansmath}",
      "\\begin{document}",
      "\\tikz \\node[font=\\sansmath\\sffamily] {$x$};",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args, options = {}) {
      if (command === "kpsewhich") return { exitCode: 0, stdout: `/tmp/${args[0]}\n`, stderr: "" };
      assert.equal(command, "tikztosvg");
      const packages = args.flatMap((arg, index) => arg === "-p" ? [args[index + 1]] : []);
      assert.deepEqual(packages, ["helvet", "sansmath"]);
      const wrapperDir = String(options.env.TEXINPUTS).split(path.delimiter)[0];
      const wrapper = await readFile(path.join(wrapperDir, "sansmath.sty"), "utf8");
      assert.match(wrapper, /\\PassOptionsToPackage\{eulergreek\}\{sansmath\}/);
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards mathtools to tikztosvg for coloneqq", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-mathtools-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-mathtools-output-"));
  await writeFile(
    path.join(fixtureRoot, "coloneqq.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{mathtools}",
      "\\begin{document}",
      "\\tikz \\node {$x \\coloneqq s$};",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      assert.equal(args[args.indexOf("-p") + 1], "mathtools");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer preserves circuitikz package options for tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-circuit-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-circuit-output-"));
  await writeFile(
    path.join(fixtureRoot, "circuit.tex"),
    [
      "\\documentclass[tikz]{standalone}",
      "\\usepackage[siunitx,RPvoltages]{circuitikz}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\draw (0,0) to[R=$R$] (2,0);\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args, options = {}) {
      if (command === "kpsewhich") return { exitCode: 0, stdout: `/tmp/${args[0]}\n`, stderr: "" };
      assert.equal(command, "tikztosvg");
      assert.equal(args[args.indexOf("-p") + 1], "circuitikz");
      const wrapperDir = String(options.env.TEXINPUTS).split(path.delimiter)[0];
      const wrapper = await readFile(path.join(wrapperDir, "circuitikz.sty"), "utf8");
      assert.match(wrapper, /\\PassOptionsToPackage\{siunitx,RPvoltages\}\{circuitikz\}/);
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards bchart to tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-bchart-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-bchart-output-"));
  await writeFile(
    path.join(fixtureRoot, "bchart.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{bchart}",
      "\\begin{document}",
      "\\begin{bchart}[step=50,max=550]",
      "\\bcbar[label=JAMA]{51.367}",
      "\\end{bchart}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      assert.equal(args[args.indexOf("-p") + 1], "bchart");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards nicefrac to tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-nicefrac-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-nicefrac-output-"));
  await writeFile(
    path.join(fixtureRoot, "fraction.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{nicefrac}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\node {$\\nicefrac{1}{2}x$};\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      assert.equal(args[args.indexOf("-p") + 1], "nicefrac");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards gensymb to tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-gensymb-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-gensymb-output-"));
  await writeFile(
    path.join(fixtureRoot, "degree.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{gensymb}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\node {$63 \\degree$};\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      assert.equal(args[args.indexOf("-p") + 1], "gensymb");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards units so its nicefrac dependency is available", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-units-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-units-output-"));
  await writeFile(
    path.join(fixtureRoot, "fraction.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{units}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\node {$\\nicefrac{1}{2}x$};\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      assert.equal(args[args.indexOf("-p") + 1], "units");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards tkz-fct to tikztosvg", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tkz-fct-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tkz-fct-output-"));
  await writeFile(
    path.join(fixtureRoot, "frame.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{tkz-fct}",
      "\\begin{document}",
      "\\begin{tikzpicture}\\tkzInit[xmax=4]\\tkzGrid\\tkzAxeXY\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      assert.equal(args[args.indexOf("-p") + 1], "tkz-fct");
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer forwards tkz-euclide and removes obsolete usetkzobj", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tkz-euclide-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tkz-euclide-output-"));
  await writeFile(
    path.join(fixtureRoot, "frame.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{tkz-euclide}",
      "\\begin{document}",
      "\\usetkzobj{all}",
      "\\begin{tikzpicture}\\tkzDefPoint(0,0){A}\\tkzDrawPoint(A)\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      assert.equal(command, "tikztosvg");
      const packages = args.flatMap((arg, index) => arg === "-p" ? [args[index + 1]] : []);
      assert.deepEqual(packages, ["tkz-base", "tkz-euclide"]);
      const input = await readFile(args.at(-1), "utf8");
      assert.doesNotMatch(input, /\\usetkzobj/);
      const outputIndex = args.indexOf("-o");
      await writeFile(args[outputIndex + 1], `<svg data-renderer="tikztosvg"></svg>`, "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
});

test("example fixture renderer removes obsolete usetkzobj before a native MacTeX fallback", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-legacy-tkz-native-fixtures-"));
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-legacy-tkz-native-output-"));
  const calls = [];
  await writeFile(
    path.join(fixtureRoot, "frame.tex"),
    [
      "\\documentclass{standalone}",
      "\\usepackage{tkz-euclide}",
      "\\begin{document}",
      "\\usetkzobj{all}",
      "\\begin{tikzpicture}\\tkzDefPoints{0/0/A,1/0/B,0/1/C}\\tkzMarkAngle[arc=lll,size=0.6cm](A,B,C)\\tkzDrawPoints(A)\\end{tikzpicture}",
      "\\end{document}",
      ""
    ].join("\n"),
    "utf8"
  );

  const external = {
    async commandExists(command) {
      return command === "tikztosvg";
    },
    async runCommand(command, args) {
      calls.push(command);
      if (command === "tikztosvg") {
        return { exitCode: 1, stdout: "", stderr: "legacy fixture requires native fallback" };
      }
      if (command === "pdflatex") {
        const nativeInput = await readFile(args.at(-1), "utf8");
        assert.doesNotMatch(nativeInput, /\\usetkzobj/);
        assert.doesNotMatch(nativeInput, /arc=lll,size=0\.6cm/);
        assert.match(nativeInput, /arc=lll,size=0\.6/);
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      assert.equal(command, "pdf2svg");
      await writeFile(args[1], "<svg data-renderer=\"native-latex\"></svg>", "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  };

  const summary = await renderExampleFixtures({ fixtureRoot, outputRoot, external });
  assert.equal(summary.renderedTikztosvg, 1);
  assert.equal(summary.cases[0].referenceKind, "native-latex");
  assert.deepEqual(calls, ["tikztosvg", "pdflatex", "pdflatex", "pdf2svg"]);
});

test("example fixture renderer maps legacy tkzTangent to the current tkz-euclide constructor", () => {
  const input = String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzTangent[from with R=Z](O,1cm)\tkzGetPoints{T1}{T2}
\end{tikzpicture}`;
  const normalized = normalizeTikztosvgInput(input);

  assert.match(normalized, /\\tkzDefTangent\[from with R=Z\]\(O,1cm\)/);
  assert.doesNotMatch(normalized, /\\tkzTangent\b/);
});

test("tikztosvg normalization lowers circuitikz environment aliases for tight cropping", () => {
  const input = String.raw`
\usepackage{circuitikz}
\begin{circuitikz}[american]
  \draw (0,0) to[R=$R$] (2,0);
\end{circuitikz}`;
  const normalized = normalizeTikztosvgInput(input);

  assert.match(normalized, /\\begin\{tikzpicture\}\[american\]/);
  assert.match(normalized, /\\end\{tikzpicture\}/);
  assert.doesNotMatch(normalized, /\\begin\{circuitikz\}/);
});

test("tikztosvg normalization preserves xcolor dvipsnames used by body colors", () => {
  const input = [
    "\\usepackage[usenames,dvipsnames]{xcolor}",
    "\\begin{tikzpicture}",
    "\\draw[SkyBlue] (0,0) -- (1,0);",
    "\\draw[SpringGreen] (0,1) -- (1,1);",
    "\\end{tikzpicture}",
    ""
  ].join("\n");

  const normalized = normalizeTikztosvgInput(input);

  assert.equal(normalized.includes("\\definecolor{SkyBlue}{cmyk}{0.62,0,0.12,0}"), true);
  assert.equal(normalized.includes("\\definecolor{SpringGreen}{cmyk}{0.26,0,0.76,0}"), true);
  assert.doesNotMatch(normalized, /\\usepackage/);
});

test("tikztosvg normalization converts unit-bearing legacy multi-angle sizes to centimeters", () => {
  const input = [
    "\\usepackage{tkz-euclide}",
    "\\begin{tikzpicture}",
    "\\tkzMarkAngle[arc=lll,size=0.4cm,color=green](A,B,C)",
    "\\tkzMarkAngle[arc=l,size=4mm,color=red](A,B,C)",
    "\\end{tikzpicture}",
    ""
  ].join("\n");

  const normalized = normalizeTikztosvgInput(input);

  assert.match(normalized, /\\tkzMarkAngle\[arc=lll,size=0\.4,color=green\]/);
  assert.match(normalized, /\\tkzMarkAngle\[arc=l,size=4mm,color=red\]/);
});

test("tikztosvg normalization lowers legacy orthogonal-through circle draws through the current tkz definition macro", () => {
  const input = [
    "\\usepackage{tkz-euclide}",
    "\\begin{tikzpicture}",
    "\\tkzDrawCircle[fill,orthogonal through=A and B,color=white](O,Z)",
    "\\end{tikzpicture}",
    ""
  ].join("\n");

  const normalized = normalizeTikztosvgInput(input);

  assert.match(normalized, /\\tkzDefCircle\[orthogonal through=A and B\]\(O,Z\)/);
  assert.match(normalized, /\\node\[draw,circle through=\(tkzSecondPointResult\),fill,color=white\] at \(tkzFirstPointResult\) \{\};/);
  assert.doesNotMatch(normalized, /\\tkzDrawCircle\[fill,orthogonal through=A and B,color=white\]/);
});

test("tikztosvg normalization adds TikZ libraries required by extracted path decorations and layers", () => {
  const input = String.raw`\begin{tikzpicture}
\begin{axis}
\draw[decoration={text along path, text={overfitting}}, decorate] (axis cs:0,0) -- (axis cs:1,1);
\end{axis}
\begin{pgfonlayer}{background}
\fill[gray] (0,0) rectangle (1,1);
\end{pgfonlayer}
\coordinate (p) at ($(0,0)+(1,1)$);
\end{tikzpicture}`;

  const normalized = normalizeTikztosvgInput(input);

  assert.match(normalized, /\\usetikzlibrary\{decorations\.text,backgrounds,calc\}/);
  assert.match(normalized, /text along path/);
  assert.match(normalized, /\\begin\{pgfonlayer\}\{background\}/);
});

test("tikztosvg normalization lowers supported raw gnuplot chi-squared plots to coordinates", () => {
  const input = String.raw`\documentclass{standalone}
\usepackage{pgfplots}
\begin{document}
\begin{tikzpicture}
\begin{axis}
\foreach \k in {2} {%
  \addplot+[mark={}] gnuplot[raw gnuplot] {%
    chisq(x,k)=igamma(k/2.0, x/2.0);
    set xrange [0:4];
    set yrange [0:1.0];
    samples=3;
    plot chisq(x,\k)};
  \addlegendentryexpanded{$k = \k$}}
\end{axis}
\end{tikzpicture}
\end{document}`;

  const normalized = normalizeTikztosvgInput(input);

  assert.doesNotMatch(normalized, /gnuplot\[raw gnuplot\]/);
  assert.match(normalized, /\\addplot\+\[mark=\{\}\] coordinates \{/);
  assert.match(normalized, /\(0,0\)/);
  assert.match(normalized, /\(4,/);
  assert.match(normalized, /\\addlegendentryexpanded\{\$k = 2\$\}/);
});
