import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("cli converts tikz and tex inputs to svg files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tikz2svg-"));
  const tikz = path.join(dir, "input.tikz");
  const tex = path.join(dir, "input.tex");
  const out1 = path.join(dir, "one.svg");
  const out2 = path.join(dir, "two.svg");

  await writeFile(tikz, String.raw`\draw (0,0) -- (1,0);`);
  await writeFile(tex, String.raw`
\documentclass{article}
\begin{document}
\begin{tikzpicture}
  \draw[green] (0,0) -- (0,1);
\end{tikzpicture}
\end{document}`);

  await execFileAsync(process.execPath, ["bin/tikz2svg.js", tikz, "-o", out1]);
  await execFileAsync(process.execPath, ["bin/tikz2svg.js", tex, "-o", out2]);

  assert.match(await readFile(out1, "utf8"), /<svg/);
  assert.match(await readFile(out2, "utf8"), /stroke="rgb\(0 255 0\)"/);
});

test("cli strict mode fails when unsupported syntax is diagnosed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tikz2svg-"));
  const tikz = path.join(dir, "bad.tikz");
  await writeFile(tikz, String.raw`\unknownthing (0,0);`);

  await assert.rejects(
    execFileAsync(process.execPath, ["bin/tikz2svg.js", tikz, "--strict"]),
    /Unsupported command/
  );
});

test("cli exposes SVG-text math and TeX unit controls for local visual QA", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tikz2svg-"));
  const tikz = path.join(dir, "math.tikz");
  const out = path.join(dir, "math.svg");

  await writeFile(tikz, String.raw`
\begin{tikzpicture}
  \draw (0,0) circle (1cm);
  \node at (0,0) {$\alpha$};
\end{tikzpicture}`);

  await execFileAsync(process.execPath, [
    "bin/tikz2svg.js",
    tikz,
    "-o",
    out,
    "--math-renderer",
    "svg-text",
    "--unit",
    "28.4527559",
    "--margin",
    "0"
  ]);

  const svg = await readFile(out, "utf8");
  assert.match(svg, /<text[^>]+>α<\/text>/);
  assert.doesNotMatch(svg, /foreignObject/);
  assert.match(svg, /font-size="10"/);
  assert.match(svg, /stroke-width="0\.4"/);
  assert.match(svg, /width="57\.09pt" height="57\.09pt"/);
  assert.match(svg, /viewBox="-28\.652756 -28\.652756 57\.305512 57\.305512"/);
});
