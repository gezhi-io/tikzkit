#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { tikzToSvg } from "../src/index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    return;
  }

  const input = args[0];
  const outputIndex = args.findIndex((arg) => arg === "-o" || arg === "--output");
  const output = outputIndex >= 0 ? args[outputIndex + 1] : `${basename(input).replace(/\.[^.]+$/, "")}.svg`;
  const strict = args.includes("--strict");
  if (!input || !output) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const source = await readFile(input, "utf8");
  const result = tikzToSvg(source, { strict });
  const blocking = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error" || strict);
  if (blocking.length > 0) {
    for (const diagnostic of blocking) {
      process.stderr.write(`${diagnostic.message}\n`);
    }
    process.exitCode = 1;
    return;
  }

  for (const diagnostic of result.diagnostics) {
    process.stderr.write(`${diagnostic.severity}: ${diagnostic.message}\n`);
  }
  await writeFile(output, result.svg, "utf8");
}

function printUsage() {
  process.stdout.write("Usage: tikz2svg input.tikz [-o output.svg] [--strict]\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
