import { evaluateMath, roundNumber } from "../../engine/math.js";
import { splitTopLevel, stripOuterBraces } from "../../engine/options.js";

export const FOREACH_EXPANSION_LIMIT = 10000;
const FOREACH_CHARACTER_LIMIT = 1000000;

export class ForeachExpansionError extends Error {
  constructor(code, message, expression) {
    super(message);
    this.name = "ForeachExpansionError";
    this.code = code;
    this.diagnostic = { severity: "error", code, message, expression: String(expression) };
  }
}

export function createForeachBudget({ maxIterations = FOREACH_EXPANSION_LIMIT, maxCharacters = FOREACH_CHARACTER_LIMIT } = {}) {
  return {
    remainingIterations: Number.isSafeInteger(maxIterations) && maxIterations >= 0 ? Math.min(maxIterations, FOREACH_EXPANSION_LIMIT) : FOREACH_EXPANSION_LIMIT,
    remainingCharacters: Number.isSafeInteger(maxCharacters) && maxCharacters >= 0 ? Math.min(maxCharacters, FOREACH_CHARACTER_LIMIT) : FOREACH_CHARACTER_LIMIT
  };
}

export const tikzCommand = {
  name: "foreach",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/frontend/parser.js:parseForeachStatement",
    "src/frontend/latex-shell.js:expandForeachBlocks",
    "src/tikz/commands/foreach.js:foreachIterationVariables",
    "src/engine/evaluate.js:interpretStatement"
  ],
  optionScope: "macro",
  options: [
    {
      name: "\\foreach \\x in {...} { ... }",
      category: "loop",
      status: "implemented",
      implementedBy: "src/frontend/parser.js + src/tikz/commands/foreach.js",
      notes: "Basic list loops and nested statement interpretation are supported."
    },
    {
      name: "count=\\i from 0",
      category: "loop option",
      status: "partial",
      implementedBy: "src/frontend/parser.js + src/tikz/commands/foreach.js:applyForeachOptions",
      notes: "Count variables are supported for common gallery and corpus cases."
    },
    {
      name: "evaluate=\\x as \\y using ...",
      category: "loop option",
      status: "partial",
      implementedBy: "src/tikz/commands/foreach.js:applyForeachOptions",
      notes: "Practical PGF math evaluation slices are implemented, not the full TeX macro system."
    }
  ],
  examples: [
    String.raw`\foreach \x in {0,1,2} { \draw (\x,0) -- (\x,1); }`
  ]
};

export function foreachIterationVariables(statement, env = { variables: {} }) {
  const iterations = [];
  let foreachIndex = 0;
  for (const values of expandForeachValues(statement.values || [], env)) {
    const variables = { ...(env.variables || {}) };
    const valueText = stripOuterBraces(String(values || "").trim());
    const rawParts = splitTopLevel(valueText, "/").map((part) => stripOuterBraces(part.trim()));
    for (const [index, name] of (statement.variables || []).entries()) {
      variables[name] = rawParts[index] ?? String(values || "").trim();
    }
    applyForeachOptions(variables, statement.options || {}, foreachIndex, env);
    iterations.push({ values, variables, index: foreachIndex });
    foreachIndex += 1;
  }
  return iterations;
}

export function expandForeachValues(values, env = { variables: {} }) {
  // The parent initializes this once per conversion; shallow child environments
  // retain the same object, so nested and sibling loops consume one allowance.
  const budget = env.foreachBudget ||= createForeachBudget();
  const expanded = [];
  const append = (value) => {
    if (!(budget.remainingIterations >= 1) || !(budget.remainingCharacters >= value.length)) {
      throw new ForeachExpansionError("foreach-expansion-limit", "Foreach expansion exceeds the shared work/output limit.", value);
    }
    budget.remainingIterations -= 1;
    budget.remainingCharacters -= value.length;
    expanded.push(value);
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = String(values[index] ?? "").trim();
    const variableMatch = value.match(/^\\?([A-Za-z@]+)$/);
    if (variableMatch && Object.hasOwn(env.variables || {}, variableMatch[1])) {
      const variableValue = String(env.variables[variableMatch[1]] ?? "").trim();
      if (variableValue.length > budget.remainingCharacters) {
        throw new ForeachExpansionError("foreach-expansion-limit", "Foreach list exceeds the shared output limit.", value);
      }
      for (const part of splitTopLevel(variableValue, ",")) {
        if (part.trim()) append(part.trim());
      }
    } else if (value === "..." && expanded.length > 0 && index < values.length - 1) {
      const previous = Number(expanded.at(-1));
      const beforePrevious = Number(expanded.at(-2));
      const end = evaluateMath(values[index + 1], env.variables || {}, { throwOnError: true });
      const step = Number.isFinite(beforePrevious) ? previous - beforePrevious : end >= previous ? 1 : -1;
      const range = `${expanded.at(-2) ?? ""},${expanded.at(-1)},...,${values[index + 1]}`;
      if (![previous, end, step].every(Number.isFinite)) {
        throw new ForeachExpansionError("foreach-nonfinite-range", "Foreach range requires finite numeric bounds and step.", range);
      }
      if (step === 0 || previous + step === previous) {
        throw new ForeachExpansionError("foreach-nonprogressing-range", "Foreach range step must make numeric progress.", range);
      }
      const distance = (end - previous) / step;
      const count = Math.max(0, Math.floor(distance + 1e-10));
      if (!Number.isFinite(count) || count > budget.remainingIterations) {
        throw new ForeachExpansionError("foreach-expansion-limit", "Foreach range exceeds the shared iteration limit.", range);
      }
      let last = previous;
      for (let offset = 1; offset <= count; offset += 1) {
        const current = previous + step * offset;
        if (!Number.isFinite(current) || current === last) {
          throw new ForeachExpansionError("foreach-nonprogressing-range", "Foreach range no longer makes finite numeric progress.", range);
        }
        append(String(roundNumber(current)));
        last = current;
      }
      index += 1;
    } else {
      append(value);
    }
  }
  return expanded;
}

export function applyForeachOptions(variables, options = {}, foreachIndex = 0, env = { variables: {} }) {
  applyForeachCountOption(variables, options.count, foreachIndex, env);
  const evaluateOptions = Array.isArray(options.evaluate) ? options.evaluate : options.evaluate !== undefined ? [options.evaluate] : [];
  for (const spec of evaluateOptions) applyForeachEvaluateOption(variables, spec, env);
}

function applyForeachCountOption(variables, spec, foreachIndex, env) {
  if (spec === undefined || spec === null || spec === false) return;
  const text = stripOuterBraces(String(spec === true ? "" : spec)).trim();
  const match = text.match(/^\\?([A-Za-z@]+)(?:\s+(?:starting\s+from|from)\s+([\s\S]+))?$/);
  if (!match) return;
  const start = match[2] ? evaluateMath(match[2], { ...(env.variables || {}), ...variables }, { throwOnError: true }) : 1;
  variables[match[1]] = roundNumber(start + foreachIndex);
}

function applyForeachEvaluateOption(variables, spec, env) {
  if (spec === undefined || spec === null || spec === false) return;
  const text = stripOuterBraces(String(spec === true ? "" : spec)).trim();
  const match = text.match(/^\\?([A-Za-z@]+)\s+as\s+\\?([A-Za-z@]+)\s+using\s+\{?([\s\S]*?)\}?$/);
  if (!match) return;
  const expression = match[3].trim();
  variables[match[2]] = roundNumber(evaluateMath(expression, { ...(env.variables || {}), ...variables }, { throwOnError: true }));
}
