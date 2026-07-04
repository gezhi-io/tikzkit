import { parseDimension } from "../engine/math.js";
import { splitTopLevel } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";
import { formatAxisPoint, formatAxisTickLabel, joinOptions, roundAxis } from "./format.js";
import { isMiddleAxis } from "./geometry.js";

export function createAxisTickModel(axisOptions = {}, ranges = {}, addplots = []) {
  return {
    x: createTickAxisModel("x", axisOptions, ranges, addplots),
    y: createTickAxisModel("y", axisOptions, ranges, addplots)
  };
}

export function createTickAxisModel(axis, axisOptions = {}, ranges = {}, addplots = []) {
  const allDisabled = ticksDisabled(axisOptions.ticks) || ticksDisabled(axisOptions.tick);
  const raw = axis === "x" ? axisOptions.xtick ?? axisOptions["x tick"] : axisOptions.ytick ?? axisOptions["y tick"];
  const disabled = allDisabled || ticksDisabled(raw);
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  const distanceTicks = tickDistanceValues(axisOptions, axis, min, max);
  const explicit = hasExplicitTickOption(raw) || distanceTicks.length > 0;
  const values = disabled
    ? []
    : hasExplicitTickOption(raw)
      ? axisTickValues(raw, axis, addplots)
      : distanceTicks.length
        ? distanceTicks
        : majorTickValues(min, max, axis === "x" ? 7 : 6);
  return { disabled, explicit, values };
}

export function renderAxisTicks(axisOptions = {}, addplots = [], ranges = {}, geometry = {}) {
  const commands = [];
  const allTicksDisabled = ticksDisabled(axisOptions.ticks) || ticksDisabled(axisOptions.tick);
  const xTicksDisabled = allTicksDisabled || ticksDisabled(axisOptions.xtick) || ticksDisabled(axisOptions["x tick"]);
  const yTicksDisabled = allTicksDisabled || ticksDisabled(axisOptions.ytick) || ticksDisabled(axisOptions["y tick"]);
  const xDistanceTicks = tickDistanceValues(axisOptions, "x", ranges.xMin, ranges.xMax);
  const yDistanceTicks = tickDistanceValues(axisOptions, "y", ranges.yMin, ranges.yMax);
  const explicitXTicks = xTicksDisabled || hasExplicitTickOption(axisOptions.xtick) || xDistanceTicks.length > 0;
  const explicitYTicks = yTicksDisabled || hasExplicitTickOption(axisOptions.ytick) || yDistanceTicks.length > 0;
  const xTicks = xTicksDisabled
    ? []
    : hasExplicitTickOption(axisOptions.xtick)
    ? axisTickValues(axisOptions.xtick, "x", addplots)
    : xDistanceTicks.length
    ? xDistanceTicks
    : trimAutoTerminalTicks(majorTickValues(ranges.xMin, ranges.xMax, 7), ranges.xMin, ranges.xMax);
  const yTicks = yTicksDisabled
    ? []
    : hasExplicitTickOption(axisOptions.ytick)
    ? axisTickValues(axisOptions.ytick, "y", addplots)
    : yDistanceTicks.length
    ? yDistanceTicks
    : trimAutoTerminalTicks(majorTickValues(ranges.yMin, ranges.yMax, 6), ranges.yMin, ranges.yMax);
  const xMinorTicks = xTicksDisabled || !hasExplicitTickOption(axisOptions["x minor tick values"]) ? [] : axisTickValues(axisOptions["x minor tick values"], "x", addplots);
  const yMinorTicks = yTicksDisabled || !hasExplicitTickOption(axisOptions["y minor tick values"]) ? [] : axisTickValues(axisOptions["y minor tick values"], "y", addplots);
  const xLabels = axisTickLabels(axisOptions.xticklabels, xTicks).map((label, index) =>
    !explicitXTicks && autoTickLabelOutsideRange(xTicks[index], ranges.xMin, ranges.xMax) ? "" : label
  );
  const yLabels = axisTickLabels(axisOptions.yticklabels, yTicks).map((label, index) =>
    !explicitYTicks && autoTickLabelOutsideRange(yTicks[index], ranges.yMin, ranges.yMax) ? "" : label
  );
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const xTickLabelDistance = parseDimension(String(axisOptions["x axis tick label distance"] || ""), {});
  const yTickLabelDistance = parseDimension(String(axisOptions["y axis tick label distance"] || ""), {});
  const xTickColor = axisOptions["x axis tick color"] || axisOptions["axis tick color"] || "black";
  const yTickColor = axisOptions["y axis tick color"] || axisOptions["axis tick color"] || "black";
  const xTickLabelColor = axisOptions["x axis tick label color"] || "";
  const yTickLabelColor = axisOptions["y axis tick label color"] || "";
  const xTickStyle = joinOptions([
    "axis tick",
    xTickColor,
    `line width=${axisOptions["axis tick line width"] || "0.25pt"}`
  ]);
  const yTickStyle = joinOptions([
    "axis tick",
    yTickColor,
    `line width=${axisOptions["axis tick line width"] || "0.25pt"}`
  ]);
  const minorTickStyle = joinOptions([
    "axis minor tick",
    xTickColor,
    `line width=${axisOptions["axis tick line width"] || "0.25pt"}`
  ]);
  const xMajorTickVisual = axisTickVisualRenderConfig(axisOptions, "x", "major", tickLength, xTickStyle);
  const yMajorTickVisual = axisTickVisualRenderConfig(axisOptions, "y", "major", tickLength, yTickStyle);
  const xMinorTickVisual = axisTickVisualRenderConfig(axisOptions, "x", "minor", parseDimension("1.4pt", {}), minorTickStyle);
  const yMinorTickVisual = axisTickVisualRenderConfig(
    axisOptions,
    "y",
    "minor",
    parseDimension("1.4pt", {}),
    joinOptions(["axis minor tick", yTickColor, `line width=${axisOptions["axis tick line width"] || "0.25pt"}`])
  );
  const tickLabelFont = axisOptions["axis tick label font"] || "\\scriptsize";
  const tickLabelInnerSep = axisOptions["axis tick label inner sep"];
  const hideOutOfRangeTickLabels = Boolean(axisOptions["datavis hide out of range tick labels"]);
  const middleAxis = isMiddleAxis(axisOptions);
  const cleanAxisOffset = axisOptions["datavis clean axes"] ? parseAxisCleanPadding(axisOptions) : 0;
  const oppositeBoxTicks = shouldRenderDatavisBoxOppositeTicks(axisOptions);
  const innerBoxTicks = oppositeBoxTicks && axisOptions["datavis tick direction"] === "inner";
  const yAxis = middleAxis && ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  const xAxis = middleAxis && ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  xMinorTicks.forEach((x) => {
    const base = geometry.mapPoint({ x, y: axisTickBaseValue(xMinorTickVisual, "y", yAxis, ranges) });
    if (cleanAxisOffset) base.y -= cleanAxisOffset;
    const [from, to] = axisTickSegment(base, xMinorTickVisual, "x", 0, innerBoxTicks ? tickLength * 0.5 : -tickLength * 0.5);
    commands.push(`\\draw[${xMinorTickVisual?.style || minorTickStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  });
  xTicks.forEach((x, index) => {
    const base = geometry.mapPoint({ x, y: axisTickBaseValue(xMajorTickVisual, "y", yAxis, ranges) });
    if (cleanAxisOffset) base.y -= cleanAxisOffset;
    const [from, to] = axisTickSegment(base, xMajorTickVisual, "x", 0, innerBoxTicks ? tickLength : -tickLength);
    commands.push(`\\draw[${xMajorTickVisual?.style || xTickStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    if (oppositeBoxTicks) {
      const topBase = geometry.mapPoint({ x, y: ranges.yMax });
      commands.push(`\\draw[${xTickStyle}] ${formatAxisPoint(topBase)} -- ${formatAxisPoint(offsetPoint(topBase, 0, innerBoxTicks ? -tickLength : tickLength))};`);
    }
    const shouldShowXLabel =
      !shouldHideAutoOriginTickLabel(x, explicitXTicks, middleAxis, ranges.yMin, ranges.yMax) &&
      !(hideOutOfRangeTickLabels && autoTickLabelOutsideRange(x, ranges.xMin, ranges.xMax));
    if (xMajorTickVisual && shouldShowXLabel) {
      for (const spec of axisTickVisualLabelSpecs(xMajorTickVisual, from, to)) {
        const labelStyle = joinOptions([
          "axis tick label",
          `anchor=${spec.anchor}`,
          `font=${tickLabelFont}`,
          tickLabelInnerSep !== undefined ? `inner sep=${tickLabelInnerSep}` : "",
          xTickLabelColor ? `text=${xTickLabelColor}` : ""
        ]);
        if (xLabels[index] !== "") commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(spec.point)} {${xLabels[index]}};`);
      }
    } else if (!xMajorTickVisual && shouldShowXLabel) {
      const labelStyle = joinOptions([
        "axis tick label",
        "anchor=north",
        `font=${tickLabelFont}`,
        tickLabelInnerSep !== undefined ? `inner sep=${tickLabelInnerSep}` : "",
        xTickLabelColor ? `text=${xTickLabelColor}` : ""
      ]);
      const labelDistance = Number.isFinite(xTickLabelDistance) && xTickLabelDistance > 0 ? xTickLabelDistance : tickLength * 1.55;
      commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(offsetPoint(base, 0, -labelDistance))} {${xLabels[index]}};`);
    }
  });
  yMinorTicks.forEach((y) => {
    const base = geometry.mapPoint({ x: axisTickBaseValue(yMinorTickVisual, "x", xAxis, ranges), y });
    if (cleanAxisOffset) base.x -= cleanAxisOffset;
    const [from, to] = axisTickSegment(base, yMinorTickVisual, "y", innerBoxTicks ? tickLength * 0.5 : -tickLength * 0.5, 0);
    commands.push(`\\draw[${yMinorTickVisual?.style || yMinorTickVisual?.defaultStyle || joinOptions(["axis minor tick", yTickColor, `line width=${axisOptions["axis tick line width"] || "0.25pt"}`])}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  });
  yTicks.forEach((y, index) => {
    const base = geometry.mapPoint({ x: axisTickBaseValue(yMajorTickVisual, "x", xAxis, ranges), y });
    if (cleanAxisOffset) base.x -= cleanAxisOffset;
    const [from, to] = axisTickSegment(base, yMajorTickVisual, "y", innerBoxTicks ? tickLength : -tickLength, 0);
    commands.push(`\\draw[${yMajorTickVisual?.style || yTickStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    if (oppositeBoxTicks) {
      const rightBase = geometry.mapPoint({ x: ranges.xMax, y });
      commands.push(`\\draw[${yTickStyle}] ${formatAxisPoint(rightBase)} -- ${formatAxisPoint(offsetPoint(rightBase, innerBoxTicks ? -tickLength : tickLength, 0))};`);
    }
    const shouldShowYLabel =
      !shouldHideAutoOriginTickLabel(y, explicitYTicks, middleAxis, ranges.xMin, ranges.xMax) &&
      !(hideOutOfRangeTickLabels && autoTickLabelOutsideRange(y, ranges.yMin, ranges.yMax));
    if (yMajorTickVisual && shouldShowYLabel) {
      for (const spec of axisTickVisualLabelSpecs(yMajorTickVisual, from, to)) {
        const labelStyle = joinOptions([
          "axis tick label",
          `anchor=${spec.anchor}`,
          `font=${tickLabelFont}`,
          tickLabelInnerSep !== undefined ? `inner sep=${tickLabelInnerSep}` : "",
          yTickLabelColor ? `text=${yTickLabelColor}` : ""
        ]);
        if (yLabels[index] !== "") commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(spec.point)} {${yLabels[index]}};`);
      }
    } else if (!yMajorTickVisual && shouldShowYLabel) {
      const labelStyle = joinOptions([
        "axis tick label",
        "anchor=east",
        `font=${tickLabelFont}`,
        tickLabelInnerSep !== undefined ? `inner sep=${tickLabelInnerSep}` : "",
        yTickLabelColor ? `text=${yTickLabelColor}` : ""
      ]);
      const labelDistance = Number.isFinite(yTickLabelDistance) && yTickLabelDistance > 0 ? yTickLabelDistance : tickLength * 1.55;
      commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(offsetPoint(base, -labelDistance, 0))} {${yLabels[index]}};`);
    }
  });
  return commands;
}

export function majorTickValues(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  const span = max - min;
  const rawStep = Math.abs(span) / Math.max(1, maxTicks - 1);
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * base;
  const start = Math.ceil(min / step) * step;
  const values = [];
  for (let value = start; value <= max + step * 0.2; value += step) {
    values.push(roundAxis(value));
    if (values.length >= maxTicks + 2) break;
  }
  return values;
}

export function tickDistanceValues(axisOptions = {}, axis, min, max) {
  const raw = axisOptions?.[`${axis}tick distance`] ?? axisOptions?.[`${axis} tick distance`];
  const step = axisNumber(raw, NaN);
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(min) || !Number.isFinite(max) || min > max) return [];
  const values = [];
  const epsilon = Math.max(1e-9, Math.abs(max - min) * 1e-10);
  for (let value = Math.ceil((min - epsilon) / step) * step; value <= max + epsilon; value += step) {
    values.push(roundAxis(value));
    if (values.length > 200) break;
  }
  return values;
}

export function axisTickValues(raw, axis, addplots = []) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text || text === "\\empty" || text === "empty") return [];
  if (text === "data") {
    const values = addplots.flatMap((plot) => plot.points || []).map((point) => point[axis]).filter(Number.isFinite);
    return [...new Set(values)];
  }
  return splitBracedList(text).map((part) => axisNumber(part, NaN)).filter(Number.isFinite);
}

function hasExplicitTickOption(raw) {
  if (raw === undefined || raw === null) return false;
  if (raw === true || raw === false) return true;
  return String(raw).trim() !== "";
}

function ticksDisabled(raw) {
  if (raw === undefined || raw === null || raw === false) return false;
  const text = String(raw).trim().toLowerCase();
  return text === "none" || text === "false" || text === "off" || text === "\\empty" || text === "empty";
}

function axisTickVisualRenderConfig(axisOptions = {}, axis = "x", kind = "major", defaultLength = 0, defaultStyle = "") {
  const prefix = `${axis} ${kind} tick`;
  if (!axisOptions[`${prefix} visualized`]) return null;
  const low = axisVisualTickDimension(axisOptions[`${prefix} low`], -defaultLength);
  const high = axisVisualTickDimension(axisOptions[`${prefix} high`], defaultLength);
  return {
    low,
    high,
    direction: axisVisualTickDirection(axisOptions[`${prefix} direction axis`], axis),
    style: joinOptions([defaultStyle, axisOptions[`${prefix} style`] || ""]),
    tickTextAtLow: axisOptions[`${prefix} text at low`] === true,
    tickTextAtHigh: axisOptions[`${prefix} text at high`] === true,
    xAxisGoto: axisOptions[`${prefix} x axis goto`],
    yAxisGoto: axisOptions[`${prefix} y axis goto`]
  };
}

function axisVisualTickDimension(raw, fallback) {
  if (raw === undefined || raw === null || raw === true || raw === false || raw === "") return fallback;
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function axisVisualTickDirection(raw, tickAxis) {
  const text = String(raw || "").trim().toLowerCase();
  if (/\bx\s+axis\b|\bx\b/.test(text)) return "x";
  if (/\by\s+axis\b|\by\b/.test(text)) return "y";
  return tickAxis === "x" ? "y" : "x";
}

function axisTickSegment(base, visual, tickAxis, defaultDx, defaultDy) {
  if (!visual) return [base, offsetPoint(base, defaultDx, defaultDy)];
  const direction = visual.direction || (tickAxis === "x" ? "y" : "x");
  const from = direction === "x" ? offsetPoint(base, visual.low, 0) : offsetPoint(base, 0, visual.low);
  const to = direction === "x" ? offsetPoint(base, visual.high, 0) : offsetPoint(base, 0, visual.high);
  return [from, to];
}

function axisTickVisualLabelSpecs(visual, lowPoint, highPoint) {
  if (!visual) return [];
  const specs = [];
  if (visual.tickTextAtLow) specs.push({ point: lowPoint, anchor: axisTickVisualLabelAnchor(visual, "low") });
  if (visual.tickTextAtHigh) specs.push({ point: highPoint, anchor: axisTickVisualLabelAnchor(visual, "high") });
  return specs;
}

function axisTickVisualLabelAnchor(visual, endpoint) {
  const direction = visual.direction || "y";
  if (direction === "x") return endpoint === "high" ? "west" : "east";
  return endpoint === "high" ? "south" : "north";
}

function axisTickBaseValue(visual, axis, fallback, ranges) {
  const raw = axis === "x" ? visual?.xAxisGoto : visual?.yAxisGoto;
  const value = String(raw || "").trim().toLowerCase();
  if (value === "min" || value === "padded min") return axis === "x" ? ranges.xMin : ranges.yMin;
  if (value === "max" || value === "padded max") return axis === "x" ? ranges.xMax : ranges.yMax;
  return fallback;
}

function shouldRenderDatavisBoxOppositeTicks(axisOptions = {}) {
  if (!axisOptions["datavis boxed axes"]) return false;
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  return String(raw || "").trim().toLowerCase() === "box";
}

function shouldHideAutoOriginTickLabel(value, explicitTicks, middleAxis, otherMin, otherMax) {
  return !explicitTicks && middleAxis && otherMin < 0 && otherMax > 0 && Math.abs(value) < 1e-9;
}

function autoTickLabelOutsideRange(value, min, max) {
  const span = Math.abs(max - min) || 1;
  const epsilon = Math.max(span * 5e-3, 1e-9);
  return value < min - epsilon || value > max + epsilon;
}

function trimAutoTerminalTicks(values, min, max) {
  const span = Math.abs(max - min) || 1;
  const rangeEpsilon = span * 1e-10;
  const steps = [];
  for (let index = 1; index < values.length; index += 1) {
    const step = Math.abs(values[index] - values[index - 1]);
    if (step > 1e-9) steps.push(step);
  }
  const step = Math.min(...steps);
  const terminalTolerance = Number.isFinite(step) && step > 0 ? Math.max(rangeEpsilon, step * 0.2) : rangeEpsilon;
  const ticks = values.filter((value) => value >= min - terminalTolerance && value <= max + terminalTolerance);
  if (ticks.length < 2) return ticks;
  if (!Number.isFinite(step) || step <= 0) return ticks;
  if (ticks.length > 1 && max - ticks.at(-1) >= 0 && max - ticks.at(-1) < step * 0.12) ticks.pop();
  return ticks;
}

function axisTickLabels(raw, ticks) {
  if (isEmptyTickLabelList(raw)) return ticks.map(() => "");
  const labels = splitBracedList(raw);
  if (labels.length) return ticks.map((_, index) => labels[index] ?? "");
  return ticks.map((tick) => formatAxisTickLabel(tick));
}

function isEmptyTickLabelList(raw) {
  if (raw === undefined || raw === null || raw === false) return false;
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  return text === "" || text === "\\empty" || text.toLowerCase() === "empty";
}

function parseAxisCleanPadding(axisOptions = {}) {
  const raw = axisOptions["datavis clean padding"] || "0.175cm";
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0.175;
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}

function splitBracedList(raw) {
  const text = stripBalancedOuterBracesForList(String(raw || "").trim());
  if (!text) return [];
  if (text === "\\empty" || text.toLowerCase() === "empty") return [];
  return splitTopLevel(text, ",").map((part) => stripBalancedOuterBracesForList(part.trim()));
}

function stripBalancedOuterBracesForList(raw) {
  const text = String(raw || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return text;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && index < text.length - 1) return text;
    }
    if (depth < 0) return text;
  }
  return depth === 0 ? text.slice(1, -1).trim() : text;
}
