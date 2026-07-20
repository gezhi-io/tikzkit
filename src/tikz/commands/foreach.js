import { evaluateMath, roundNumber } from "../../engine/math.js";
import { splitTopLevel, stripOuterBraces } from "../../engine/options.js";

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
  const expanded = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = String(values[index] || "").trim();
    const variableMatch = value.match(/^\\?([A-Za-z@]+)$/);
    if (variableMatch && Object.hasOwn(env.variables || {}, variableMatch[1])) {
      const variableValue = String(env.variables[variableMatch[1]] ?? "").trim();
      expanded.push(...splitTopLevel(variableValue, ",").map((part) => part.trim()).filter(Boolean));
    } else if (value === "..." && expanded.length > 0 && index < values.length - 1) {
      const previous = Number(expanded.at(-1));
      const beforePrevious = Number(expanded.at(-2));
      const end = evaluateMath(values[index + 1], env.variables || {});
      const step = Number.isFinite(beforePrevious) ? previous - beforePrevious : 1;
      for (let current = previous + step; step >= 0 ? current <= end : current >= end; current += step) {
        expanded.push(String(roundNumber(current)));
      }
      index += 1;
    } else {
      expanded.push(value);
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
  const start = match[2] ? evaluateMath(match[2], { ...(env.variables || {}), ...variables }) : 1;
  variables[match[1]] = roundNumber((Number.isFinite(start) ? start : 1) + foreachIndex);
}

function applyForeachEvaluateOption(variables, spec, env) {
  if (spec === undefined || spec === null || spec === false) return;
  const text = stripOuterBraces(String(spec === true ? "" : spec)).trim();
  const match = text.match(/^\\?([A-Za-z@]+)\s+as\s+\\?([A-Za-z@]+)\s+using\s+\{?([\s\S]*?)\}?$/);
  if (!match) return;
  const expression = match[3].trim();
  variables[match[2]] = roundNumber(evaluateMath(expression, { ...(env.variables || {}), ...variables }));
}
