import { evaluateMath, parseDimension, roundNumber } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";

const BEGIN_BCHART = String.raw`\begin{bchart}`;
const END_BCHART = String.raw`\end{bchart}`;
const BAR_HEIGHT = 0.5;
const INITIAL_BAR_TOP = -0.25;
const TICK_LENGTH = 0.1;

export const bchartExtension = {
  name: "bchart",
  phase: "preprocess",
  description: "Expands bchart horizontal bar charts into ordinary TikZ bars, labels, axes, and ticks.",
  commands: ["bchart", "bcbar", "bclabel", "bcskip", "smallskip", "medskip", "bigskip", "bcxlabel"],
  preprocess(source, context = {}) {
    return expandBchart(source, context.diagnostics || []);
  }
};

export function expandBchart(source, diagnostics = []) {
  const text = String(source);
  if (!text.includes(BEGIN_BCHART)) return text;

  let output = "";
  let cursor = 0;
  while (cursor < text.length) {
    const begin = text.indexOf(BEGIN_BCHART, cursor);
    if (begin === -1) {
      output += text.slice(cursor);
      break;
    }
    output += text.slice(cursor, begin);
    const environment = readBchartEnvironment(text, begin, diagnostics);
    if (!environment) {
      output += text.slice(begin);
      break;
    }
    output += renderBchart(environment.options, environment.body, diagnostics);
    cursor = environment.end;
  }
  return output;
}

function readBchartEnvironment(source, begin, diagnostics) {
  let cursor = skipWhitespace(source, begin + BEGIN_BCHART.length);
  let options = "";
  if (source[cursor] === "[") {
    const optional = readBalanced(source, cursor, "[", "]");
    if (!optional) {
      diagnostics.push(bchartDiagnostic("Malformed bchart environment options"));
      return null;
    }
    options = optional.content;
    cursor = optional.end;
  }

  const close = findBchartEnd(source, cursor);
  if (!close) {
    diagnostics.push(bchartDiagnostic("Missing \\end{bchart}"));
    return null;
  }
  return {
    options,
    body: source.slice(cursor, close.start),
    end: close.end
  };
}

function findBchartEnd(source, bodyStart) {
  let depth = 1;
  let cursor = bodyStart;
  while (cursor < source.length) {
    const nextBegin = source.indexOf(BEGIN_BCHART, cursor);
    const nextEnd = source.indexOf(END_BCHART, cursor);
    if (nextEnd === -1) return null;
    if (nextBegin !== -1 && nextBegin < nextEnd) {
      depth += 1;
      cursor = nextBegin + BEGIN_BCHART.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return { start: nextEnd, end: nextEnd + END_BCHART.length };
    cursor = nextEnd + END_BCHART.length;
  }
  return null;
}

function renderBchart(rawOptions, body, diagnostics) {
  const chart = chartOptions(rawOptions, diagnostics);
  const state = {
    position: INITIAL_BAR_TOP,
    xLabel: "",
    lines: []
  };
  const passthrough = expandBchartBody(body, chart, state, diagnostics).trim();
  if (passthrough) state.lines.push(passthrough);

  state.position -= BAR_HEIGHT / 2;
  const axisY = state.position;
  state.lines.push(`\\draw (0,${fmt(axisY)}) -- (${fmt(chart.width)},${fmt(axisY)});`);
  state.lines.push(`\\draw (0,0) -- (0,${fmt(axisY)});`);
  renderScale(chart, state, axisY, diagnostics);

  return [
    `\\begin{tikzpicture}[scale=${fmt(chart.scale)},font=\\sffamily]`,
    ...state.lines,
    String.raw`\end{tikzpicture}`
  ].join("\n");
}

function chartOptions(rawOptions, diagnostics) {
  const options = parseOptions(rawOptions);
  const min = numericOption(options.min, 0, diagnostics, "min");
  const max = numericOption(options.max, 100, diagnostics, "max");
  let range = max - min;
  if (!Number.isFinite(range) || Math.abs(range) < 1e-12) {
    diagnostics.push(bchartDiagnostic("bchart max must differ from min"));
    range = 1;
  }
  return {
    unit: optionText(options.unit, ""),
    width: dimensionOption(options.width, 8, diagnostics, "width"),
    min,
    max,
    range,
    step: numericOption(options.step, range, diagnostics, "step"),
    steps: Object.hasOwn(options, "steps") ? optionText(options.steps, "") : null,
    scale: numericOption(options.scale, 1, diagnostics, "scale"),
    plain: Object.hasOwn(options, "plain")
  };
}

function expandBchartBody(body, chart, state, diagnostics) {
  let passthrough = "";
  let cursor = 0;
  while (cursor < body.length) {
    if (body[cursor] !== "\\") {
      passthrough += body[cursor];
      cursor += 1;
      continue;
    }

    const command = readCommand(body, cursor);
    if (!command || !bchartExtension.commands.includes(command.name) || command.name === "bchart") {
      passthrough += command ? body.slice(cursor, command.end) : body[cursor];
      cursor = command?.end ?? cursor + 1;
      continue;
    }

    const expanded = expandBchartCommand(body, command, chart, state, diagnostics);
    if (!expanded) {
      passthrough += body.slice(cursor, command.end);
      cursor = command.end;
      continue;
    }
    cursor = expanded.end;
  }
  return passthrough;
}

function expandBchartCommand(source, command, chart, state, diagnostics) {
  let cursor = skipWhitespace(source, command.end);
  let optional = null;
  if (source[cursor] === "[") {
    optional = readBalanced(source, cursor, "[", "]");
    if (!optional) {
      diagnostics.push(bchartDiagnostic(`Malformed \\${command.name} options`));
      return { end: cursor + 1 };
    }
    cursor = skipWhitespace(source, optional.end);
  }

  if (["smallskip", "medskip", "bigskip"].includes(command.name)) {
    const heights = { smallskip: 0.25, medskip: 0.5, bigskip: 0.75 };
    renderSkip(optional?.content || "", heights[command.name], state);
    return { end: cursor };
  }

  const argument = readBalanced(source, cursor, "{", "}");
  if (!argument) {
    diagnostics.push(bchartDiagnostic(`Malformed \\${command.name} command`));
    return { end: cursor };
  }

  if (command.name === "bcbar") renderBar(optional?.content || "", argument.content, chart, state, diagnostics);
  if (command.name === "bclabel") renderLabel(argument.content, state);
  if (command.name === "bcskip") {
    const height = dimensionValue(argument.content, 0, diagnostics, "bcskip");
    renderSkip(optional?.content || "", height, state);
  }
  if (command.name === "bcxlabel") state.xLabel = argument.content;
  return { end: argument.end };
}

function renderBar(rawOptions, rawValue, chart, state, diagnostics) {
  const options = parseOptions(rawOptions);
  const valueText = rawValue.trim();
  const value = numericOption(valueText, 0, diagnostics, "bcbar value");
  const width = ((value - chart.min) * chart.width) / chart.range;
  const top = state.position;
  const bottom = top - BAR_HEIGHT;
  const middle = top - BAR_HEIGHT / 2;
  const color = optionText(options.color, "blue!20");
  const text = optionText(options.text, "");
  const label = optionText(options.label, "");
  const displayedValue = Object.hasOwn(options, "value") ? optionText(options.value, "") : `${valueText}${chart.unit}`;

  state.lines.push(
    `\\filldraw[fill=${color},draw=black] (0,${fmt(top)}) rectangle (${fmt(width)},${fmt(bottom)});`
  );
  if (!Object.hasOwn(options, "plain")) {
    state.lines.push(`\\node[anchor=west] at (${fmt(width)},${fmt(middle)}) {${displayedValue}};`);
  }
  state.lines.push(`\\node[anchor=west] at (0,${fmt(middle)}) {${text}};`);
  state.lines.push(`\\node[anchor=east] at (0,${fmt(middle)}) {${label}};`);
  state.position -= BAR_HEIGHT;
}

function renderLabel(text, state) {
  state.lines.push(`\\node[anchor=east] at (0,${fmt(state.position)}) {${text}};`);
}

function renderSkip(rawOptions, height, state) {
  const options = parseOptions(rawOptions);
  const label = optionText(options.label, "");
  state.lines.push(`\\node[anchor=east] at (0,${fmt(state.position - height / 2)}) {${label}};`);
  state.position -= height;
}

function renderScale(chart, state, axisY, diagnostics) {
  if (chart.plain) {
    renderXLabel(chart, state, axisY - 0.2);
    return;
  }

  const tickY = axisY - TICK_LENGTH;
  state.lines.push(`\\draw (0,${fmt(axisY)}) -- (0,${fmt(tickY)});`);
  state.lines.push(`\\node[anchor=north] at (0,${fmt(tickY)}) {${fmt(chart.min)}${chart.unit}};`);

  for (const offset of stepValues(chart, diagnostics)) {
    if (Math.abs(offset) < 1e-12) continue;
    const x = (offset * chart.width) / chart.range;
    state.lines.push(`\\draw (${fmt(x)},${fmt(axisY)}) -- (${fmt(x)},${fmt(tickY)});`);
    state.lines.push(`\\node[anchor=north] at (${fmt(x)},${fmt(tickY)}) {${fmt(chart.min + offset)}${chart.unit}};`);
  }
  renderXLabel(chart, state, axisY - 0.5);
}

function renderXLabel(chart, state, labelY) {
  if (!state.xLabel.trim()) return;
  state.lines.push(
    `\\node[anchor=north,inner sep=0.5mm] at (${fmt(chart.width / 2)},${fmt(labelY)}) {${state.xLabel}};`
  );
}

function stepValues(chart, diagnostics) {
  if (chart.steps !== null) return explicitStepValues(chart.steps, diagnostics);
  if (Math.abs(chart.step) < 1e-12) {
    diagnostics.push(bchartDiagnostic("bchart step must be non-zero"));
    return [0];
  }
  return arithmeticSequence(0, chart.step, chart.range);
}

function explicitStepValues(rawSteps, diagnostics) {
  const parts = splitTopLevel(rawSteps, ",").map((part) => part.trim()).filter(Boolean);
  const ellipsis = parts.indexOf("...");
  if (ellipsis === -1) return parts.map((part) => numericOption(part, 0, diagnostics, "steps"));
  if (ellipsis < 2 || ellipsis + 1 >= parts.length) {
    diagnostics.push(bchartDiagnostic("bchart steps ellipsis requires two starting values and an end value"));
    return parts.filter((part) => part !== "...").map((part) => numericOption(part, 0, diagnostics, "steps"));
  }

  const prefix = parts.slice(0, ellipsis).map((part) => numericOption(part, 0, diagnostics, "steps"));
  const end = numericOption(parts[ellipsis + 1], prefix.at(-1), diagnostics, "steps");
  const delta = prefix.at(-1) - prefix.at(-2);
  if (Math.abs(delta) < 1e-12) {
    diagnostics.push(bchartDiagnostic("bchart steps progression must be non-zero"));
    return prefix;
  }
  const generated = arithmeticSequence(prefix.at(-1) + delta, delta, end);
  const trailing = parts.slice(ellipsis + 2).map((part) => numericOption(part, 0, diagnostics, "steps"));
  return [...prefix, ...generated, ...trailing];
}

function arithmeticSequence(start, step, end) {
  const values = [];
  const increasing = step > 0;
  for (let value = start, count = 0; count < 10000; value += step, count += 1) {
    if (increasing ? value > end + 1e-9 : value < end - 1e-9) break;
    values.push(roundNumber(value, 12));
  }
  return values;
}

function numericOption(value, fallback, diagnostics, name) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value).trim();
  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;
  if (/^[0-9+\-*/%().,\spiqrtabnexlgom]+$/i.test(text)) {
    const evaluated = evaluateMath(text);
    if (Number.isFinite(evaluated)) return evaluated;
  }
  diagnostics.push(bchartDiagnostic(`Invalid bchart ${name}: ${text}`));
  return fallback;
}

function dimensionOption(value, fallback, diagnostics, name) {
  if (value === undefined || value === null || value === "") return fallback;
  return dimensionValue(value, fallback, diagnostics, name);
}

function dimensionValue(value, fallback, diagnostics, name) {
  const text = String(value).trim();
  if (!/^[{}0-9+\-*/%().,\sa-zA-Z]+$/.test(text)) {
    diagnostics.push(bchartDiagnostic(`Invalid bchart ${name}: ${text}`));
    return fallback;
  }
  const parsed = parseDimension(text, {});
  if (Number.isFinite(parsed)) return parsed;
  diagnostics.push(bchartDiagnostic(`Invalid bchart ${name}: ${text}`));
  return fallback;
}

function optionText(value, fallback) {
  if (value === undefined || value === null || value === true) return fallback;
  return String(value).trim();
}

function readCommand(source, start) {
  const match = source.slice(start).match(/^\\([A-Za-z@]+)/);
  if (!match) return null;
  return { name: match[1], end: start + match[0].length };
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, start) {
  let cursor = start;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function bchartDiagnostic(message) {
  return { severity: "warning", message };
}

function fmt(value) {
  return String(roundNumber(value, 6));
}
