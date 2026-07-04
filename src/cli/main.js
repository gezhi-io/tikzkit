import { basename } from "node:path";
import { createFilesystemAdapter } from "../adapters/filesystem.js";
import { tikzToSvg } from "../index.js";

export async function runCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const filesystem = createFilesystemAdapter(io.filesystem);
  const parsed = parseCliArgs(argv);

  if (parsed.help) {
    stdout.write(usageText());
    return 0;
  }
  if (!parsed.input || !parsed.output) {
    stdout.write(usageText());
    return 2;
  }

  const source = await filesystem.readTextFile(parsed.input, "utf8");
  const result = tikzToSvg(source, { strict: parsed.strict });
  const blocking = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error" || parsed.strict);
  if (blocking.length > 0) {
    for (const diagnostic of blocking) {
      stderr.write(`${diagnostic.message}\n`);
    }
    return 1;
  }

  for (const diagnostic of result.diagnostics) {
    stderr.write(`${diagnostic.severity}: ${diagnostic.message}\n`);
  }
  await filesystem.writeTextFile(parsed.output, result.svg, "utf8");
  return 0;
}

export function parseCliArgs(argv = []) {
  const args = [...argv];
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    return { help: true };
  }
  const input = args[0];
  const outputIndex = args.findIndex((arg) => arg === "-o" || arg === "--output");
  const output = outputIndex >= 0 ? args[outputIndex + 1] : input ? `${basename(input).replace(/\.[^.]+$/, "")}.svg` : null;
  return {
    input,
    output,
    strict: args.includes("--strict"),
    help: false
  };
}

export function usageText() {
  return "Usage: tikz2svg input.tikz [-o output.svg] [--strict]\n";
}
