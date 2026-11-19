import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { tikzToSvgAsync } from "../src/index.js";

const execFileAsync = promisify(execFile);

test("CLI resolves plot tables relative to its input, not the caller, and leaves missing files unresolved", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tikz2svg-tables-"));
  const root = path.join(dir, "project");
  await mkdir(path.join(root, "data"), { recursive: true });
  const csv = "time,count\n0,10\n1,17\n2,11\n";
  await writeFile(path.join(root, "data", "series.csv"), csv);
  await writeFile(path.join(dir, "private.csv"), csv);
  await symlink(path.join(dir, "private.csv"), path.join(root, "escape.csv"));
  const input = path.join(root, "plot.tex");
  const output = path.join(dir, "result.svg");
  const render = () => execFileAsync(process.execPath, [path.resolve("bin/tikz2svg.js"), input, "--strict", "-o", output], { cwd: dir });
  const source = "\\begin{tikzpicture}\\begin{axis}\\addplot table[x=time,y=count,col sep=comma] {data/series.csv};\\end{axis}\\end{tikzpicture}";
  await writeFile(input, source);
  await render();
  const expected = await tikzToSvgAsync(source, { pgfplotsTableResolver: () => csv });
  assert.ok(expected.ir.items.some((item) => item.subtype === "axis-plot"));
  assert.equal(await readFile(output, "utf8"), expected.svg);
  for (const name of ["missing.csv", "../private.csv", "escape.csv"]) {
    await writeFile(input, source.replace("data/series.csv", name));
    await assert.rejects(render, /Could not resolve pgfplots table file/);
  }
});

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
  const dimensions = svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/).slice(1).map(Number);
  const diameterPt = (2 * 72.27 / 2.54 + .4) * 72 / 72.27;
  for (const dimension of dimensions) assert.ok(Math.abs(dimension - diameterPt) < 1e-5);
  assert.match(svg, /viewBox="-28\.652756 -28\.652756 57\.305512 57\.305512"/);
});
