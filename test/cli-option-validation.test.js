import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseCliArgs, runCli } from "../src/cli/index.js";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/tikz2svg.js", import.meta.url));

test("invalid CLI options fail before reading, converting, or writing", async () => {
  const invalid = [
    ["input.tex", "-o"], ["input.tex", "-o", "--strict"],
    ["input.tex", "--output="], ["input.tex", "--unknown"],
    ["input.tex", "extra.tex"], ["--strict"],
    ["input.tex", "--unit"], ["input.tex", "--unit", "--strict"],
    ["input.tex", "--unit", "-1"], ["input.tex", "--unit", "0"],
    ["input.tex", "--unit", "NaN"], ["input.tex", "--unit", "Infinity"],
    ["input.tex", "--unit", "abc"], ["input.tex", "--unit="],
    ["input.tex", "--margin", "-1"], ["input.tex", "--margin", "Infinity"],
    ["input.tex", "--margin", "abc"], ["input.tex", "--margin"],
    ["input.tex", "--math-renderer"], ["input.tex", "--math-renderer", "other"],
    ["input.tex", "--strict=false"]
  ];
  for (const args of invalid) {
    const stderr = [];
    const unexpected = () => assert.fail(`unexpected IO/conversion for ${args.join(" ")}`);
    const exitCode = await runCli(args, {
      stdout: { write() {} }, stderr: { write: (message) => stderr.push(message) },
      filesystem: { readTextFile: unexpected, writeTextFile: unexpected },
      convertTikzToSvg: unexpected
    });
    assert.equal(exitCode, 2, args.join(" "));
    assert.ok(stderr.length > 0, args.join(" "));
  }
});

test("CLI accepts option order, explicit numeric domains, and equals syntax", () => {
  assert.deepEqual(parseCliArgs(["--strict", "--unit=28.45", "--margin", "0", "--math-renderer=katex", "-o", "out.svg", "input.tex"]), {
    input: "input.tex", output: "out.svg", strict: true,
    unit: 28.45, margin: 0, mathRenderer: "katex", help: false
  });
  assert.equal(parseCliArgs(["--svg-text-math", "input.tex"]).mathRenderer, "svg-text");
  assert.equal(parseCliArgs(["--", "-diagram.tex"]).input, "-diagram.tex");
  assert.equal(parseCliArgs(["input.tex", "--unit", "1e2"]).unit, 100);
});

test("CLI help succeeds without filesystem access", async () => {
  for (const args of [[], ["--help"], ["-h"]]) {
    const output = [];
    assert.equal(await runCli(args, { stdout: { write: (message) => output.push(message) } }), 0);
    assert.match(output.join(""), /Usage:/);
  }
});

test("CLI process rejects missing output and negative units without output writes", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "tikzkit-cli-validation-"));
  await writeFile(path.join(cwd, "input.tex"), String.raw`\node {Hello};`);
  await writeFile(path.join(cwd, "existing.svg"), "keep existing output");
  for (const args of [["input.tex", "-o", "--strict"], ["input.tex", "-o", "existing.svg", "--unit", "-1"]]) {
    await assert.rejects(execFileAsync(process.execPath, [cli, ...args], { cwd }), (error) => {
      assert.equal(error.code, 2);
      assert.ok(error.stderr.length > 0);
      return true;
    });
  }
  assert.deepEqual((await readdir(cwd)).sort(), ["existing.svg", "input.tex"]);
  assert.equal(await readFile(path.join(cwd, "existing.svg"), "utf8"), "keep existing output");
});
