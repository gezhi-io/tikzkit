import { basename } from "node:path";
import { parseArgs } from "node:util";
import { createFilesystemAdapter } from "../adapters/filesystem.js";
import { tikzToSvgAsync } from "../index.js";

export async function runCli(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const filesystem = createFilesystemAdapter(io.filesystem);
  let parsed;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    stderr.write(`${error.message}\n${usageText()}`);
    return 2;
  }

  if (parsed.help) {
    stdout.write(usageText());
    return 0;
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
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      output: { type: "string", short: "o" },
      strict: { type: "boolean" },
      "math-renderer": { type: "string" },
      "svg-text-math": { type: "boolean" },
      unit: { type: "string" },
      margin: { type: "string" }
    }
  });
  if (argv.length === 0 || values.help) return { help: true };
  if (positionals.length !== 1) throw new TypeError("Expected exactly one input file.");
  const input = positionals[0];
  if (!input) throw new TypeError("Input file must not be empty.");
  const output = values.output ?? `${basename(input).replace(/\.[^.]+$/, "")}.svg`;
  if (!output) throw new TypeError("--output requires a non-empty file name.");
  const mathRenderer = values["math-renderer"] ?? (values["svg-text-math"] ? "svg-text" : undefined);
  if (mathRenderer !== undefined && !["katex", "svg-text"].includes(mathRenderer)) {
    throw new TypeError("--math-renderer must be katex or svg-text.");
  }
  const unit = numericOption(values.unit, "--unit", true);
  const margin = numericOption(values.margin, "--margin", false);
  return {
    input,
    output,
    strict: Boolean(values.strict),
    mathRenderer,
    unit,
    margin,
    help: false
  };
}

export function usageText() {
  return [
    "Usage: tikz2svg input.tikz [-o output.svg] [--strict]",
    "       [--math-renderer katex|svg-text] [--svg-text-math] [--unit pxPerCm] [--margin px]",
    ""
  ].join("\n");
}

function numericOption(value, flag, positive) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || (positive ? parsed <= 0 : parsed < 0)) {
    throw new TypeError(`${flag} must be a finite ${positive ? "positive" : "non-negative"} number.`);
  }
  return parsed;
}
