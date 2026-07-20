import { basename } from "node:path";
import { createFilesystemAdapter } from "../adapters/filesystem.js";
import { tikzToSvgAsync } from "../index.js";

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
  const convertTikzToSvg = io.convertTikzToSvg || tikzToSvgAsync;
  const result = await convertTikzToSvg(source, {
    strict: parsed.strict,
    mathRenderer: parsed.mathRenderer,
    unit: parsed.unit,
    margin: parsed.margin
  });
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
  const mathRenderer = valueAfter(args, "--math-renderer") || (args.includes("--svg-text-math") ? "svg-text" : undefined);
  const unit = numericValueAfter(args, "--unit");
  const margin = numericValueAfter(args, "--margin");
  return {
    input,
    output,
    strict: args.includes("--strict"),
    mathRenderer,
    unit,
    margin,
    help: false
  };
}

export function usageText() {
  return [
    "Usage: tikz2svg input.tikz [-o output.svg] [--strict]",
    "       [--math-renderer svg-text] [--svg-text-math] [--unit pxPerCm] [--margin px]",
    ""
  ].join("\n");
}

function valueAfter(args, flag) {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function numericValueAfter(args, flag) {
  const value = valueAfter(args, flag);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
