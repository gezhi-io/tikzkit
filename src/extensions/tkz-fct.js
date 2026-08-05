import { parseOptions } from "../engine/options.js";
import { evaluateAxisExpression } from "../pgfplots/expressions.js";

const IMPLEMENTED_COMMANDS = ["tkzInit", "tkzGrid", "tkzAxeXY", "tkzFct"];
const COMMANDS = new Set(IMPLEMENTED_COMMANDS);
const TEX_PT_PER_CM = 28.4527559;
const TKZ_LABEL_DISTANCE_PT = 3;
const TKZ_LABEL_INNER_SEP_PT = 1;
const CMR7_DIGIT_HEIGHT_PT = 4.48;

export const tkzFctExtension = {
  name: "tkz-fct",
  phase: "preprocess",
  description: "Lowers the tkz-base Cartesian frame and sampled tkz-fct function plots into ordinary TikZ.",
  commands: IMPLEMENTED_COMMANDS,
  preprocess(source) {
    return expandTkzFct(source);
  }
};

export function expandTkzFct(source) {
  const text = String(source || "")
    .replace(/\\begin\{scriptsize\}/g, "\\begin{scope}[font=\\scriptsize]")
    .replace(/\\end\{scriptsize\}/g, "\\end{scope}");
  if (!usesTkzFct(text)) return text;

  const state = createState();
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] !== "\\") {
      output += text[index];
      index += 1;
      continue;
    }
    const command = readCommandName(text, index + 1);
    if (!command || !COMMANDS.has(command.value)) {
      output += command ? text.slice(index, command.end) : text[index];
      index = command ? command.end : index + 1;
      continue;
    }

    const optional = parseOptionalArg(text, command.end);
    if (command.value === "tkzInit") {
      applyInitOptions(state, optional.content);
      index = optional.end;
      continue;
    }
    if (command.value === "tkzGrid") {
      output += renderGrid(state, optional.content);
      index = optional.end;
      continue;
    }
    if (command.value === "tkzFct") {
      const expression = parseRequiredArg(text, optional.end);
      if (!expression) {
        output += text.slice(index, optional.end);
        index = optional.end;
        continue;
      }
      output += renderFunction(state, optional.content, expression.content);
      index = expression.end;
      continue;
    }
    output += renderAxes(state, optional.content, {
      scriptsize: insideScriptsizeScope(text, index)
    });
    index = optional.end;
  }
  return output;
}

function usesTkzFct(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{[^{}]*\btkz-fct\b[^{}]*\}|\\tkz(?:Init|Grid|AxeXY|Fct)\b/.test(source);
}

function createState() {
  return {
    xmin: 0,
    xmax: 10,
    xstep: 1,
    ymin: 0,
    ymax: 10,
    ystep: 1
  };
}

function applyInitOptions(state, rawOptions) {
  const options = parseOptions(rawOptions);
  for (const key of ["xmin", "xmax", "xstep", "ymin", "ymax", "ystep"]) {
    const value = Number(options[key]);
    if (Number.isFinite(value) && (key !== "xstep" && key !== "ystep" || value !== 0)) state[key] = value;
  }
}

function renderGrid(state, rawOptions) {
  const options = parseOptions(rawOptions);
  const color = optionText(options.color, "gray");
  const lineWidth = optionText(options["line width"], "0.4pt");
  const bounds = normalizedBounds(state);
  return `\\draw[color=${color},line width=${lineWidth},step=1cm] (${format(bounds.xmin)},${format(bounds.ymin)}) grid (${format(bounds.xmax)},${format(bounds.ymax)});`;
}

function renderAxes(state, rawOptions, context = {}) {
  const options = parseOptions(rawOptions);
  const color = optionText(options.color, "black");
  const textColor = optionText(options.text, color);
  const lineWidth = optionText(options["line width"], "0.4pt");
  const tickWidth = optionText(options.tickwd, "0.8pt");
  const tickUp = optionText(options.tickup, "2pt");
  const tickDown = optionText(options.tickdn, "2pt");
  const tickLeft = optionText(options.ticklt, "2pt");
  const tickRight = optionText(options.tickrt, "2pt");
  const rightSpace = optionNumber(options["right space"], 0.5);
  const leftSpace = optionNumber(options["left space"], 0);
  const upSpace = optionNumber(options["up space"], 0.5);
  const downSpace = optionNumber(options["down space"], 0);
  const bounds = normalizedBounds(state);
  const hideTicks = options.noticks === true || String(options.ticks || "").trim().toLowerCase() === "false";
  const showOrigin = options.orig === undefined || optionBoolean(options.orig, true);
  const sharedLabel = options.label === undefined ? null : optionText(options.label, "");
  const xAxisLabel = sharedLabel === null ? "$x$" : sharedLabel;
  const yAxisLabel = sharedLabel === null ? "$y$" : sharedLabel;
  const textOption = textColor === color ? "" : `,text=${textColor}`;
  const xLabelOverlay = context.scriptsize ? "overlay," : "";
  const xLabelOptions = `${xLabelOverlay}below=3pt,inner sep=1pt,outer sep=0pt,fill=white${textOption}`;
  const yLabelOptions = `left=3pt,inner sep=1pt,outer sep=0pt,fill=white${textOption}`;

  const drawX = [
    `\\draw[color=${color},line width=${lineWidth},-latex${textOption}] (${format(bounds.xmin - leftSpace)},0) -- (${format(bounds.xmax + rightSpace)},0) node[below=3pt,inner sep=1pt,outer sep=0pt] {${xAxisLabel}};`
  ];
  const drawY = [
    `\\draw[color=${color},line width=${lineWidth},-latex${textOption}] (0,${format(bounds.ymin - downSpace)}) -- (0,${format(bounds.ymax + upSpace)}) node[left=3pt,inner sep=1pt,outer sep=0pt] {${yAxisLabel}};`
  ];

  if (!hideTicks) {
    for (const position of integerPositions(bounds.xmin, bounds.xmax)) {
      drawX.push(
        `\\draw[color=${color},line width=${tickWidth}] (${format(position)},${tickUp}) -- (${format(position)},${negateLength(tickDown)});`
      );
    }
    for (const position of integerPositions(bounds.ymin, bounds.ymax)) {
      drawY.push(
        `\\draw[color=${color},line width=${tickWidth}] (${tickRight},${format(position)}) -- (${negateLength(tickLeft)},${format(position)});`
      );
    }
  }

  const labelX = [];
  for (const position of integerPositions(bounds.xmin, bounds.xmax)) {
    if (!showOrigin && Math.abs(position) < 1e-9) continue;
    const label = format(position * state.xstep);
    labelX.push(
      `\\path (${format(position)},${tickUp}) -- (${format(position)},${negateLength(tickDown)}) node[${xLabelOptions}] {$${label}$};`
    );
  }
  if (context.scriptsize && labelX.length) {
    // TikZ positions the label below the lower tick endpoint.  The browser
    // renderer's generic node minimum is taller than the CMR7 TeX box, so the
    // visible labels are overlays and this source-derived TeX extent owns bbox.
    const tickLabelBottomPt =
      lengthToPoints(tickDown, 2, 7) +
      TKZ_LABEL_DISTANCE_PT +
      TKZ_LABEL_INNER_SEP_PT * 2 +
      CMR7_DIGIT_HEIGHT_PT;
    labelX.push(`\\path[use as bounding box] (0,-${format(tickLabelBottomPt)}pt);`);
  }

  const labelY = [];
  for (const position of integerPositions(bounds.ymin, bounds.ymax)) {
    if (!showOrigin && Math.abs(position) < 1e-9) continue;
    const label = format(position * state.ystep);
    labelY.push(
      `\\path (${tickRight},${format(position)}) -- (${negateLength(tickLeft)},${format(position)}) node[${yLabelOptions}] {$${label}$};`
    );
  }

  const swap = optionBoolean(options.swap, false);
  const commands = swap
    ? [...labelX, ...labelY, ...drawX, ...drawY]
    : [...drawX, ...drawY, ...labelX, ...labelY];
  return commands.join("\n");
}

function renderFunction(state, rawOptions, rawExpression) {
  const options = parseOptions(rawOptions);
  const domain = parseFunctionDomain(options.domain, state);
  const samples = functionSamples(options.samples);
  const style = functionDrawOptions(options);
  const bounds = normalizedBounds(state);
  const points = [];
  let active = [];
  let previous = null;
  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0 : index / (samples - 1);
    const sourceX = domain.start + (domain.end - domain.start) * ratio;
    const sourceY = evaluateAxisExpression(rawExpression, sourceX, { "trig format": "rad" });
    if (!Number.isFinite(sourceY)) {
      if (active.length) points.push(active);
      active = [];
      previous = null;
      continue;
    }
    const current = { sourceX, x: sourceX / state.xstep, y: sourceY / state.ystep };
    if (previous) {
      if (hasDiscontinuityBetween(rawExpression, previous, current, state, bounds)) {
        if (active.length) points.push(active);
        active = [];
      } else {
        const clipped = clipSegmentToBounds(previous, current, bounds);
        if (clipped) {
          const [start, end] = clipped;
          if (!active.length || !samePoint(active[active.length - 1], start)) {
            if (active.length) points.push(active);
            active = [start];
          }
          if (!samePoint(active[active.length - 1], end)) active.push(end);
        } else if (active.length) {
          points.push(active);
          active = [];
        }
      }
    }
    previous = current;
  }
  if (active.length) points.push(active);
  if (!points.length) return "";

  const clips = `\\begin{scope}\\clip (${format(bounds.xmin)},${format(bounds.ymin)}) rectangle (${format(bounds.xmax)},${format(bounds.ymax)});`;
  const paths = points
    .filter((segment) => segment.length >= 2)
    .map((segment) => `\\draw[${style}] ${segment.map((point) => `(${format(point.x)},${format(point.y)})`).join(" -- ")};`)
    .join("\n");
  return paths ? `${clips}\n${paths}\n\\end{scope}` : "";
}

function hasDiscontinuityBetween(expression, start, end, state, bounds) {
  if (!crossesOppositeVerticalBounds(start.y, end.y, bounds)) return false;
  const midpointX = (start.sourceX + end.sourceX) / 2;
  const midpointY = evaluateAxisExpression(expression, midpointX, { "trig format": "rad" });
  if (!Number.isFinite(midpointY)) return true;
  return isOutsideVerticalBounds(midpointY / state.ystep, bounds);
}

function crossesOppositeVerticalBounds(startY, endY, bounds) {
  return (
    (startY > bounds.ymax && endY < bounds.ymin) ||
    (startY < bounds.ymin && endY > bounds.ymax)
  );
}

function isOutsideVerticalBounds(value, bounds) {
  return value < bounds.ymin || value > bounds.ymax;
}

function clipSegmentToBounds(start, end, bounds) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const limits = [
    [-dx, start.x - bounds.xmin],
    [dx, bounds.xmax - start.x],
    [-dy, start.y - bounds.ymin],
    [dy, bounds.ymax - start.y]
  ];
  let lower = 0;
  let upper = 1;

  for (const [p, q] of limits) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > upper) return null;
      lower = Math.max(lower, ratio);
    } else {
      if (ratio < lower) return null;
      upper = Math.min(upper, ratio);
    }
  }

  return [
    { x: start.x + lower * dx, y: start.y + lower * dy },
    { x: start.x + upper * dx, y: start.y + upper * dy }
  ];
}

function samePoint(first, second) {
  return Math.abs(first.x - second.x) < 1e-9 && Math.abs(first.y - second.y) < 1e-9;
}

function parseFunctionDomain(rawDomain, state) {
  const fallback = { start: state.xmin, end: state.xmax };
  const text = String(rawDomain ?? "").trim();
  if (!text) return fallback;
  const separator = text.indexOf(":");
  if (separator === -1) return fallback;
  const start = evaluateAxisExpression(text.slice(0, separator), 0, { "trig format": "rad" });
  const end = evaluateAxisExpression(text.slice(separator + 1), 0, { "trig format": "rad" });
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : fallback;
}

function functionSamples(rawSamples) {
  const value = Number(String(rawSamples ?? "200").trim());
  return Number.isFinite(value) ? Math.max(2, Math.min(1000, Math.round(value))) : 200;
}

function functionDrawOptions(options) {
  const parts = [];
  for (const [key, value] of Object.entries(options)) {
    if (["domain", "samples", "id", "fp"].includes(key)) continue;
    if (key === "style") {
      const style = optionText(value, "solid");
      if (style && style !== "solid") parts.push(style);
      continue;
    }
    if (value === true) parts.push(key);
    else parts.push(`${key}=${value}`);
  }
  if (!parts.some((part) => /^line width=/.test(part) || /^(?:thin|thick|very thick|ultra thick)$/.test(part))) {
    parts.push("line width=1pt");
  }
  return parts.join(",");
}

function normalizedBounds(state) {
  return {
    xmin: state.xmin / state.xstep,
    xmax: state.xmax / state.xstep,
    ymin: state.ymin / state.ystep,
    ymax: state.ymax / state.ystep
  };
}

function integerPositions(min, max) {
  const values = [];
  for (let value = Math.ceil(min - 1e-9); value <= Math.floor(max + 1e-9); value += 1) values.push(value);
  return values;
}

function optionText(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  return String(value).trim() || fallback;
}

function optionNumber(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  const number = Number(String(value).trim());
  return Number.isFinite(number) ? number : fallback;
}

function optionBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true) return true;
  const normalized = String(value).trim().toLowerCase();
  if (["false", "no", "off", "0"].includes(normalized)) return false;
  if (["true", "yes", "on", "1"].includes(normalized)) return true;
  return fallback;
}

function negateLength(value) {
  const text = String(value || "0pt").trim();
  if (!text || /^\+?0(?:\.0+)?(?:pt|cm|mm|em|ex|in)?$/i.test(text)) return "0pt";
  if (text.startsWith("-")) return text.slice(1);
  if (text.startsWith("+")) return `-${text.slice(1)}`;
  return `-${text}`;
}

function lengthToPoints(value, fallback, emSizePt = 10) {
  const text = String(value ?? "").trim();
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(pt|cm|mm|em|ex|in)?$/i);
  if (!match) return fallback;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return fallback;
  const unit = (match[2] || "pt").toLowerCase();
  if (unit === "cm") return number * TEX_PT_PER_CM;
  if (unit === "mm") return number * TEX_PT_PER_CM / 10;
  if (unit === "in") return number * 72.27;
  if (unit === "em") return number * emSizePt;
  if (unit === "ex") return number * emSizePt * 0.430554;
  return number;
}

function insideScriptsizeScope(source, endIndex) {
  const stack = [];
  const token = /\\begin\{scope\}(?:\[([^\]]*)\])?|\\end\{scope\}/g;
  let match;
  while ((match = token.exec(source)) && match.index < endIndex) {
    if (match[0].startsWith("\\end")) {
      stack.pop();
      continue;
    }
    const inherited = stack.length ? stack[stack.length - 1] : false;
    stack.push(inherited || /(?:^|,)\s*font\s*=\s*\\scriptsize(?:\s*(?:,|$))/.test(match[1] || ""));
  }
  return stack.length ? stack[stack.length - 1] : false;
}

function format(value) {
  const rounded = Math.round(Number(value) * 1e10) / 1e10;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function readCommandName(source, start) {
  const match = source.slice(start).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: start + match[0].length };
}

function parseOptionalArg(source, start) {
  let cursor = skipWhitespace(source, start);
  if (source[cursor] !== "[") return { content: "", end: cursor };
  const balanced = readBalanced(source, cursor, "[", "]");
  return balanced || { content: "", end: cursor };
}

function parseRequiredArg(source, start) {
  const cursor = skipWhitespace(source, start);
  if (source[cursor] !== "{") return null;
  return readBalanced(source, cursor, "{", "}");
}

function readBalanced(source, start, open, close) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    if (source[index] !== close) continue;
    depth -= 1;
    if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}
