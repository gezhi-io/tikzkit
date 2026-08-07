import { parseOptions } from "../engine/options.js";
import { evaluateAxisExpression } from "../pgfplots/expressions.js";

const IMPLEMENTED_COMMANDS = [
  "tkzInit",
  "tkzGrid",
  "tkzAxeXY",
  "tkzDrawX",
  "tkzDrawY",
  "tkzLabelX",
  "tkzLabelY",
  "tkzAxeX",
  "tkzAxeY",
  "tkzFct",
  "tkzFctPar",
  "tkzFctPolar",
  "tkzDrawTangentLine",
  "tkzDrawArea",
  "tkzArea"
];
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
      const gridBounds = parseGridBounds(text, optional.end, state);
      output += renderGrid(state, optional.content, gridBounds.bounds);
      index = gridBounds.end;
      continue;
    }
    if (command.value === "tkzDrawX") {
      output += renderXAxis(state, optional.content);
      index = optional.end;
      continue;
    }
    if (command.value === "tkzDrawY") {
      output += renderYAxis(state, optional.content);
      index = optional.end;
      continue;
    }
    if (command.value === "tkzLabelX") {
      output += renderXAxisLabels(state, optional.content);
      index = optional.end;
      continue;
    }
    if (command.value === "tkzLabelY") {
      output += renderYAxisLabels(state, optional.content);
      index = optional.end;
      continue;
    }
    if (command.value === "tkzAxeX") {
      // tkz-base labels first so the axis can cover a graduation at the origin.
      output += `${renderXAxisLabels(state, optional.content)}\n${renderXAxis(state, optional.content)}`;
      index = optional.end;
      continue;
    }
    if (command.value === "tkzAxeY") {
      output += `${renderYAxis(state, optional.content)}\n${renderYAxisLabels(state, optional.content)}`;
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
      rememberFunction(state, expression.content);
      output += renderFunction(state, optional.content, expression.content);
      index = expression.end;
      continue;
    }
    if (command.value === "tkzFctPar") {
      const xExpression = parseRequiredArg(text, optional.end);
      const yExpression = xExpression && parseRequiredArg(text, xExpression.end);
      if (!xExpression || !yExpression) {
        output += text.slice(index, optional.end);
        index = optional.end;
        continue;
      }
      output += renderParametricFunction(state, optional.content, xExpression.content, yExpression.content);
      index = yExpression.end;
      continue;
    }
    if (command.value === "tkzFctPolar") {
      const expression = parseRequiredArg(text, optional.end);
      if (!expression) {
        output += text.slice(index, optional.end);
        index = optional.end;
        continue;
      }
      output += renderPolarFunction(state, optional.content, expression.content);
      index = expression.end;
      continue;
    }
    if (command.value === "tkzDrawTangentLine") {
      const abscissa = parseParenthesizedArg(text, optional.end);
      if (!abscissa) {
        output += text.slice(index, optional.end);
        index = optional.end;
        continue;
      }
      output += renderTangentLine(state, optional.content, abscissa.content);
      index = abscissa.end;
      continue;
    }
    if (command.value === "tkzDrawArea" || command.value === "tkzArea") {
      output += renderFunctionArea(state, optional.content);
      index = optional.end;
      continue;
    }
    if (command.value === "tkzAxeXY") {
      output += renderAxes(state, optional.content, {
        scriptsize: insideScriptsizeScope(text, index)
      });
    }
    index = optional.end;
  }
  return output;
}

function usesTkzFct(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{[^{}]*\btkz-fct\b[^{}]*\}|\\tkz(?:Init|Grid|Axe(?:X|Y|XY)|Draw(?:X|Y|TangentLine|Area)|Area|Label[XY]|Fct(?:Par|Polar)?)\b/.test(source);
}

function createState() {
  return {
    xmin: 0,
    xmax: 10,
    xstep: 1,
    xorigin: 0,
    ymin: 0,
    ymax: 10,
    ystep: 1,
    yorigin: 0,
    functions: []
  };
}

function applyInitOptions(state, rawOptions) {
  const options = parseOptions(rawOptions);
  for (const key of ["xmin", "xmax", "xstep", "ymin", "ymax", "ystep"]) {
    const value = optionExpressionNumber(options[key]);
    if (Number.isFinite(value) && (key !== "xstep" && key !== "ystep" || value !== 0)) state[key] = value;
  }
  state.xorigin = sameSignedInterval(state.xmin, state.xmax) ? state.xmin : 0;
  state.yorigin = sameSignedInterval(state.ymin, state.ymax) ? state.ymin : 0;
}

function renderGrid(state, rawOptions, bounds = normalizedBounds(state)) {
  const options = parseOptions(rawOptions);
  const color = optionText(options.color, "gray");
  const lineWidth = optionText(options["line width"], "0.4pt");
  const xstep = sourceStepToCanvas(options.xstep, state.xstep, 1);
  const ystep = sourceStepToCanvas(options.ystep, state.ystep, 1);
  const main = renderGridPath(bounds, {
    color,
    lineWidth,
    xstep,
    ystep
  });
  if (!optionBoolean(options.sub, false)) return main;

  // tkz-base paints the light subgrid first, then lays the principal grid over it.
  const subXStep = sourceStepToCanvas(options.subxstep, state.xstep, 0.2);
  const subYStep = sourceStepToCanvas(options.subystep, state.ystep, 0.2);
  const ratio = optionExpressionNumber(options.ratio);
  const sub = renderGridPath(bounds, {
    color: `${color}!50`,
    lineWidth: scaleLineWidth(lineWidth, Number.isFinite(ratio) ? ratio : 0.75),
    xstep: subXStep,
    ystep: subYStep
  });
  return `${sub}\n${main}`;
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
  const xLabelOptions = `${xLabelOverlay}below=3pt,inner sep=1pt,outer sep=0pt,fill=white,xlabel style${textOption}`;
  const yLabelOptions = `left=3pt,inner sep=1pt,outer sep=0pt,fill=white,ylabel style${textOption}`;

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
  if (!hideTicks) {
    for (const position of integerPositions(bounds.xmin, bounds.xmax)) {
      if (!showOrigin && Math.abs(position) < 1e-9) continue;
      const label = format(position * state.xstep + state.xorigin);
      labelX.push(
        `\\path (${format(position)},${tickUp}) -- (${format(position)},${negateLength(tickDown)}) node[${xLabelOptions}] {$${label}$};`
      );
    }
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
  if (!hideTicks) {
    for (const position of integerPositions(bounds.ymin, bounds.ymax)) {
      if (!showOrigin && Math.abs(position) < 1e-9) continue;
      const label = format(position * state.ystep + state.yorigin);
      labelY.push(
        `\\path (${tickRight},${format(position)}) -- (${negateLength(tickLeft)},${format(position)}) node[${yLabelOptions}] {$${label}$};`
      );
    }
  }

  const swap = optionBoolean(options.swap, false);
  const commands = swap
    ? [...labelX, ...labelY, ...drawX, ...drawY]
    : [...drawX, ...drawY, ...labelX, ...labelY];
  return commands.join("\n");
}

function renderXAxis(state, rawOptions) {
  const options = parseOptions(rawOptions);
  const color = optionText(options.color, "black");
  const textColor = optionText(options.text, color);
  const lineWidth = optionText(options["line width"], "0.4pt");
  const tickWidth = optionText(options.tickwd, "0.8pt");
  const tickUp = optionText(options.tickup, "2pt");
  const tickDown = optionText(options.tickdn, "2pt");
  const rightSpace = optionNumber(options["right space"], 0.5);
  const leftSpace = optionNumber(options["left space"], 0);
  const label = options.label === undefined ? "$x$" : optionText(options.label, "");
  const bounds = normalizedBounds(state);
  const textOption = textColor === color ? "" : `,text=${textColor}`;
  const commands = [
    `\\draw[color=${color},line width=${lineWidth},-latex${textOption}] (${format(bounds.xmin - leftSpace)},0) -- (${format(bounds.xmax + rightSpace)},0) node[below=3pt,inner sep=1pt,outer sep=0pt,fill=white,xlabel style${textOption}] {${label}};`
  ];

  if (optionBoolean(options.noticks, false)) return commands.join("\n");
  const trig = optionNumber(options.trig, 0);
  const positions = trig === 0
    ? integerPositions(bounds.xmin, bounds.xmax)
    : trigAxisPositions(bounds.xmin, bounds.xmax, trig);
  for (const position of positions) {
    commands.push(
      `\\draw[color=${color},line width=${tickWidth}] (${format(position)},${tickUp}) -- (${format(position)},${negateLength(tickDown)});`
    );
  }
  return commands.join("\n");
}

function renderYAxis(state, rawOptions) {
  const options = parseOptions(rawOptions);
  const color = optionText(options.color, "black");
  const textColor = optionText(options.text, color);
  const lineWidth = optionText(options["line width"], "0.4pt");
  const tickWidth = optionText(options.tickwd, "0.8pt");
  const tickLeft = optionText(options.ticklt, "2pt");
  const tickRight = optionText(options.tickrt, "2pt");
  const upSpace = optionNumber(options["up space"], 0.5);
  const downSpace = optionNumber(options["down space"], 0);
  const label = options.label === undefined ? "$y$" : optionText(options.label, "");
  const bounds = normalizedBounds(state);
  const textOption = textColor === color ? "" : `,text=${textColor}`;
  const commands = [
    `\\draw[color=${color},line width=${lineWidth},-latex${textOption}] (0,${format(bounds.ymin - downSpace)}) -- (0,${format(bounds.ymax + upSpace)}) node[left=3pt,inner sep=1pt,outer sep=0pt,fill=white,ylabel style${textOption}] {${label}};`
  ];

  if (optionBoolean(options.noticks, false)) return commands.join("\n");
  const trig = optionNumber(options.trig, 0);
  const positions = trig === 0
    ? steppedAxisPositions(bounds.ymin, bounds.ymax, optionNumber(options.step, state.ystep) / state.ystep)
    : trigAxisPositions(bounds.ymin, bounds.ymax, trig);
  for (const position of positions) {
    commands.push(
      `\\draw[color=${color},line width=${tickWidth}] (${tickRight},${format(position)}) -- (${negateLength(tickLeft)},${format(position)});`
    );
  }
  return commands.join("\n");
}

function renderXAxisLabels(state, rawOptions) {
  const options = parseOptions(rawOptions);
  const bounds = normalizedBounds(state);
  const tickUp = optionText(options.tickup, "2pt");
  const tickDown = optionText(options.tickdn, "2pt");
  const tickWidth = optionText(options.tickwd, "0.8pt");
  const labelOptions = axisLabelOptions(options, "x");
  const markers = axisLabelMarkers(bounds.xmin, bounds.xmax, state.xstep, options);
  const showOrigin = labelShowsOrigin(options);
  const commands = [];
  for (const marker of markers) {
    if (!shouldRenderAxisLabel(marker.position, bounds.xmin, state.xmin, state.xmax, showOrigin)) continue;
    const label = formatAxisLabel(marker, options, state.xstep, state.xorigin);
    commands.push(
      `\\path (${format(marker.position)},${tickUp}) -- (${format(marker.position)},${negateLength(tickDown)}) node[${labelOptions}] {${label}};`
    );
    commands.push(
      `\\draw[${labelTickDrawOptions(options, tickWidth)}] (${format(marker.position)},${tickUp}) -- (${format(marker.position)},${negateLength(tickDown)});`
    );
  }
  return commands.join("\n");
}

function renderYAxisLabels(state, rawOptions) {
  const options = parseOptions(rawOptions);
  const bounds = normalizedBounds(state);
  const tickLeft = optionText(options.ticklt, "2pt");
  const tickRight = optionText(options.tickrt, "2pt");
  const tickWidth = optionText(options.tickwd, "0.8pt");
  const labelOptions = axisLabelOptions(options, "y");
  const markers = axisLabelMarkers(bounds.ymin, bounds.ymax, state.ystep, options);
  const showOrigin = labelShowsOrigin(options);
  const commands = [];
  for (const marker of markers) {
    if (!shouldRenderAxisLabel(marker.position, bounds.ymin, state.ymin, state.ymax, showOrigin)) continue;
    const label = formatAxisLabel(marker, options, state.ystep, state.yorigin);
    commands.push(
      `\\path (${tickRight},${format(marker.position)}) -- (${negateLength(tickLeft)},${format(marker.position)}) node[${labelOptions}] {${label}};`
    );
    commands.push(
      `\\draw[${labelTickDrawOptions(options, tickWidth)}] (${tickRight},${format(marker.position)}) -- (${negateLength(tickLeft)},${format(marker.position)});`
    );
  }
  return commands.join("\n");
}

function renderFunction(state, rawOptions, rawExpression) {
  const options = parseOptions(rawOptions);
  const domain = parseFunctionDomain(options.domain, state);
  const samples = functionSamples(options.samples);
  const style = functionDrawOptions(options);
  const bounds = normalizedBounds(state);
  const points = sampleScalarFunction(state, rawExpression, domain, samples, bounds);
  if (!points.length) return "";

  const clips = `\\begin{scope}\\clip (${format(bounds.xmin)},${format(bounds.ymin)}) rectangle (${format(bounds.xmax)},${format(bounds.ymax)});`;
  const paths = points
    .filter((segment) => segment.length >= 2)
    .map((segment) => `\\draw[${style}] ${segment.map((point) => `(${format(point.x)},${format(point.y)})`).join(" -- ")};`)
    .join("\n");
  return paths ? `${clips}\n${paths}\n\\end{scope}` : "";
}

function sampleScalarFunction(state, rawExpression, domain, samples, bounds = normalizedBounds(state)) {
  const segments = [];
  let active = [];
  let previous = null;
  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0 : index / (samples - 1);
    const sourceX = domain.start + (domain.end - domain.start) * ratio;
    const sourceY = evaluateAxisExpression(rawExpression, sourceX, { "trig format": "rad" });
    if (!Number.isFinite(sourceY)) {
      if (active.length) segments.push(active);
      active = [];
      previous = null;
      continue;
    }
    const current = {
      sourceX,
      x: (sourceX - state.xorigin) / state.xstep,
      y: (sourceY - state.yorigin) / state.ystep
    };
    if (previous) {
      if (hasDiscontinuityBetween(rawExpression, previous, current, state, bounds)) {
        if (active.length) segments.push(active);
        active = [];
      } else {
        const clipped = clipSegmentToBounds(previous, current, bounds);
        if (clipped) {
          const [start, end] = clipped;
          if (!active.length || !samePoint(active[active.length - 1], start)) {
            if (active.length) segments.push(active);
            active = [start];
          }
          if (!samePoint(active[active.length - 1], end)) active.push(end);
        } else if (active.length) {
          segments.push(active);
          active = [];
        }
      }
    }
    previous = current;
  }
  if (active.length) segments.push(active);
  return segments;
}

function renderFunctionArea(state, rawOptions) {
  // tkz-fct's \tkzDrawArea fills from the latest scalar function down to the
  // source y=0 axis. The curve still uses tkzInit's independent source-unit
  // scaling, while the closing edge must map y=0 through the local origin.
  const selected = state.functions.at(-1);
  if (!selected) return "";

  const options = parseOptions(rawOptions);
  const domain = parseFunctionDomain(options.domain, state);
  const samples = functionSamples(options.samples);
  const bounds = normalizedBounds(state);
  const baseline = sourceToCanvas(0, state.yorigin, state.ystep);
  const style = functionAreaOptions(options);
  const segments = sampleScalarFunction(state, selected.expression, domain, samples, bounds);
  const fills = segments
    .filter((segment) => segment.length >= 2)
    .map((segment) => {
      const first = segment[0];
      const last = segment.at(-1);
      const curve = segment.map((point) => `(${format(point.x)},${format(point.y)})`).join(" -- ");
      return `\\fill[${style}] (${format(first.x)},${format(baseline)}) -- ${curve} -- (${format(last.x)},${format(baseline)}) -- cycle;`;
    })
    .join("\n");
  if (!fills) return "";
  return `\\begin{scope}\\clip (${format(bounds.xmin)},${format(bounds.ymin)}) rectangle (${format(bounds.xmax)},${format(bounds.ymax)});\n${fills}\n\\end{scope}`;
}

function rememberFunction(state, expression) {
  const name = String.fromCharCode("a".charCodeAt(0) + state.functions.length);
  state.functions.push({ name, expression: String(expression || "").trim() });
}

function renderTangentLine(state, rawOptions, rawAbscissa) {
  const options = parseOptions(rawOptions);
  const selectedName = optionText(options.with, "").toLowerCase();
  const selected = selectedName
    ? state.functions.find((entry) => entry.name === selectedName)
    : state.functions.at(-1);
  const sourceX = optionExpressionNumber(rawAbscissa);
  if (!selected || !Number.isFinite(sourceX)) return "";

  // tkz-fct differentiates via one-sided finite differences at 10^-6 source
  // units, then independently converts the half-tangent's x/y components by
  // tkzInit's xstep/ystep values.
  const epsilon = 1e-6;
  const sourceY = evaluateAxisExpression(selected.expression, sourceX, { "trig format": "rad" });
  const rightY = evaluateAxisExpression(selected.expression, sourceX + epsilon, { "trig format": "rad" });
  const leftY = evaluateAxisExpression(selected.expression, sourceX - epsilon, { "trig format": "rad" });
  if (![sourceY, rightY, leftY].every(Number.isFinite)) return "";

  const point = {
    x: sourceToCanvas(sourceX, state.xorigin, state.xstep),
    y: sourceToCanvas(sourceY, state.yorigin, state.ystep)
  };
  const kl = optionNumber(options.kl, 1);
  const kr = optionNumber(options.kr, 1);
  const style = tangentDrawOptions(options);
  const commands = [];
  if (kr !== 0) {
    commands.push(
      `\\draw[${style}] (${formatTangent(point.x)},${formatTangent(point.y)}) -- (${formatTangent(point.x + kr / state.xstep)},${formatTangent(point.y + (kr * (rightY - sourceY)) / (epsilon * state.ystep))});`
    );
  }
  if (kl !== 0) {
    commands.push(
      `\\draw[${style}] (${formatTangent(point.x)},${formatTangent(point.y)}) -- (${formatTangent(point.x - kl / state.xstep)},${formatTangent(point.y - (kl * (sourceY - leftY)) / (epsilon * state.ystep))});`
    );
  }
  if (optionBoolean(options.draw, false)) {
    commands.push(`\\fill[black] (${formatTangent(point.x)},${formatTangent(point.y)}) circle (1pt);`);
  }
  return commands.join("\n");
}

function tangentDrawOptions(options) {
  const ignored = new Set(["with", "kl", "kr", "draw"]);
  const parts = ["-latex"];
  for (const [key, value] of Object.entries(options)) {
    if (ignored.has(key)) continue;
    if (key === "style") {
      const style = optionText(value, "solid");
      if (style && style !== "solid") parts.push(style);
      continue;
    }
    if (value === true) parts.push(key);
    else parts.push(`${key}=${value}`);
  }
  return parts.join(",");
}

function renderParametricFunction(state, rawOptions, rawXExpression, rawYExpression) {
  const options = parseOptions(rawOptions);
  // tkz-fct's native implementation evaluates both expressions in source
  // units, then divides each coordinate by its corresponding tkzInit step.
  const domain = parseDomain(options.domain, { start: -5, end: 5 });
  const samples = functionSamples(options.samples);
  const style = functionDrawOptions(options, "0.4pt");
  const bounds = normalizedBounds(state);
  const segments = [];
  let active = [];
  let previous = null;

  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0 : index / (samples - 1);
    const parameter = domain.start + (domain.end - domain.start) * ratio;
    const variables = { t: parameter };
    const sourceX = evaluateAxisExpression(rawXExpression, parameter, { "trig format": "rad" }, variables);
    const sourceY = evaluateAxisExpression(rawYExpression, parameter, { "trig format": "rad" }, variables);
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
      if (active.length) segments.push(active);
      active = [];
      previous = null;
      continue;
    }

    const current = {
      x: sourceToCanvas(sourceX, state.xorigin, state.xstep),
      y: sourceToCanvas(sourceY, state.yorigin, state.ystep)
    };
    if (previous) {
      const clipped = clipSegmentToBounds(previous, current, bounds);
      if (clipped) {
        const [start, end] = clipped;
        if (!active.length || !samePoint(active[active.length - 1], start)) {
          if (active.length) segments.push(active);
          active = [start];
        }
        if (!samePoint(active[active.length - 1], end)) active.push(end);
      } else if (active.length) {
        segments.push(active);
        active = [];
      }
    }
    previous = current;
  }
  if (active.length) segments.push(active);
  if (!segments.length) return "";

  const clip = `\\begin{scope}\\clip (${format(bounds.xmin)},${format(bounds.ymin)}) rectangle (${format(bounds.xmax)},${format(bounds.ymax)});`;
  const paths = segments
    .filter((segment) => segment.length >= 2)
    .map((segment) => `\\draw[${style}] ${segment.map((point) => `(${format(point.x)},${format(point.y)})`).join(" -- ")};`)
    .join("\n");
  return paths ? `${clip}\n${paths}\n\\end{scope}` : "";
}

function renderPolarFunction(state, rawOptions, rawExpression) {
  const options = parseOptions(rawOptions);
  // tkz-fct delegates to Gnuplot's `set polar` and divides the radius by
  // xstep only. This intentionally differs from tkzFctPar's x/y scaling.
  const domain = parseDomain(options.domain, { start: 0, end: 2 * Math.PI });
  const samples = functionSamples(options.samples);
  const style = functionDrawOptions(options, "0.4pt");
  const originX = state.xorigin / state.xstep;
  const originY = state.yorigin / state.ystep;
  const segments = [];
  let active = [];

  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0 : index / (samples - 1);
    const parameter = domain.start + (domain.end - domain.start) * ratio;
    const radius = evaluateAxisExpression(rawExpression, parameter, { "trig format": "rad" }, { t: parameter });
    if (!Number.isFinite(radius)) {
      if (active.length) segments.push(active);
      active = [];
      continue;
    }
    const normalizedRadius = radius / state.xstep;
    active.push({
      x: normalizedRadius * Math.cos(parameter) - originX,
      y: normalizedRadius * Math.sin(parameter) - originY
    });
  }
  if (active.length) segments.push(active);
  const paths = segments
    .filter((segment) => segment.length >= 2)
    .map((segment) => `\\draw[${style}] ${segment.map((point) => `(${format(point.x)},${format(point.y)})`).join(" -- ")};`)
    .join("\n");
  return paths;
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
  return parseDomain(rawDomain, { start: state.xmin, end: state.xmax });
}

function parseDomain(rawDomain, fallback) {
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

function functionDrawOptions(options, defaultLineWidth = "1pt") {
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
    parts.push(`line width=${defaultLineWidth}`);
  }
  return parts.join(",");
}

function functionAreaOptions(options) {
  const ignored = new Set(["domain", "samples", "id", "opacity"]);
  const parts = [
    `color=${optionText(options.color, "black!50")}`,
    `fill opacity=${optionNumber(options.opacity, 0.5)}`
  ];
  for (const [key, value] of Object.entries(options)) {
    if (ignored.has(key) || key === "color") continue;
    if (key === "style") {
      const style = optionText(value, "");
      if (style) parts.push(style);
      continue;
    }
    if (value === true) parts.push(key);
    else parts.push(`${key}=${value}`);
  }
  return parts.join(",");
}

function normalizedBounds(state) {
  return {
    xmin: (state.xmin - state.xorigin) / state.xstep,
    xmax: (state.xmax - state.xorigin) / state.xstep,
    ymin: (state.ymin - state.yorigin) / state.ystep,
    ymax: (state.ymax - state.yorigin) / state.ystep
  };
}

function integerPositions(min, max) {
  const values = [];
  for (let value = Math.trunc(min); value <= Math.trunc(max); value += 1) values.push(value);
  return values;
}

function axisLabelMarkers(min, max, sourceStep, options) {
  const trig = optionNumber(options.trig, 0);
  if (trig !== 0) return trigAxisMarkers(min, max, trig);
  const denominator = Math.round(optionNumber(options.frac, 0));
  if (denominator > 0) {
    return integerPositions(Math.round(min), Math.trunc(max)).map((position) => ({ position, numerator: position }));
  }
  const increment = optionNumber(options.step, sourceStep) / sourceStep;
  return steppedAxisPositions(min, max, increment).map((position) => ({ position }));
}

function axisLabelOptions(options, axis) {
  const base = axis === "x"
    ? ["below=3pt", "inner sep=1pt", "outer sep=0pt", "fill=white"]
    : ["left=3pt", "inner sep=1pt", "outer sep=0pt", "fill=white"];
  const forwarded = forwardAxisLabelOptions(options);
  // tkz-base first applies its config-level xlabel/ylabel style and then the
  // command options. Keeping the built-in defaults before the style gives a
  // user .style definition replacement semantics, while .append style builds
  // on the same defaults exactly as the installed package does.
  return [...base, axis === "x" ? "xlabel style" : "ylabel style", ...forwarded].join(",");
}

function forwardAxisLabelOptions(options) {
  const tkzKeys = new Set([
    "frac",
    "trig",
    "step",
    "tickwd",
    "tickup",
    "tickdn",
    "ticklt",
    "tickrt",
    "np off",
    "orig"
  ]);
  const parts = [];
  for (const [rawKey, value] of Object.entries(options)) {
    if (tkzKeys.has(rawKey)) continue;
    const key = rawKey === "node font" ? "font" : rawKey;
    if (value === true) parts.push(key);
    else parts.push(`${key}=${value}`);
  }
  return parts;
}

function labelTickDrawOptions(options, tickWidth) {
  const color = optionText(options.color, "black");
  const text = optionText(options.text, color);
  const textOption = text === color ? "" : `,text=${text}`;
  return `color=${color},line width=${tickWidth}${textOption}`;
}

function labelShowsOrigin(options) {
  if (options.orig === undefined) return true;
  // In tkz-base, the bare `orig` key has `.default=false`.
  if (options.orig === true) return false;
  return optionBoolean(options.orig, true);
}

function shouldRenderAxisLabel(position, localMinimum, sourceMinimum, sourceMaximum, showOrigin) {
  if (showOrigin) return true;
  if (sameSignedInterval(sourceMinimum, sourceMaximum)) return Math.abs(position - Math.trunc(localMinimum)) > 1e-9;
  return Math.abs(position) > 1e-9;
}

function formatAxisLabel(marker, options, sourceStep, sourceOrigin) {
  const trig = optionNumber(options.trig, 0);
  if (trig !== 0) return formatPiFraction(marker.numerator, trig);
  const denominator = Math.round(optionNumber(options.frac, 0));
  if (denominator > 0) return formatFraction(marker.numerator, denominator);
  return `$${format(marker.position * sourceStep + sourceOrigin)}$`;
}

function formatFraction(numerator, denominator) {
  const reduced = reduceIntegerFraction(numerator, denominator);
  if (reduced.numerator === 0) return "$0$";
  if (reduced.denominator === 1) return `$${reduced.numerator}$`;
  if (reduced.numerator === 1) return `$\\frac{1}{${reduced.denominator}}$`;
  if (reduced.numerator === -1) return `$\\frac{-1}{${reduced.denominator}}$`;
  return `$\\frac{${reduced.numerator}}{${reduced.denominator}}$`;
}

function formatPiFraction(numerator, denominator) {
  const reduced = reduceIntegerFraction(numerator, denominator);
  if (reduced.numerator === 0) return "$0$";
  if (reduced.denominator === 1) {
    if (reduced.numerator === 1) return "$\\pi$";
    if (reduced.numerator === -1) return "$-\\pi$";
    return `$${reduced.numerator}\\pi$`;
  }
  if (reduced.numerator === 1) return `$\\frac{\\pi}{${reduced.denominator}}$`;
  if (reduced.numerator === -1) return `$\\frac{-\\pi}{${reduced.denominator}}$`;
  return `$\\frac{${reduced.numerator}\\pi}{${reduced.denominator}}$`;
}

function reduceIntegerFraction(numerator, denominator) {
  const normalizedDenominator = Math.max(1, Math.abs(Math.round(denominator)));
  const normalizedNumerator = Math.round(numerator);
  const divisor = greatestCommonDivisor(Math.abs(normalizedNumerator), normalizedDenominator);
  return {
    numerator: normalizedNumerator / divisor,
    denominator: normalizedDenominator / divisor
  };
}

function greatestCommonDivisor(first, second) {
  let a = Math.max(0, Math.round(first));
  let b = Math.max(0, Math.round(second));
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a || 1;
}

function steppedAxisPositions(min, max, increment) {
  const start = Math.trunc(min);
  const end = Math.trunc(max);
  if (!Number.isFinite(increment) || increment <= 0) return integerPositions(min, max);
  const values = [];
  for (let value = start; value <= end + 1e-9; value += increment) values.push(value);
  return values;
}

function trigAxisPositions(min, max, trig) {
  return trigAxisMarkers(min, max, trig).map((marker) => marker.position);
}

function trigAxisMarkers(min, max, trig) {
  if (!Number.isFinite(trig) || trig === 0) return integerPositions(min, max).map((position) => ({ position }));
  const start = Math.round(((Math.trunc(min) + 0.5) / Math.PI) * trig);
  const end = Math.floor((Math.trunc(max) / Math.PI) * trig + 1e-9);
  const values = [];
  for (let numerator = start; numerator <= end; numerator += 1) {
    values.push({ numerator, position: (numerator * Math.PI) / trig });
  }
  return values;
}

function sameSignedInterval(min, max) {
  return Math.sign(min) === Math.sign(max);
}

function renderGridPath(bounds, { color, lineWidth, xstep, ystep }) {
  return `\\draw[color=${color},line width=${lineWidth},xstep=${format(xstep)}cm,ystep=${format(ystep)}cm] (${format(bounds.xmin)},${format(bounds.ymin)}) grid (${format(bounds.xmax)},${format(bounds.ymax)});`;
}

function sourceStepToCanvas(rawValue, sourceStep, fallback) {
  const sourceValue = rawValue === undefined ? sourceStep * fallback : optionExpressionNumber(rawValue);
  if (!Number.isFinite(sourceValue) || !Number.isFinite(sourceStep) || sourceStep === 0) return fallback;
  return Math.abs(sourceValue / sourceStep);
}

function scaleLineWidth(value, ratio) {
  const match = String(value || "").trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(pt|cm|mm|em|ex|in)$/i);
  if (!match) return "0.3pt";
  const scaled = Number(match[1]) * ratio;
  return `${format(scaled)}${match[2]}`;
}

function parseGridBounds(source, start, state) {
  const first = parseCoordinatePair(source, start);
  if (!first) return { bounds: normalizedBounds(state), end: start };
  const second = parseCoordinatePair(source, first.end);
  if (!second) return { bounds: normalizedBounds(state), end: first.end };
  const bounds = {
    xmin: sourceToCanvas(first.x, state.xorigin, state.xstep),
    ymin: sourceToCanvas(first.y, state.yorigin, state.ystep),
    xmax: sourceToCanvas(second.x, state.xorigin, state.xstep),
    ymax: sourceToCanvas(second.y, state.yorigin, state.ystep)
  };
  return {
    bounds: Object.values(bounds).every(Number.isFinite) ? bounds : normalizedBounds(state),
    end: second.end
  };
}

function parseCoordinatePair(source, start) {
  const cursor = skipWhitespace(source, start);
  if (source[cursor] !== "(") return null;
  const balanced = readBalanced(source, cursor, "(", ")");
  if (!balanced) return null;
  const [rawX, rawY] = splitCoordinatePair(balanced.content);
  const x = optionExpressionNumber(rawX);
  const y = optionExpressionNumber(rawY);
  return { x, y, end: balanced.end };
}

function splitCoordinatePair(source) {
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{" || char === "(" || char === "[") depth += 1;
    else if (char === "}" || char === ")" || char === "]") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) return [source.slice(0, index), source.slice(index + 1)];
  }
  return [source, ""];
}

function sourceToCanvas(value, origin, step) {
  return (value - origin) / step;
}

function optionText(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  return String(value).trim() || fallback;
}

function optionNumber(value, fallback) {
  const number = optionExpressionNumber(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionExpressionNumber(value) {
  if (value === undefined || value === null || value === true || value === "") return Number.NaN;
  const text = String(value).trim();
  const number = Number(text);
  if (Number.isFinite(number)) return number;
  return evaluateAxisExpression(text, 0, { "trig format": "rad" });
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

function formatTangent(value) {
  const rounded = Math.round(Number(value) * 1e10) / 1e10;
  if (Number.isFinite(rounded) && Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-6) {
    return rounded.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
  }
  return format(rounded);
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

function parseParenthesizedArg(source, start) {
  const cursor = skipWhitespace(source, start);
  if (source[cursor] !== "(") return null;
  return readBalanced(source, cursor, "(", ")");
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
