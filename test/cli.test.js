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
  assert.match(await readFile(out2, "utf8"), /stroke="green"/);
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
