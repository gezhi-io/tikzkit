import { parseDimension } from "../engine/math.js";
import { parseOptions } from "../engine/options.js";
import { axisNumber, axisNumberList } from "./coordinates.js";
import { measurePlainTextTeXBoxPt } from "../tikz/textMetrics.js";
import { pgfplotsRoleFontCommand } from "./fonts.js";
import { formatAxisPoint, formatAxisTickLabel, joinOptions, roundAxis } from "./format.js";
import { axisHasExplicitDescriptionPlacement, isMiddleAxis } from "./geometry.js";
import { pgfplotsAxisHidden } from "./axisOptions.js";
import { isLogAxis } from "./ranges.js";
import { axisLogMajorTickValues, axisLogMinorTickValues, axisLogTickLabel } from "./logAxis.js";
import { pgfNumberFormatOptions } from "../pgf/numberFormat.js";

const PGFPLOTS_TICK_LABEL_TEXT_WIDTH_SCALE = 1.0001;
// Computer Modern's optical 7pt design has wider digits than a linearly
// scaled 10pt web font. Native PGFPlots uses cmr7 for \scriptsize tick labels,
// so preserve that TeX advance width for rotated anchors and SVG painting.
const PGFPLOTS_SCRIPTSIZE_TICK_LABEL_TEXT_WIDTH_SCALE = 1.135;
const PGFPLOTS_BOX_X_TICKLABEL_BASELINE_SHIFT = parseDimension("0.8pt", {});
const PGFPLOTS_DEFAULT_MAX_SPACE_BETWEEN_TICKS = parseDimension("35pt", {});
const TEX_PT_PER_CM = 28.45274;
const PGF_DEFAULT_NODE_INNER_SEP_PT = 3.333;
const PGF_DEFAULT_NODE_OUTER_EXTENT_PT = 0.4;
const CMR8_DIGIT_WIDTH_SCALE = 0.531258 / 0.5;
const CMR8_MULTILINE_LAYOUT_X_COMPENSATION_PT = 1.654;
const CMR8_MULTILINE_LAYOUT_BOTTOM_COMPENSATION_PT = 1.125;
// The legacy left-axis style uses yshift=.3em. The SVG math paint box extends
// farther above its node center than TeX's glyph box, so retain this calibrated
// correction for non-middle axes.
const PGFPLOTS_LEGACY_Y_SCALE_LABEL_SHIFT = parseDimension("1.55pt", {});
// In the current PGFPlots compatibility styles, an y scale label on a middle
// axis is placed at `yticklabel* cs:1.03,-0.3em` with the anchor opposite the
// left-side tick labels. Keep those two directions explicit: the 3% follows
// the axis height, while the normal offset starts beyond the centered tick.
const PGFPLOTS_MIDDLE_Y_SCALE_LABEL_NORMAL_OFFSET = parseDimension("0.3em", {});

export function createAxisTickModel(axisOptions = {}, ranges = {}, addplots = []) {
  return {
    x: createTickAxisModel("x", axisOptions, ranges, addplots),
    y: createTickAxisModel("y", axisOptions, ranges, addplots)
  };
}

export function createTickAxisModel(axis, axisOptions = {}, ranges = {}, addplots = []) {
  const allDisabled = ticksDisabled(axisOptions.ticks) || ticksDisabled(axisOptions.tick);
  const raw = axis === "x" ? axisOptions.xtick ?? axisOptions["x tick"] : axisOptions.ytick ?? axisOptions["y tick"];
  const disabled = allDisabled || pgfplotsAxisHidden(axisOptions, axis) || ticksDisabled(raw);
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
        : axisMajorTickValues(axisOptions, axis, min, max, axis === "x" ? 7 : 6);
  return { disabled, explicit, values };
}

export function renderAxisTicks(axisOptions = {}, addplots = [], ranges = {}, geometry = {}) {
  return [
    ...renderAxisTickPass(axisOptions, addplots, ranges, geometry),
    ...renderExtraAxisTickPasses(axisOptions, addplots, ranges, geometry)
  ];
}

function renderAxisTickPass(axisOptions = {}, addplots = [], ranges = {}, geometry = {}) {
  const commands = [];
  const allTicksDisabled = ticksDisabled(axisOptions.ticks) || ticksDisabled(axisOptions.tick);
  const minorTicksDisabled = Boolean(axisOptions["pgfplots disable minor ticks"]);
  const xLineMode = specificAxisLineMode(axisOptions, "x");
  const yLineMode = specificAxisLineMode(axisOptions, "y");
  const xTicksDisabled = allTicksDisabled || pgfplotsAxisHidden(axisOptions, "x") || xLineMode === "none" || ticksDisabled(axisOptions.xtick) || ticksDisabled(axisOptions["x tick"]);
  const yTicksDisabled = allTicksDisabled || pgfplotsAxisHidden(axisOptions, "y") || yLineMode === "none" || ticksDisabled(axisOptions.ytick) || ticksDisabled(axisOptions["y tick"]);
  const xDistanceTicks = tickDistanceValues(axisOptions, "x", ranges.xMin, ranges.xMax);
  const yDistanceTicks = tickDistanceValues(axisOptions, "y", ranges.yMin, ranges.yMax);
  // PGFPlots selects automatic major-step candidates from the final axis
  // transform range. The displayed labels are still filtered against the
  // surveyed data range below. This matters for enlarged middle axes: a
  // domain such as 0.01:8 becomes roughly -0.8:8.8 and should select unit
  // ticks, not half-unit ticks.
  const xTickPlanningRange = automaticTickPlanningRange(axisOptions, "x", ranges, geometry);
  const yTickPlanningRange = automaticTickPlanningRange(axisOptions, "y", ranges, geometry);
  const explicitXTicks = xTicksDisabled || hasExplicitTickOption(axisOptions.xtick) || xDistanceTicks.length > 0;
  const explicitYTicks = yTicksDisabled || hasExplicitTickOption(axisOptions.ytick) || yDistanceTicks.length > 0;
  const rawXTicks = xTicksDisabled
    ? []
    : hasExplicitTickOption(axisOptions.xtick)
    ? axisTickValues(axisOptions.xtick, "x", addplots)
    : xDistanceTicks.length
    ? xDistanceTicks
    : autoMajorTickValues(
      axisOptions,
      "x",
      xTickPlanningRange.min,
      xTickPlanningRange.max,
      axisAutoMajorTickCountForOptions(axisOptions, "x", xTickPlanningRange.min, xTickPlanningRange.max, geometry, 7)
    );
  const rawYTicks = yTicksDisabled
    ? []
    : hasExplicitTickOption(axisOptions.ytick)
    ? axisTickValues(axisOptions.ytick, "y", addplots)
    : yDistanceTicks.length
    ? yDistanceTicks
    : autoMajorTickValues(
      axisOptions,
      "y",
      yTickPlanningRange.min,
      yTickPlanningRange.max,
      axisAutoMajorTickCountForOptions(axisOptions, "y", yTickPlanningRange.min, yTickPlanningRange.max, geometry, 6)
    );
  const xTicks = explicitXTicks ? rawXTicks : rawXTicks.filter((tick) => !autoTickOutsideRange(tick, ranges.xMin, ranges.xMax));
  const yTicks = explicitYTicks ? rawYTicks : rawYTicks.filter((tick) => !autoTickOutsideRange(tick, ranges.yMin, ranges.yMax));
  const xMinorTicks = xTicksDisabled || minorTicksDisabled
    ? []
    : axisMinorTickValues(axisOptions, "x", xTicks, ranges.xMin, ranges.xMax, addplots);
  const yMinorTicks = yTicksDisabled || minorTicksDisabled
    ? []
    : axisMinorTickValues(axisOptions, "y", yTicks, ranges.yMin, ranges.yMax, addplots);
  const xLabels = axisOptions["pgfplots symbolic x labels"]
    ? symbolicAxisTickLabels(axisOptions["pgfplots symbolic x labels"], xTicks)
    : axisOptions["pgfplots x interval tick labels"]
      ? intervalAxisTickLabels(xTicks, axisTickNumberFormat(axisOptions, "x"))
      : axisRenderedTickLabels(
        axisOptions,
        "x",
        axisOptions.xticklabels,
        xTicks,
        axisTickNumberFormat(axisOptions, "x"),
        axisOptions.xticklabel
      ).map((label, index) =>
    !explicitXTicks && autoTickOutsideRange(xTicks[index], ranges.xMin, ranges.xMax) ? "" : label
    );
  const yLabels = axisOptions["pgfplots symbolic y labels"]
    ? symbolicAxisTickLabels(axisOptions["pgfplots symbolic y labels"], yTicks)
    : axisRenderedTickLabels(
      axisOptions,
      "y",
      axisOptions.yticklabels,
      yTicks,
      axisTickNumberFormat(axisOptions, "y"),
      axisOptions.yticklabel
    ).map((label, index) =>
    !explicitYTicks && autoTickOutsideRange(yTicks[index], ranges.yMin, ranges.yMax) ? "" : label
    );
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const xTickLabelDistance = explicitNonnegativeDimension(axisOptions["x axis tick label distance"]);
  const yTickLabelDistance = explicitNonnegativeDimension(axisOptions["y axis tick label distance"]);
  const xTickColor = axisOptions["x axis tick color"] || axisOptions["axis tick color"] || "gray";
  const yTickColor = axisOptions["y axis tick color"] || axisOptions["axis tick color"] || "gray";
  const xTickLabelColor = axisOptions["x axis tick label color"] || "";
  const yTickLabelColor = axisOptions["y axis tick label color"] || "";
  const minorTickLength = parseDimension(String(axisOptions["minor tick length"] || axisOptions.subtickwidth || "0.1cm"), {});
  const xTickStyle = joinOptions([
    "axis tick",
    axisTickColor(axisOptions, xTickColor),
    `line width=${axisTickLineWidth(axisOptions)}`,
    axisTickDrawStyle(axisOptions, "x", "major")
  ]);
  const yTickStyle = joinOptions([
    "axis tick",
    axisTickColor(axisOptions, yTickColor),
    `line width=${axisTickLineWidth(axisOptions)}`,
    axisTickDrawStyle(axisOptions, "y", "major")
  ]);
  const xMinorTickStyle = joinOptions([
    "axis minor tick",
    axisTickColor(axisOptions, xTickColor),
    `line width=${axisTickLineWidth(axisOptions)}`,
    axisTickDrawStyle(axisOptions, "x", "minor")
  ]);
  const yMinorTickStyle = joinOptions([
    "axis minor tick",
    axisTickColor(axisOptions, yTickColor),
    `line width=${axisTickLineWidth(axisOptions)}`,
    axisTickDrawStyle(axisOptions, "y", "minor")
  ]);
  const xMajorTickVisual = axisTickVisualRenderConfig(axisOptions, "x", "major", tickLength, xTickStyle);
  const yMajorTickVisual = axisTickVisualRenderConfig(axisOptions, "y", "major", tickLength, yTickStyle);
  const xMinorTickVisual = axisTickVisualRenderConfig(axisOptions, "x", "minor", minorTickLength, xMinorTickStyle);
  const yMinorTickVisual = axisTickVisualRenderConfig(
    axisOptions,
    "y",
    "minor",
    minorTickLength,
    yMinorTickStyle
  );
  const middleAxis = isMiddleAxis(axisOptions);
  const xTickAlignment = normalizedTickAlignment(axisOptions, "x", middleAxis);
  const yTickAlignment = normalizedTickAlignment(axisOptions, "y", middleAxis);
  const xTickLabelsOnUpperSide = boxTickLabelsUseUpperSide(axisOptions, "x");
  const yTickLabelsOnUpperSide = boxTickLabelsUseUpperSide(axisOptions, "y");
  const xTickLabelFont = pgfplotsRoleFontCommand("tick", axisOptions, axisTickLabelFontOption(axisOptions, "x"));
  const yTickLabelFont = pgfplotsRoleFontCommand("tick", axisOptions, axisTickLabelFontOption(axisOptions, "y"));
  const xTickLabelTextWidthScale = pgfplotsTickLabelTextWidthScale(xTickLabelFont);
  const yTickLabelTextWidthScale = pgfplotsTickLabelTextWidthScale(yTickLabelFont);
  const xTickLabelInnerSep = axisTickLabelInnerSep(axisOptions, "x");
  const yTickLabelInnerSep = axisTickLabelInnerSep(axisOptions, "y");
  const xTickLabelStyle = axisTickLabelStyleOptions(axisOptions, "x");
  const yTickLabelStyle = axisTickLabelStyleOptions(axisOptions, "y");
  const hideOutOfRangeTickLabels = Boolean(axisOptions["datavis hide out of range tick labels"]);
  const cleanAxisOffset = axisOptions["datavis clean axes"] ? parseAxisCleanPadding(axisOptions) : 0;
  const oppositeXBoxTicks = shouldRenderBoxOppositeTicks(axisOptions, "x");
  const oppositeYBoxTicks = shouldRenderBoxOppositeTicks(axisOptions, "y");
  const innerBoxTicks = shouldRenderInsideBoxTicks(axisOptions);
  const boxRanges = isBoxAxis(axisOptions) ? geometry.transformRanges || ranges : ranges;
  const yAxis = xLineMode === "top"
    ? boxRanges.yMax
    : middleAxis && ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : boxRanges.yMin;
  const xAxis = yLineMode === "right"
    ? boxRanges.xMax
    : middleAxis && ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : boxRanges.xMin;
  xMinorTicks.forEach((x) => {
    if (shouldHideObscuredAxisTick(axisOptions, "x", x, ranges)) return;
    const base = geometry.mapPoint({ x, y: axisTickBaseValue(xMinorTickVisual, "y", yAxis, ranges) });
    if (cleanAxisOffset) base.y -= cleanAxisOffset;
    const [from, to] =
      middleAxis && !xMinorTickVisual
        ? alignedMiddleAxisTickSegment(base, "x", minorTickLength, xTickAlignment)
        : axisTickSegment(base, xMinorTickVisual, "x", 0, innerBoxTicks ? minorTickLength : -minorTickLength);
    commands.push(`\\draw[${xMinorTickVisual?.style || xMinorTickStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  });
  xTicks.forEach((x, index) => {
    if (shouldHideObscuredAxisTick(axisOptions, "x", x, ranges)) return;
    const base = geometry.mapPoint({ x, y: axisTickBaseValue(xMajorTickVisual, "y", yAxis, ranges) });
    if (cleanAxisOffset) base.y -= cleanAxisOffset;
    const intervalLabelX = axisOptions["pgfplots x interval tick labels"] && Number.isFinite(xTicks[index + 1])
      ? (x + xTicks[index + 1]) / 2
      : x;
    const labelBase = geometry.mapPoint({
      x: intervalLabelX,
      y: xTickLabelsOnUpperSide && isBoxAxis(axisOptions)
        ? boxRanges.yMax
        : axisTickBaseValue(xMajorTickVisual, "y", yAxis, ranges)
    });
    if (cleanAxisOffset) labelBase.y -= cleanAxisOffset;
    const [from, to] =
      middleAxis && !xMajorTickVisual
        ? alignedMiddleAxisTickSegment(base, "x", tickLength, xTickAlignment)
        : axisTickSegment(base, xMajorTickVisual, "x", 0, innerBoxTicks ? tickLength : -tickLength);
    commands.push(`\\draw[${xMajorTickVisual?.style || xTickStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    if (oppositeXBoxTicks) {
      const topBase = geometry.mapPoint({ x, y: boxRanges.yMax });
      commands.push(`\\draw[${xTickStyle}] ${formatAxisPoint(topBase)} -- ${formatAxisPoint(offsetPoint(topBase, 0, innerBoxTicks ? -tickLength : tickLength))};`);
    }
    const shouldShowXLabel = !(hideOutOfRangeTickLabels && autoTickOutsideRange(x, ranges.xMin, ranges.xMax));
    if (xMajorTickVisual && shouldShowXLabel) {
      for (const spec of axisTickVisualLabelSpecs(xMajorTickVisual, from, to)) {
        const multilineLayout = multilineTickLabelLayoutOptions(
          xLabels[index],
          xTickLabelFont,
          xTickLabelStyle,
          xTickLabelInnerSep
        );
        const labelStyle = joinOptions([
          "axis tick label",
          "tikzkit skip implicit node bbox",
          `anchor=${axisTickLabelAnchor(xTickLabelStyle, spec.anchor, "x")}`,
          axisTickLabelRotation(xTickLabelStyle),
          axisTickLabelAlignment(xTickLabelStyle),
          ...axisTickLabelPositionOptions(xTickLabelStyle),
          `font=${xTickLabelFont}`,
          xTickLabelTextWidthScale,
          tickLabelNeedsLayoutBox(axisOptions, "x", xLineMode, xTickLabelStyle) ? "tikzkit layout bbox" : "",
          xTickLabelInnerSep !== undefined ? `inner sep=${xTickLabelInnerSep}` : "",
          ...multilineLayout.options,
          axisTickLabelTextOption(xTickLabelStyle, xTickLabelColor)
        ]);
        if (xLabels[index] !== "") commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(spec.point)} {${xLabels[index]}};`);
      }
    } else if (!xMajorTickVisual && shouldShowXLabel) {
      const multilineLayout = multilineTickLabelLayoutOptions(
        xLabels[index],
        xTickLabelFont,
        xTickLabelStyle,
        xTickLabelInnerSep
      );
      const labelStyle = joinOptions([
        "axis tick label",
        "tikzkit skip implicit node bbox",
        `anchor=${axisTickLabelAnchor(xTickLabelStyle, xTickLabelsOnUpperSide ? "south" : "north", "x")}`,
        axisTickLabelRotation(xTickLabelStyle),
        axisTickLabelAlignment(xTickLabelStyle),
        ...axisTickLabelPositionOptions(xTickLabelStyle),
        `font=${xTickLabelFont}`,
        xTickLabelTextWidthScale,
        tickLabelNeedsLayoutBox(axisOptions, "x", xLineMode, xTickLabelStyle) ? "tikzkit layout bbox" : "",
        xTickLabelInnerSep !== undefined ? `inner sep=${xTickLabelInnerSep}` : "",
        ...multilineLayout.options,
        axisTickLabelTextOption(xTickLabelStyle, xTickLabelColor)
      ]);
      const labelDistance = Number.isFinite(xTickLabelDistance)
        ? xTickLabelDistance
        : defaultTickLabelDistance(axisOptions, "x", tickLength, xTickAlignment, {
            explicitNorthSouthAnchor: multilineLayout.nativeNodeBox
          });
      if (xLabels[index] !== "") {
        commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(offsetPoint(labelBase, 0, xTickLabelsOnUpperSide ? labelDistance : -labelDistance))} {${xLabels[index]}};`);
      }
    }
  });
  yMinorTicks.forEach((y) => {
    if (shouldHideObscuredAxisTick(axisOptions, "y", y, ranges)) return;
    const base = geometry.mapPoint({ x: axisTickBaseValue(yMinorTickVisual, "x", xAxis, ranges), y });
    if (cleanAxisOffset) base.x -= cleanAxisOffset;
    const [from, to] =
      middleAxis && !yMinorTickVisual
        ? alignedMiddleAxisTickSegment(base, "y", minorTickLength, yTickAlignment)
        : axisTickSegment(base, yMinorTickVisual, "y", innerBoxTicks ? minorTickLength : -minorTickLength, 0);
    commands.push(`\\draw[${yMinorTickVisual?.style || yMinorTickStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
  });
  yTicks.forEach((y, index) => {
    if (shouldHideObscuredAxisTick(axisOptions, "y", y, ranges)) return;
    const base = geometry.mapPoint({ x: axisTickBaseValue(yMajorTickVisual, "x", xAxis, ranges), y });
    if (cleanAxisOffset) base.x -= cleanAxisOffset;
    const schoolBookOriginLabel = isDatavisualizationSchoolBookOriginLabel(axisOptions, "y", y, ranges);
    const [from, to] =
      middleAxis && !yMajorTickVisual
        ? alignedMiddleAxisTickSegment(base, "y", tickLength, yTickAlignment)
        : axisTickSegment(base, yMajorTickVisual, "y", innerBoxTicks ? tickLength : -tickLength, 0);
    if (!schoolBookOriginLabel) {
      commands.push(`\\draw[${yMajorTickVisual?.style || yTickStyle}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    }
    if (oppositeYBoxTicks) {
      const rightBase = geometry.mapPoint({ x: boxRanges.xMax, y });
      commands.push(`\\draw[${yTickStyle}] ${formatAxisPoint(rightBase)} -- ${formatAxisPoint(offsetPoint(rightBase, innerBoxTicks ? -tickLength : tickLength, 0))};`);
    }
    const shouldShowYLabel = !(hideOutOfRangeTickLabels && autoTickOutsideRange(y, ranges.yMin, ranges.yMax));
    if (yMajorTickVisual && shouldShowYLabel) {
      for (const spec of axisTickVisualLabelSpecs(yMajorTickVisual, from, to)) {
        const labelStyle = joinOptions([
          "axis tick label",
          "tikzkit skip implicit node bbox",
          `anchor=${axisTickLabelAnchor(yTickLabelStyle, spec.anchor, "y")}`,
          axisTickLabelRotation(yTickLabelStyle),
          axisTickLabelAlignment(yTickLabelStyle),
          ...axisTickLabelPositionOptions(yTickLabelStyle),
          `font=${yTickLabelFont}`,
          yTickLabelTextWidthScale,
          tickLabelNeedsLayoutBox(axisOptions, "y", yLineMode) ? "tikzkit layout bbox" : "",
          yTickLabelInnerSep !== undefined ? `inner sep=${yTickLabelInnerSep}` : "",
          axisTickLabelTextOption(yTickLabelStyle, yTickLabelColor)
        ]);
        if (yLabels[index] !== "") commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(spec.point)} {${yLabels[index]}};`);
      }
    } else if (!yMajorTickVisual && shouldShowYLabel) {
      const rightSide = yLineMode === "right" || (isBoxAxis(axisOptions) && yTickLabelsOnUpperSide);
      const labelBase = rightSide && isBoxAxis(axisOptions)
        ? geometry.mapPoint({ x: boxRanges.xMax, y })
        : base;
      const labelStyle = joinOptions([
        "axis tick label",
        "tikzkit skip implicit node bbox",
        `anchor=${axisTickLabelAnchor(yTickLabelStyle, schoolBookOriginLabel ? "north east" : rightSide ? "west" : "east", "y")}`,
        axisTickLabelRotation(yTickLabelStyle),
        axisTickLabelAlignment(yTickLabelStyle),
        ...axisTickLabelPositionOptions(yTickLabelStyle),
        `font=${yTickLabelFont}`,
        yTickLabelTextWidthScale,
        tickLabelNeedsLayoutBox(axisOptions, "y", yLineMode) ? "tikzkit layout bbox" : "",
        yTickLabelInnerSep !== undefined ? `inner sep=${yTickLabelInnerSep}` : "",
        axisTickLabelTextOption(yTickLabelStyle, yTickLabelColor)
      ]);
      const labelDistance = Number.isFinite(yTickLabelDistance) ? yTickLabelDistance : defaultTickLabelDistance(axisOptions, "y", tickLength, yTickAlignment);
      const labelPoint = schoolBookOriginLabel
        ? labelBase
        : offsetPoint(labelBase, rightSide ? labelDistance : -labelDistance, 0);
      commands.push(`\\node[${labelStyle}] at ${formatAxisPoint(labelPoint)} {${yLabels[index]}};`);
    }
  });
  commands.push(...renderTickScaleLabel(axisOptions, "x", xTicks, geometry, xTickLabelsOnUpperSide ? "top" : xLineMode));
  commands.push(...renderTickScaleLabel(axisOptions, "y", yTicks, geometry, yTickLabelsOnUpperSide ? "right" : yLineMode));
  return commands;
}

function renderExtraAxisTickPasses(axisOptions = {}, addplots = [], ranges = {}, geometry = {}) {
  const commands = [];
  for (const axis of ["x", "y"]) {
    const pass = extraAxisTickPassOptions(axisOptions, axis, addplots, ranges);
    if (!pass) continue;
    commands.push(...renderExtraAxisGrid(pass, axis, ranges, geometry));
    commands.push(...renderAxisTickPass(pass, addplots, ranges, geometry));
  }
  return commands;
}

export function extraAxisTickPassOptions(axisOptions = {}, axis = "x", addplots = [], ranges = {}) {
  const rawTicks = axisOptions[`extra ${axis} ticks`];
  if (!hasExplicitTickOption(rawTicks) || ticksDisabled(rawTicks)) return null;
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  const values = axisTickValues(rawTicks, axis, addplots).filter((value) =>
    Number.isFinite(value) && (!Number.isFinite(min) || value >= min - 1e-9) && (!Number.isFinite(max) || value <= max + 1e-9)
  );
  if (!values.length) return null;

  const pass = mergeExtraTickScope(axisOptions, axis);
  pass[`${axis}tick`] = `{${values.join(",")}}`;
  for (const other of ["x", "y", "z"].filter((candidate) => candidate !== axis)) {
    pass[`${other}tick`] = "\\empty";
  }
  for (const candidate of ["x", "y", "z"]) pass[`minor ${candidate} tick num`] = 0;
  pass["pgfplots disable minor ticks"] = true;
  pass[`hide obscured ${axis} ticks`] = false;
  pass["scaled ticks"] = false;
  pass["scaled x ticks"] = false;
  pass["scaled y ticks"] = false;
  delete pass[`pgfplots symbolic ${axis} labels`];
  delete pass[`pgfplots ${axis} interval tick labels`];
  delete pass[`${axis}ticklabels`];
  const explicitLabels = axisOptions[`extra ${axis} tick labels`];
  if (explicitLabels !== undefined) pass[`${axis}ticklabels`] = explicitLabels;
  const explicitTemplate = axisOptions[`extra ${axis} tick label`];
  if (explicitTemplate !== undefined) pass[`${axis}ticklabel`] = explicitTemplate;
  if (axisTickNumberFormat(pass, axis).precision === undefined) {
    pass["tick label style"] = joinOptions([
      pass["tick label style"] || "",
      "/pgf/number format/precision=2"
    ]);
  }
  pass["pgfplots extra tick pass"] = axis;
  pass["pgfplots extra tick values"] = values;
  return pass;
}

function mergeExtraTickScope(axisOptions, axis) {
  const merged = { ...axisOptions };
  for (const rawStyle of [axisOptions["extra tick style"], axisOptions[`extra ${axis} tick style`]]) {
    for (const value of Array.isArray(rawStyle) ? rawStyle : [rawStyle]) {
      if (value === undefined || value === null || value === true || value === false || String(value).trim() === "") continue;
      const parsed = parseOptions(stripBalancedOuterBracesForList(String(value).trim()));
      for (const [key, styleValue] of Object.entries(parsed)) {
        if (isComposableAxisStyle(key) && merged[key] !== undefined) {
          merged[key] = joinOptions([String(merged[key]), String(styleValue)]);
        } else {
          merged[key] = styleValue;
        }
      }
    }
  }
  return merged;
}

function isComposableAxisStyle(key) {
  return /(?:^|\s)(?:style|ticklabel style)$/.test(String(key));
}

function renderExtraAxisGrid(axisOptions, axis, ranges, geometry) {
  if (!axisGridEnabled(axisOptions, axis)) return [];
  const values = axisOptions["pgfplots extra tick values"] || [];
  const spanRanges = geometry.lineRanges || geometry.transformRanges || ranges;
  const style = joinOptions([
    "axis grid",
    axisOptions["axis grid color"] || "black!25",
    `line width=${axisOptions["axis grid line width"] || "0.4pt"}`,
    axisOptions["grid style"] || axisOptions["major grid style"] || "",
    axisOptions[`${axis} major grid style`] || ""
  ]);
  return values.map((value) => {
    const from = axis === "x"
      ? geometry.mapPoint({ x: value, y: spanRanges.yMin })
      : geometry.mapPoint({ x: spanRanges.xMin, y: value });
    const to = axis === "x"
      ? geometry.mapPoint({ x: value, y: spanRanges.yMax })
      : geometry.mapPoint({ x: spanRanges.xMax, y: value });
    return `\\draw[${style}] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`;
  });
}

function axisGridEnabled(axisOptions, axis) {
  const specific = axis === "x"
    ? axisOptions["x grid"] ?? axisOptions.xgrid ?? axisOptions.xmajorgrids
    : axisOptions["y grid"] ?? axisOptions.ygrid ?? axisOptions.ymajorgrids;
  const raw = specific === undefined || specific === null || specific === "" ? axisOptions.grid : specific;
  const value = String(raw || "").trim().toLowerCase();
  return Boolean(value) && !["false", "none", "minor", "off"].includes(value);
}

function automaticTickPlanningRange(axisOptions = {}, axis, ranges = {}, geometry = {}) {
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  if (!isMiddleAxis(axisOptions) || !axisTransformRangeIsEnlarged(geometry, axis, min, max)) {
    return { min, max };
  }
  const transformedMin = Number(geometry.transformRanges?.[`${axis}Min`]);
  const transformedMax = Number(geometry.transformRanges?.[`${axis}Max`]);
  return Number.isFinite(transformedMin) && Number.isFinite(transformedMax) && transformedMax > transformedMin
    ? { min: transformedMin, max: transformedMax }
    : { min, max };
}

function multilineTickLabelLayoutOptions(label, fontCommand = "", labelStyle = {}, innerSep = undefined) {
  const lines = String(label || "").split(/\\\\(?:\[[^\]]*\])?/).map((line) => line.trim());
  const font = standardLatexFontMetrics(fontCommand);
  const centered = axisTickLabelAlignment(labelStyle) === "align=center";
  if (lines.length < 2 || !font) return { options: [], nativeNodeBox: false };
  if (!centered) {
    return /\\footnotesize\b/.test(String(fontCommand || ""))
      ? {
          options: [
            "tikzkit layout bbox x padding=2.36pt",
            "tikzkit layout bbox bottom padding=3pt"
          ],
          nativeNodeBox: false
        }
      : { options: [], nativeNodeBox: false };
  }

  const metrics = lines.map((line) => measurePlainTextTeXBoxPt(line, { fontSizePt: font.sizePt }));
  if (metrics.some((metric) => !metric)) return { options: [], nativeNodeBox: false };

  const innerSepPt = tickLabelInnerSepPt(innerSep);
  const first = metrics[0];
  const last = metrics.at(-1);
  const heightPt =
    first.height +
    font.baselineSkipPt * (lines.length - 1) +
    Math.max(0, last.depth) +
    innerSepPt * 2 +
    PGF_DEFAULT_NODE_OUTER_EXTENT_PT;
  const options = [`minimum height=${heightPt.toFixed(3)}pt`];

  if (font.sizePt === 8 && lines.every((line) => /^[+\-]?\d+$/.test(line))) {
    const widthPt =
      Math.max(...metrics.map((metric) => metric.width * CMR8_DIGIT_WIDTH_SCALE)) +
      innerSepPt * 2 +
      PGF_DEFAULT_NODE_OUTER_EXTENT_PT;
    options.unshift(`minimum width=${widthPt.toFixed(3)}pt`);
    // The SVG cropper works from painted glyph bounds, while PGF records the
    // full optical CMR8 hbox. Keep that invisible remainder separate from the
    // node dimensions so anchor=north still uses the native TeX box.
    options.push(
      `tikzkit layout bbox x padding=${CMR8_MULTILINE_LAYOUT_X_COMPENSATION_PT}pt`,
      `tikzkit layout bbox bottom padding=${CMR8_MULTILINE_LAYOUT_BOTTOM_COMPENSATION_PT}pt`
    );
  }
  return { options, nativeNodeBox: true };
}

function standardLatexFontMetrics(fontCommand = "") {
  const text = String(fontCommand || "");
  const profiles = [
    [/\\tiny\b/, 5, 6],
    [/\\scriptsize\b/, 7, 8],
    [/\\footnotesize\b/, 8, 9.5],
    [/\\small\b/, 9, 11],
    [/\\normalsize\b/, 10, 12],
    [/\\large\b/, 12, 14],
    [/\\Large\b/, 14.4, 18],
    [/\\LARGE\b/, 17.28, 22],
    [/\\huge\b/, 20.74, 25],
    [/\\Huge\b/, 24.88, 30]
  ];
  const match = profiles.find(([pattern]) => pattern.test(text));
  return match ? { sizePt: match[1], baselineSkipPt: match[2] } : null;
}

function tickLabelInnerSepPt(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false || String(raw).trim() === "") {
    return PGF_DEFAULT_NODE_INNER_SEP_PT;
  }
  const value = parseDimension(String(raw), {}) * TEX_PT_PER_CM;
  return Number.isFinite(value) && value >= 0 ? value : PGF_DEFAULT_NODE_INNER_SEP_PT;
}

function axisTickLabelFontOption(axisOptions = {}, axis) {
  const candidates = [
    axisOptions["axis tick label font"],
    fontFromStyle(axisOptions["tick label style"]),
    fontFromStyle(axisOptions["ticklabel style"]),
    fontFromStyle(axisOptions.ticklabelStyle),
    axisOptions[`${axis} tick label font`],
    axisOptions[`${axis}ticklabel font`],
    fontFromStyle(axisOptions[`${axis} tick label style`]),
    fontFromStyle(axisOptions[`${axis}ticklabel style`])
  ];
  return candidates.filter((value) => value !== undefined && value !== null && String(value).trim()).at(-1) || "";
}

function pgfplotsTickLabelTextWidthScale(fontCommand = "") {
  const scale = /\\scriptsize\b/.test(String(fontCommand || ""))
    ? PGFPLOTS_SCRIPTSIZE_TICK_LABEL_TEXT_WIDTH_SCALE
    : PGFPLOTS_TICK_LABEL_TEXT_WIDTH_SCALE;
  return `tikzkit text width scale=${scale}`;
}

export function axisTickLabelStyleOptions(axisOptions = {}, axis = "x") {
  const styles = [
    axisOptions["tick label style"],
    axisOptions["ticklabel style"],
    axisOptions.ticklabelStyle,
    axisOptions[`${axis} tick label style`],
    axisOptions[`${axis}ticklabel style`]
  ];
  const merged = {};
  for (const style of styles) {
    if (style === undefined || style === null || style === true || style === false) continue;
    Object.assign(merged, parseOptions(stripBalancedOuterBracesForList(String(style).trim())));
  }
  return merged;
}

export function axisTickLabelAnchor(style = {}, fallback = "center", axis = "") {
  if (style.anchor !== undefined && style.anchor !== null) {
    const explicit = String(style.anchor).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
    if (explicit) return explicit;
  }
  if (axisTickLabelRotation(style)) {
    if (axis === "x" && (fallback === "north" || fallback === "south")) {
      return fallback === "north" ? "near xticklabel" : "near xticklabel opposite";
    }
    if (axis === "y" && (fallback === "east" || fallback === "west")) {
      return fallback === "east" ? "near yticklabel" : "near yticklabel opposite";
    }
  }
  return fallback;
}

export function axisTickLabelRotation(style = {}) {
  const value = style.rotate;
  if (value === undefined || value === null || value === true || String(value).trim() === "") return "";
  return `rotate=${String(value).trim()}`;
}

export function axisTickLabelAlignment(style = {}) {
  const explicit = String(style.align || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim().toLowerCase();
  if (!["left", "flush left", "right", "flush right", "center", "flush center", "justify", "none"].includes(explicit)) {
    return "";
  }
  return `align=${explicit}`;
}

export function axisTickLabelPositionOptions(style = {}) {
  return ["shift", "xshift", "yshift"]
    .filter((key) => style[key] !== undefined && style[key] !== null && style[key] !== true && String(style[key]).trim() !== "")
    .map((key) => `${key}=${String(style[key]).trim()}`);
}

export function axisTickLabelTextOption(style = {}, fallback = "") {
  const value = style.text !== undefined && style.text !== null && style.text !== true ? style.text : fallback;
  return value === undefined || value === null || String(value).trim() === "" ? "" : `text=${String(value).trim()}`;
}

function axisTickDrawStyle(axisOptions = {}, axis = "x", kind = "major") {
  return joinOptions([
    axisOptions["tick style"] || "",
    axisOptions[`${kind} tick style`] || "",
    axisOptions[`${axis} tick style`] || axisOptions[`${axis}tick style`] || "",
    axisOptions[`${axis} ${kind} tick style`] || ""
  ]);
}

function fontFromStyle(rawStyle) {
  if (rawStyle === undefined || rawStyle === null || rawStyle === true || rawStyle === false) return "";
  return parseOptions(stripBalancedOuterBracesForList(String(rawStyle).trim())).font || "";
}

export function majorTickValues(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  const span = max - min;
  const rawStep = Math.abs(span) / Math.max(1, maxTicks - 1);
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const tolerance = 1e-9;
  const niceFraction =
    fraction < 1.5 - tolerance ? 1 : fraction < 3.5 - tolerance ? 2 : fraction < 7.5 - tolerance ? 5 : 10;
  const step = niceFraction * base;
  const start = Math.ceil(min / step) * step;
  const values = [];
  for (let value = start; value <= max + step * 0.2; value += step) {
    values.push(roundAxis(value));
    if (values.length >= 200) break;
  }
  return values;
}

export function axisMajorTickValues(axisOptions = {}, axis, min, max, maxTicks = 5) {
  return isLogAxis(axisOptions, axis)
    ? axisLogMajorTickValues(axisOptions, axis, min, max, maxTicks)
    : majorTickValues(min, max, maxTicks);
}

export function axisAutoMajorTickCount(axis, geometry = {}, fallback = 6, maxSpacing = PGFPLOTS_DEFAULT_MAX_SPACE_BETWEEN_TICKS) {
  const length = Number(axis === "x" ? geometry.width : geometry.height);
  if (!Number.isFinite(length) || length <= 0) return fallback;
  const targetSpacing = Number(maxSpacing);
  if (!Number.isFinite(targetSpacing) || targetSpacing <= 0) return fallback;
  return Math.max(2, Math.floor(length / targetSpacing) + 1);
}

export function axisAutoMajorTickCountForOptions(axisOptions = {}, axis, min, max, geometry = {}, fallback = 6) {
  const configuredSpacing = parseDimension(String(axisOptions["max space between ticks"] || "35pt"), {});
  const automaticCount = axisAutoMajorTickCount(axis, geometry, fallback, configuredSpacing);
  const scaledCount = axis === "y" && axisTickScale(axisOptions, "y", [min, max])
    ? Math.min(automaticCount, 6)
    : automaticCount;
  const requestedMinimum = Math.floor(Number(axisOptions["try min ticks"]));
  const count = Number.isFinite(requestedMinimum) && requestedMinimum >= 2
    ? Math.max(scaledCount, requestedMinimum)
    : scaledCount;
  const span = Number(max) - Number(min);
  if (
    axis === "x" &&
    isMiddleAxis(axisOptions) &&
    axisTransformRangeIsEnlarged(geometry, "x", min, max) &&
    Number.isFinite(span) &&
    span > 0 &&
    span <= 4
  ) {
    return Math.max(count, 7);
  }
  if (
    axis === "y" &&
    isMiddleAxis(axisOptions) &&
    middleAxisAllowsSparseYTicks(axisOptions) &&
    axisHasExplicitBounds(axisOptions, "y") &&
    Number.isFinite(span) &&
    span >= 1 &&
    span <= 3
  ) {
    return Math.min(count, 4);
  }
  return count;
}

function axisTransformRangeIsEnlarged(geometry = {}, axis, min, max) {
  const transformedMin = Number(geometry.transformRanges?.[`${axis}Min`]);
  const transformedMax = Number(geometry.transformRanges?.[`${axis}Max`]);
  const rawMin = Number(min);
  const rawMax = Number(max);
  if (![transformedMin, transformedMax, rawMin, rawMax].every(Number.isFinite)) return false;
  const spanScale = Math.max(Math.abs(rawMax - rawMin), Math.abs(transformedMax - transformedMin));
  const tolerance = spanScale * 1e-6;
  return transformedMin < rawMin - tolerance || transformedMax > rawMax + tolerance;
}

function axisHasExplicitBounds(axisOptions = {}, axis) {
  return hasAxisBoundOption(axisOptions[`${axis}min`]) || hasAxisBoundOption(axisOptions[`${axis}max`]);
}

function hasAxisBoundOption(value) {
  return value !== undefined && value !== null && value !== true && String(value).trim() !== "";
}

function middleAxisAllowsSparseYTicks(axisOptions = {}) {
  const raw = axisOptions.enlargelimits ?? axisOptions["enlarge x limits"] ?? axisOptions["enlarge y limits"];
  if (raw === undefined || raw === null || raw === "" || raw === true) return true;
  if (raw === false) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
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

function explicitMinorTickValues(axisOptions = {}, axis, addplots = []) {
  const raw =
    axisOptions[`${axis} minor tick values`] ??
    axisOptions[`minor ${axis}tick`] ??
    axisOptions[`minor ${axis} tick`];
  return hasExplicitTickOption(raw) ? axisTickValues(raw, axis, addplots) : null;
}

export function axisMinorTickValues(axisOptions = {}, axis, majorTicks = [], min, max, addplots = []) {
  const explicit = explicitMinorTickValues(axisOptions, axis, addplots);
  if (explicit) return explicit;
  return isLogAxis(axisOptions, axis)
    ? axisLogMinorTickValues(axisOptions, axis, majorTicks, min, max)
    : automaticMinorTickValues(axisOptions, axis, majorTicks, min, max);
}

function automaticMinorTickValues(axisOptions = {}, axis, majorTicks = [], min, max) {
  const raw = axisOptions[`minor ${axis} tick num`] ?? axisOptions["minor tick num"];
  if (!hasExplicitTickOption(raw)) return [];
  const minorTickNum = Number(raw);
  if (!Number.isInteger(minorTickNum) || minorTickNum === 0 || majorTicks.length < 2) return [];
  const values = [];
  const seen = new Set();
  const minNumber = Number(min);
  const maxNumber = Number(max);
  const tolerance = 1e-9;
  const numericMajorTicks = majorTicks.map(Number).filter(Number.isFinite);
  const firstStep = numericMajorTicks[1] - numericMajorTicks[0];
  const lastStep = numericMajorTicks.at(-1) - numericMajorTicks.at(-2);
  const intervalPairs = [
    [numericMajorTicks[0] - firstStep, numericMajorTicks[0]],
    ...numericMajorTicks.slice(0, -1).map((current, index) => [current, numericMajorTicks[index + 1]]),
    [numericMajorTicks.at(-1), numericMajorTicks.at(-1) + lastStep]
  ];
  for (const [current, next] of intervalPairs) {
    if (!Number.isFinite(current) || !Number.isFinite(next)) continue;
    const distance = (next - current) / (minorTickNum + 1);
    if (!Number.isFinite(distance) || Math.abs(distance) < 1e-12) continue;
    for (const minorIndex of foreachIntegerSequence(1, minorTickNum)) {
      const value = roundAxis(current + minorIndex * distance);
      if (Number.isFinite(minNumber) && value < minNumber - tolerance) continue;
      if (Number.isFinite(maxNumber) && value > maxNumber + tolerance) continue;
      const key = tickValueKey(value);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
  }
  return values;
}

function tickValueKey(value) {
  return Number(value).toFixed(12);
}

function foreachIntegerSequence(start, end) {
  const step = start <= end ? 1 : -1;
  const values = [];
  for (let value = start; step > 0 ? value <= end : value >= end; value += step) values.push(value);
  return values;
}

export function axisTickValues(raw, axis, addplots = []) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text || text === "\\empty" || text === "empty") return [];
  if (text === "data") {
    const values = addplots.flatMap((plot) => plot.points || []).map((point) => point[axis]).filter(Number.isFinite);
    return [...new Set(values)];
  }
  return axisNumberList(text);
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

function normalizedTickAlignment(axisOptions = {}, axis, middleAxis = false) {
  const keys = Object.keys(axisOptions);
  const alignment = latestOrderedOption(axisOptions, keys, ["tick align", `${axis} tick align`, `${axis}tick align`]);
  const middleLine = latestOrderedMiddleAxisOption(axisOptions, keys, axis);
  if (middleAxis && middleLine.index > alignment.index) return "center";
  const raw = alignment.value;
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "inside" || normalized === "outside" || normalized === "center") return normalized;
  return middleAxis ? "center" : "inside";
}

function latestOrderedOption(options, keys, candidates) {
  let latest = { index: -1, value: undefined };
  for (const key of candidates) {
    const index = keys.indexOf(key);
    if (index > latest.index) latest = { index, value: options[key] };
  }
  return latest;
}

function latestOrderedMiddleAxisOption(axisOptions, keys, axis) {
  let latest = { index: -1, value: undefined };
  for (const key of ["axis", "axis lines", `axis ${axis} line`, `axis ${axis} line*`]) {
    const index = keys.indexOf(key);
    const value = String(axisOptions[key] || "").trim().toLowerCase();
    if (index > latest.index && (value === "middle" || value === "center")) {
      latest = { index, value };
    }
  }
  return latest;
}

function tickAlignmentOffsetFactor(alignment) {
  if (alignment === "outside") return 1;
  if (alignment === "center") return 0.5;
  return 0;
}

function alignedMiddleAxisTickSegment(base, tickAxis, tickLength, alignment) {
  const offset = tickLength * tickAlignmentOffsetFactor(alignment);
  const start = -offset;
  const end = tickLength - offset;
  if (tickAxis === "x") return [offsetPoint(base, 0, start), offsetPoint(base, 0, end)];
  return [offsetPoint(base, start, 0), offsetPoint(base, end, 0)];
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

function axisTickColor(axisOptions = {}, fallback) {
  if (axisOptions["x axis tick color"] || axisOptions["y axis tick color"] || axisOptions["axis tick color"]) return fallback;
  return isBoxAxis(axisOptions) ? "gray" : fallback;
}

function axisTickLineWidth(axisOptions = {}) {
  if (axisOptions["axis tick line width"]) return axisOptions["axis tick line width"];
  return "0.2pt";
}

function shouldRenderBoxOppositeTicks(axisOptions = {}, axis = "x") {
  if (specificAxisLineMode(axisOptions, axis)) return false;
  if (axisOptions["datavis boxed axes"]) return String((axisOptions["axis lines"] ?? axisOptions.axis) || "").trim().toLowerCase() === "box";
  return isBoxAxis(axisOptions);
}

function shouldRenderInsideBoxTicks(axisOptions = {}) {
  if (axisOptions["datavis boxed axes"]) return axisOptions["datavis tick direction"] === "inner";
  return isBoxAxis(axisOptions);
}

function defaultTickLabelDistance(axisOptions = {}, axis = "x", tickLength = 0, alignment = "inside", placement = {}) {
  if (isMiddleAxis(axisOptions)) return tickLength * tickAlignmentOffsetFactor(alignment);
  if (!isBoxAxis(axisOptions)) return tickLength * 1.55;
  // A near-ticklabel anchor places the node's layout boundary on the axis.
  // The x label needs the small TeX baseline/depth compensation measured by
  // the native text box. Outside/centered tick protrusion remains geometric.
  const baselineShift = axis === "x" && !placement.explicitNorthSouthAnchor
    ? PGFPLOTS_BOX_X_TICKLABEL_BASELINE_SHIFT
    : 0;
  return baselineShift + tickLength * tickAlignmentOffsetFactor(alignment);
}

function explicitNonnegativeDimension(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false || String(raw).trim() === "") return NaN;
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const value = parseDimension(text, {});
  if (!Number.isFinite(value) || value < 0) return NaN;
  if (value > 0) return value;
  return /^[+\-]?(?:0+(?:\.0*)?|\.0+)\s*(?:cm|mm|pt|em|ex|in)?$/i.test(text) ? 0 : NaN;
}

export function axisTickLabelInnerSep(axisOptions = {}, axis = "x") {
  if (axisOptions["axis tick label inner sep"] !== undefined) return axisOptions["axis tick label inner sep"];
  const styles = [
    axisOptions["tick label style"],
    axisOptions["ticklabel style"],
    axisOptions.ticklabelStyle,
    axisOptions[`${axis} tick label style`],
    axisOptions[`${axis}ticklabel style`]
  ];
  let innerSep;
  for (const style of styles) {
    if (style === undefined || style === null || style === true || style === false) continue;
    const value = parseOptions(stripBalancedOuterBracesForList(String(style).trim()))["inner sep"];
    if (value !== undefined) innerSep = value;
  }
  return innerSep;
}

function isBoxAxis(axisOptions = {}) {
  if (axisOptions["hide axis"] || axisOptions.hide) return false;
  if (isMiddleAxis(axisOptions)) return false;
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === undefined || raw === null || raw === "" || raw === true) return true;
  return String(raw).trim().toLowerCase() === "box";
}

function boxTickLabelsUseUpperSide(axisOptions = {}, axis = "x") {
  if (!isBoxAxis(axisOptions)) return false;
  const raw = axisOptions[`${axis}ticklabel pos`] ?? axisOptions[`${axis} tick label pos`] ?? axisOptions.ticklabelpos ?? axisOptions["ticklabel pos"] ?? axisOptions["tick label pos"];
  const value = String(raw || "").trim().toLowerCase();
  if (value === "upper") return true;
  if (value === "lower") return false;
  return axis === "x" ? value === "top" : value === "right";
}

function tickLabelNeedsLayoutBox(axisOptions = {}, axis, lineMode = "", labelStyle = {}) {
  if (isBoxAxis(axisOptions)) return true;
  if (axisHasExplicitDescriptionPlacement(axisOptions)) return true;
  // TeX includes the complete rotated node rectangle (including inner sep)
  // in the picture bounding box, even where the painted glyphs are smaller.
  if (axis === "x" && axisTickLabelRotation(labelStyle)) return true;
  // TeX keeps the node's invisible inner sep in the picture bounding box.
  // For a left-side y scale this is what reserves the space before the
  // leftmost glyph, even when the visible text itself is already aligned.
  return axis === "y" && lineMode !== "right" && lineMode !== "none";
}

function specificAxisLineMode(axisOptions = {}, axis) {
  const raw = axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`];
  if (raw === undefined || raw === null || raw === "") return "";
  if (raw === false) return "none";
  const value = String(raw).trim().toLowerCase();
  if (value === "none" || value === "false" || value === "off" || value === "0") return "none";
  if (value === "top" || value === "right" || value === "bottom" || value === "left") return value;
  return value;
}

function symbolicAxisTickLabels(labels, ticks) {
  return ticks.map((tick) => {
    const index = Math.round(Number(tick));
    return Math.abs(Number(tick) - index) < 1e-8 ? labels[index] ?? "" : "";
  });
}

function scaledAxisTicks(axisOptions, axis, ticks) {
  const scale = axisTickScale(axisOptions, axis, ticks);
  if (!scale) return ticks;
  return ticks.map((tick) => roundAxis(tick * scale.factor));
}

function renderTickScaleLabel(axisOptions, axis, ticks, geometry, lineMode) {
  if (!ticks.length) return [];
  const scale = axisTickScale(axisOptions, axis, ticks);
  if (!scale || scale.displayExponent === 0) return [];
  const origin = geometry.origin || { x: 0, y: 0 };
  const width = Number(geometry.width) || 0;
  const height = Number(geometry.height) || 0;
  const centeredYAxis = axis === "y" && (lineMode === "middle" || lineMode === "center");
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const yTickAlignment = normalizedTickAlignment(axisOptions, "y", isMiddleAxis(axisOptions));
  const middleYAxisScaleOffset = tickLength * tickAlignmentOffsetFactor(yTickAlignment)
    + PGFPLOTS_MIDDLE_Y_SCALE_LABEL_NORMAL_OFFSET;
  const point = axis === "x"
    ? { x: origin.x + width, y: lineMode === "top" ? origin.y + height + 0.12 : origin.y - 0.48 }
    : centeredYAxis
      ? {
          x: origin.x - middleYAxisScaleOffset,
          y: origin.y + height * 1.03
        }
      : {
          x: lineMode === "right" ? origin.x + width : origin.x,
          y: origin.y + height + PGFPLOTS_LEGACY_Y_SCALE_LABEL_SHIFT
        };
  const anchor = axis === "x"
    ? "north east"
    : lineMode === "right"
      ? "south east"
      : centeredYAxis
        ? "south east"
        : "south west";
  const font = pgfplotsRoleFontCommand("tick", axisOptions, axisTickLabelFontOption(axisOptions, axis));
  return [`\\node[${joinOptions(["axis tick scale label", `anchor=${anchor}`, `font=${font}`, "inner sep=0pt"])}] at ${formatAxisPoint(point)} {$\\cdot 10^{${scale.displayExponent}}$};`];
}

function axisTickScale(axisOptions = {}, axis, ticks = []) {
  if (isLogAxis(axisOptions, axis)) return null;
  const labelStyle = axisTickLabelStyleOptions(axisOptions, axis);
  const raw = axisOptions[`scaled ${axis} ticks`] ?? axisOptions["scaled ticks"] ?? labelStyle[`scaled ${axis} ticks`] ?? labelStyle["scaled ticks"];
  if (raw === false) return null;
  const text = String(raw ?? "true").trim().toLowerCase();
  if (text === "false" || text === "none" || text === "off" || text === "0") return null;
  const baseMatch = text.match(/^base\s+10\s*:\s*([-+]?\d+)$/);
  if (!baseMatch) return text === "true" || !text ? automaticAxisTickScale(axisOptions, ticks) : null;
  const exponent = Number(baseMatch[1]);
  if (!Number.isFinite(exponent)) return null;
  return { factor: 10 ** exponent, displayExponent: -exponent };
}

function automaticAxisTickScale(axisOptions = {}, ticks = []) {
  const maxAbs = Math.max(0, ...ticks.map((tick) => Math.abs(Number(tick))).filter(Number.isFinite));
  if (!(maxAbs > 0)) return null;
  const exponent = Math.floor(Math.log10(maxAbs));
  const above = Number(axisOptions["scale ticks above exponent"] ?? 3);
  const below = Number(axisOptions["scale ticks below exponent"] ?? -1);
  if (!(exponent > (Number.isFinite(above) ? above : 3) || exponent < (Number.isFinite(below) ? below : -1))) {
    return null;
  }
  return { factor: 10 ** -exponent, displayExponent: exponent };
}

function shouldHideObscuredAxisTick(axisOptions, axis, value, ranges) {
  if (isDatavisualizationSchoolBookOriginLabel(axisOptions, axis, value, ranges)) return false;
  if (!obscuredAxisTicksEnabled(axisOptions, axis)) return false;
  const ownMode = effectiveAxisLineMode(axisOptions, axis);
  if (ownMode !== "middle" && ownMode !== "center") return false;

  const otherAxis = axis === "x" ? "y" : "x";
  const otherMode = effectiveAxisLineMode(axisOptions, otherAxis);
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  const tick = Number(value);
  if (![min, max, tick].every(Number.isFinite)) return false;
  const tolerance = Math.max(Math.abs(max - min) * 1e-9, 1e-9);
  const touches = (target) => Math.abs(tick - target) <= tolerance;

  if (otherMode === "middle" || otherMode === "center") {
    const crossing = Math.min(max, Math.max(min, 0));
    return touches(crossing);
  }
  if (otherMode === "left" || otherMode === "bottom") return touches(min);
  if (otherMode === "right" || otherMode === "top") return touches(max);
  if (otherMode === "none") return false;
  return touches(min) || touches(max);
}

function isDatavisualizationSchoolBookOriginLabel(axisOptions = {}, axis, value, ranges = {}) {
  if (axis !== "y" || !axisOptions["datavis school book y origin label"]) return false;
  const min = Number(ranges.yMin);
  const max = Number(ranges.yMax);
  const tick = Number(value);
  if (![min, max, tick].every(Number.isFinite) || !(min <= 0 && max >= 0)) return false;
  const tolerance = Math.max(Math.abs(max - min) * 1e-9, 1e-9);
  return Math.abs(tick) <= tolerance;
}

function obscuredAxisTicksEnabled(axisOptions, axis) {
  const raw = axisOptions[`hide obscured ${axis} ticks`];
  if (raw === undefined || raw === null || raw === "") return true;
  if (raw === false) return false;
  return !["false", "0", "off", "no"].includes(String(raw).trim().toLowerCase());
}

function effectiveAxisLineMode(axisOptions, axis) {
  const specific = specificAxisLineMode(axisOptions, axis);
  if (specific) return specific;
  const raw = axisOptions["axis lines"] ?? axisOptions.axis;
  if (raw === false) return "none";
  const common = String(raw ?? "box").trim().toLowerCase() || "box";
  if (common === "left") return axis === "x" ? "bottom" : "left";
  if (common === "right") return axis === "x" ? "top" : "right";
  return common;
}

function autoMajorTickValues(axisOptions, axis, min, max, maxTicks) {
  const values = axisMajorTickValues(axisOptions, axis, min, max, maxTicks);
  return shouldTrimAutoTerminalTicks(axisOptions) ? trimAutoTerminalTicks(values, min, max) : values;
}

function shouldTrimAutoTerminalTicks(axisOptions = {}) {
  return Boolean(axisOptions["datavis clean axes"]);
}

export function autoTickOutsideRange(value, min, max) {
  const low = Number(min);
  const high = Number(max);
  const tick = Number(value);
  if (![low, high, tick].every(Number.isFinite)) return false;
  const span = Math.abs(high - low) || 1;
  // PGFPlots may generate a convenient candidate just beyond the range, but
  // its tick preparation suppresses it before drawing. Keep enough leeway
  // for floating-point reconstruction only, never a visible fraction of a
  // major step.
  const epsilon = Math.max(span * 1e-10, Number.EPSILON * 16 * Math.max(1, Math.abs(low), Math.abs(high)));
  return tick < low - epsilon || tick > high + epsilon;
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

function axisTickLabels(raw, ticks, formatOptions = {}, template = "") {
  if (isEmptyTickLabelList(raw)) return ticks.map(() => "");
  const labels = splitBracedList(raw);
  if (labels.length) return ticks.map((_, index) => labels[index] ?? "");
  if (hasTickLabelTemplate(template)) {
    return ticks.map((tick) => renderTickLabelTemplate(template, tick, formatOptions));
  }
  return ticks.map((tick) => formatAxisTickLabel(tick, formatOptions));
}

export function axisRenderedTickLabels(axisOptions, axis, raw, ticks, formatOptions = {}, template = "") {
  if (
    isLogAxis(axisOptions, axis) &&
    !isEmptyTickLabelList(raw) &&
    splitBracedList(raw).length === 0 &&
    !hasTickLabelTemplate(template)
  ) {
    return ticks.map((tick) => axisLogTickLabel(axisOptions, axis, tick));
  }
  return axisTickLabels(raw, scaledAxisTicks(axisOptions, axis, ticks), formatOptions, template);
}

function hasTickLabelTemplate(template) {
  const text = String(template ?? "").trim();
  return Boolean(text) && text !== "true" && text !== "false";
}

export function renderTickLabelTemplate(template, tick, formatOptions = {}) {
  const text = stripBalancedOuterBracesForList(String(template).trim());
  return text
    .replace(
      /\\pgfmathprintnumber\s*(?:\[([^\]]*)\])?\s*(?:\{\s*\\tick\s*\}|\\tick\b)/g,
      (_, localOptions) => formatAxisTickLabel(
        tick,
        localOptions === undefined
          ? formatOptions
          : pgfNumberFormatOptions(parseOptions(localOptions), formatOptions)
      )
    )
    .replace(/\\tick\b/g, formatAxisTickLabel(tick, formatOptions));
}

function intervalAxisTickLabels(ticks, formatOptions = {}) {
  return ticks.map((tick, index) => {
    const next = ticks[index + 1];
    if (!Number.isFinite(next)) return "";
    return `${formatAxisTickLabel(tick, formatOptions)}--${formatAxisTickLabel(next, formatOptions)}`;
  });
}

export function axisTickNumberFormat(axisOptions = {}, axis) {
  return pgfNumberFormatOptions(axisTickLabelStyleOptions(axisOptions, axis));
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
  // Unlike general TikZ option lists, PGFPlots tick-label lists are positional:
  // `{0,$a$,, $b$,}` intentionally has five entries. Keep blank entries so a
  // later label cannot slide onto the wrong tick.
  return splitTopLevelPreservingEmpty(text, ",").map((part) => stripBalancedOuterBracesForList(part.trim()));
}

function splitTopLevelPreservingEmpty(input, delimiter = ",") {
  const parts = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);

    if (char === delimiter && !isEscapedListDelimiter(input, index) && paren === 0 && bracket === 0 && brace === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current.trim());
  return parts;
}

function isEscapedListDelimiter(input, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && input[cursor] === "\\"; cursor -= 1) backslashes += 1;
  return backslashes % 2 === 1;
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
