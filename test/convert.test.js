import assert from "node:assert/strict";
import test from "node:test";
import { convertTikzToSvg, convertTikzToSvgAsync, tikzToSvg } from "../src/index.js";
import { parseCliArgs, runCli } from "../src/cli/index.js";
import { createSvgTextEngine } from "../src/renderers/svg/index.js";

test("public convertTikzToSvg interface returns an ok conversion result", () => {
  const result = convertTikzToSvg(String.raw`\draw (0,0) -- (1,0);`);

  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.length, 0);
  assert.match(result.svg, /<svg/);
  assert.equal(tikzToSvg, convertTikzToSvg);
});

test("public default KaTeX conversion creates text engine before sizing math node boxes", () => {
  const formula = String.raw`$A=\begin{pmatrix}2&1\\0&3\end{pmatrix}$`;
  const expected = createSvgTextEngine({ unit: 100, mathRenderer: "katex" }).measure({
    text: formula,
    mode: "math",
    textWidthPt: null,
    fontStyle: "normal",
    fontWeight: "normal",
    fontFamily: "serif",
    fontSizePt: 10
  });
  const result = convertTikzToSvg(String.raw`
\begin{tikzpicture}
  \node[draw, inner sep=0pt] {${formula}};
\end{tikzpicture}`, { margin: 0 });
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(box, "expected a rendered node box");
  assert.ok(Math.abs(box.width - expected.width / 100) < 0.03, `expected node width to use default KaTeX text-engine metrics ${expected.width / 100}cm, got ${box.width}cm`);
  assert.ok(Math.abs(box.height - expected.height / 100) < 0.03, `expected node height to use default KaTeX text-engine metrics ${expected.height / 100}cm, got ${box.height}cm`);
});

test("public default KaTeX conversion sizes inline pmatrix nodes close to tikztosvg", () => {
  const result = convertTikzToSvg(String.raw`
\begin{tikzpicture}
  \node[draw, inner sep=0pt] {$A=\begin{pmatrix}2&1\\0&3\end{pmatrix}$};
\end{tikzpicture}`, { margin: 0 });
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(box, "expected a rendered node box");
  assert.ok(box.width > 1.85 && box.width < 2.1, `expected tikztosvg-like matrix node width near 1.96cm, got ${box.width}cm`);
  assert.ok(box.height > 0.75 && box.height < 0.95, `expected tikztosvg-like matrix node height near 0.85cm, got ${box.height}cm`);
});

test("async conversion flushes pending text-engine measurements before final node layout", async () => {
  const requests = [];
  const ready = new Set();
  let flushedOnce = false;
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      requests.push({ ...request });
      if (request.mode !== "text") return null;
      const key = `${request.mode}:${request.text}`;
      if (!ready.has(key)) {
        return {
          cacheKey: key,
          pending: true
        };
      }
      return {
        cacheKey: key,
        width: 300,
        height: 60,
        baselineY: 38,
        midLineY: 30,
        renderSourceText: request.text
      };
    },
    async flushPending() {
      if (flushedOnce) return [];
      flushedOnce = true;
      ready.add("text:Async text");
      return ["text:Async text"];
    },
    renderFromCache(cacheKey) {
      return {
        cacheKey,
        viewBox: { x: -150, y: -30, width: 300, height: 60 },
        body: `<text>Async text</text>`
      };
    }
  };

  const result = await convertTikzToSvgAsync(String.raw`
\begin{tikzpicture}
  \node[draw, inner sep=0pt] {Async text};
\end{tikzpicture}`, { margin: 0, textEngine, textEngineUnit: 100 });
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(requests.length >= 2, `expected an initial measure and a post-flush remeasure, got ${JSON.stringify(requests)}`);
  assert.ok(box, "expected node box");
  assert.ok(box.width > 2.9 && box.width < 3.1, `expected async measured width near 3cm, got ${box.width}`);
  assert.match(result.svg, /Async text/);
});

test("async conversion repeats text-engine flushes until node layout has stable metrics", async () => {
  const requests = [];
  let flushCount = 0;
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      requests.push({ ...request, flushCount });
      if (request.mode !== "text") return null;
      if (flushCount < 2) {
        return {
          cacheKey: `text:${request.text}`,
          pending: true
        };
      }
      return {
        cacheKey: `text:${request.text}`,
        width: 400,
        height: 80,
        baselineY: 50,
        midLineY: 40,
        renderSourceText: request.text
      };
    },
    async flushPending() {
      flushCount += 1;
      return flushCount <= 2 ? [`pass:${flushCount}`] : [];
    },
    renderFromCache(cacheKey) {
      return {
        cacheKey,
        viewBox: { x: -200, y: -40, width: 400, height: 80 },
        body: `<text>Two pass async text</text>`
      };
    }
  };

  const result = await convertTikzToSvgAsync(String.raw`
\begin{tikzpicture}
  \node[draw, inner sep=0pt] {Two pass async text};
\end{tikzpicture}`, { margin: 0, textEngine, textEngineUnit: 100 });
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(flushCount >= 2, `expected at least two text-engine flushes, got ${flushCount}`);
  assert.ok(
    requests.some((request) => request.mode === "text" && request.flushCount >= 2),
    `expected a post-second-flush measurement request, got ${JSON.stringify(requests)}`
  );
  assert.ok(box, "expected node box");
  assert.ok(box.width > 3.9 && box.width < 4.1, `expected final measured width near 4cm, got ${box.width}`);
});

test("async conversion warns when text-engine pass limit is exhausted", async () => {
  const textEngine = {
    validate() {
      return null;
    },
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

  const result = await convertTikzToSvgAsync(String.raw`
\begin{tikzpicture}
  \node {Never stable};
\end{tikzpicture}`, { margin: 0, textEngine, textEngineUnit: 100, maxTextEnginePasses: 2 });

  assert.equal(result.ok, true);
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.severity === "warning" &&
        /Text engine measurement did not settle after 2 passes/.test(diagnostic.message)
    ),
    `expected exhausted text-engine warning, got ${JSON.stringify(result.diagnostics)}`
  );
});

test("cli adapter delegates IO through injected filesystem seam", async () => {
  const writes = new Map();
  const exitCode = await runCli(["input.tikz", "-o", "out.svg"], {
    stdout: { write() {} },
    stderr: {
      write(message) {
        throw new Error(message);
      }
    },
    filesystem: {
      async readTextFile(path) {
        assert.equal(path, "input.tikz");
        return String.raw`\draw (0,0) -- (1,0);`;
      },
      async writeTextFile(path, content) {
        writes.set(path, content);
      }
    }
  });

  assert.equal(exitCode, 0);
  assert.match(writes.get("out.svg"), /<svg/);
  assert.deepEqual(parseCliArgs(["foo.tikz", "--strict"]), {
    input: "foo.tikz",
    output: "foo.svg",
    strict: true,
    mathRenderer: undefined,
    unit: undefined,
    margin: undefined,
    help: false
  });
});

test("cli adapter awaits injected async conversion seam before writing SVG", async () => {
  let converterCalled = false;
  const writes = new Map();
  const exitCode = await runCli(["input.tikz", "-o", "out.svg", "--math-renderer", "svg-text"], {
    stdout: { write() {} },
    stderr: { write(message) { throw new Error(message); } },
    filesystem: {
      async readTextFile(path) {
        assert.equal(path, "input.tikz");
        return "\\node {Async CLI text};";
      },
      async writeTextFile(path, content) {
        writes.set(path, content);
      }
    },
    async convertTikzToSvg(source, options) {
      converterCalled = true;
      assert.equal(source, "\\node {Async CLI text};");
      assert.equal(options.mathRenderer, "svg-text");
      await Promise.resolve();
      return {
        ok: true,
        diagnostics: [],
        svg: "<svg><text>async cli payload</text></svg>"
      };
    }
  });

  assert.equal(exitCode, 0);
  assert.equal(converterCalled, true);
  assert.equal(writes.get("out.svg"), "<svg><text>async cli payload</text></svg>");
});
