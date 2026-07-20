import { parseDimension } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { pgfplotsPictureFontScale, pgfplotsRoleFontCommand } from "./fonts.js";
import { isMiddleAxis } from "./geometry.js";
import { pgfplotsAxisHidden } from "./axisOptions.js";
import { parseTikzFontPatch } from "../tex/fontSpec.js";

const PGFPLOTS_MIDDLE_AXIS_TITLE_OFFSET = parseDimension("8.5pt", {});
const PGFPLOTS_AXIS_TITLE_SHIFT = parseDimension("6pt", {});
const PGFPLOTS_MIDDLE_AXIS_MATH_LABEL_BOTTOM_PADDING = "1.98pt";

export function createAxisLabelModel(axisOptions = {}) {
  return {
    title: axisOptions.title || "",
    x: axisOptions.xlabel || axisOptions["x label"] || "",
    y: axisOptions.ylabel || axisOptions["y label"] || "",
    z: axisOptions.zlabel || axisOptions["z label"] || ""
  };
}

export function renderAxisLabels(axisOptions = {}, ranges = {}, geometry = {}) {
  const commands = [];
  const xOffset = Math.max(0.28, geometry.width * 0.035);
  const yOffset = Math.max(0.22, geometry.height * 0.06);
  const middleAxis = isMiddleAxis(axisOptions);
  const xAxisMiddle = isAxisLineMiddle(axisOptions, "x");
  const yAxisMiddle = isAxisLineMiddle(axisOptions, "y");
  const labelFont = (axis) => roleFontOption("axisLabel", axisOptions, axisLabelFontOption(axisOptions, axis));
  const titleFont = roleFontOption("title", axisOptions, fontFromStyle(axisOptions["title style"]) || axisOptions["axis title font"]);
  const xLabelOffset = parseAxisLabelOffset(
    axisOptions["x axis label offset"],
    defaultXAxisLabelOffset(axisOptions, geometry, yOffset, xAxisMiddle)
  );
  const datavisLabelPlacement = String(axisOptions["datavis axis label placement"] || "").trim().toLowerCase();
  if (datavisLabelPlacement === "end") {
    const cleanAxisOffset = axisOptions["datavis clean axes"] ? parseAxisCleanPadding(axisOptions) : 0;
    if (axisOptions.xlabel && !pgfplotsAxisHidden(axisOptions, "x")) {
      const point = offsetPoint(geometry.mapPoint({ x: ranges.xMax, y: ranges.yMin }), Math.max(0.08, xOffset * 0.25), -cleanAxisOffset);
      commands.push(`\\node[${joinOptions(["axis label", labelFont("x") ? `font=${labelFont("x")}` : "", "anchor=west"])}] at ${formatAxisPoint(point)} {${axisLabelText(axisOptions.xlabel)}};`);
    }
    if (axisOptions.ylabel && !pgfplotsAxisHidden(axisOptions, "y")) {
      const point = offsetPoint(geometry.mapPoint({ x: ranges.xMin, y: ranges.yMax }), -cleanAxisOffset, Math.max(0.26, yOffset * 1.1));
      commands.push(`\\node[${joinOptions(["axis label", labelFont("y") ? `font=${labelFont("y")}` : "", "anchor=south"])}] at ${formatAxisPoint(point)} {${axisLabelText(axisOptions.ylabel)}};`);
    }
    if (axisOptions.title) {
      const point = offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMax }), 0, yOffset);
      commands.push(`\\node[${joinOptions(["axis label", titleFont ? `font=${titleFont}` : "", "anchor=south"])}] at ${formatAxisPoint(point)} {${axisLabelText(axisOptions.title)}};`);
    }
    return commands;
  }
  const labelRanges = (xAxisMiddle || yAxisMiddle) && (geometry.lineRanges || geometry.transformRanges)
    ? geometry.lineRanges || geometry.transformRanges
    : ranges;
  const yAxis =
    (ranges.yMin <= 0 && ranges.yMax >= 0) || (labelRanges.yMin <= 0 && labelRanges.yMax >= 0) ? 0 : ranges.yMin;
  const xAxis =
    (ranges.xMin <= 0 && ranges.xMax >= 0) || (labelRanges.xMin <= 0 && labelRanges.xMax >= 0) ? 0 : ranges.xMin;
  if (axisOptions.xlabel && !pgfplotsAxisHidden(axisOptions, "x")) {
    const xlabelStyle = axisOptions["xlabel style"] || axisOptions["x label style"];
    const point = xAxisMiddle
      ? geometry.mapPoint({ x: labelRanges.xMax, y: yAxis })
      : offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMin }), 0, -xLabelOffset);
    const placement = applyAxisLabelStyle(point, xAxisMiddle ? "south east" : "north", xlabelStyle, {
      geometry,
      xOffset,
      yOffset,
      defaultHorizontal: xAxisMiddle ? "right" : "center",
      defaultVertical: xAxisMiddle ? "above" : "below"
    });
    const labelOptions = [
      "axis label",
      "tikzkit layout bbox",
      ...middleAxisMathLabelLayoutOptions(axisOptions.xlabel, xlabelStyle, xAxisMiddle),
      `anchor=${placement.anchor}`,
      ...axisLabelVisualOptions(xlabelStyle),
      ...plainLabelWidthOptions(axisOptions.xlabel, xAxisMiddle)
    ];
    if (labelFont("x")) labelOptions.push(`font=${labelFont("x")}`);
    commands.push(`\\node[${joinOptions(labelOptions)}] at ${formatAxisPoint(placement.point)} {${axisLabelText(axisOptions.xlabel, xlabelStyle)}};`);
  }
  if (axisOptions.ylabel && !pgfplotsAxisHidden(axisOptions, "y")) {
    const ylabelStyle = axisOptions["ylabel style"] || axisOptions["y label style"];
    const rotation = axisLabelRotation(ylabelStyle, yAxisMiddle || datavisLabelPlacement === "upright" ? null : 90);
    const ylabelXOffset =
      datavisLabelPlacement === "upright" && !yAxisMiddle
        ? (axisOptions["datavis clean axes"] ? parseAxisCleanPadding(axisOptions) : 0) + Math.max(0.48, xOffset * 1.8)
        : isLeftOpenAxis(axisOptions)
          ? Math.max(xOffset * 1.65, 0.7)
          : Math.max(xOffset * 2.6, 1.1);
    const point = yAxisMiddle
      ? geometry.mapPoint({ x: xAxis, y: labelRanges.yMax })
      : offsetPoint(geometry.mapPoint({ x: ranges.xMin, y: (ranges.yMin + ranges.yMax) / 2 }), -ylabelXOffset, 0);
    const placement = applyAxisLabelStyle(
      point,
      yAxisMiddle ? "north west" : rotation !== null ? "center" : "east",
      ylabelStyle,
      {
      geometry,
      xOffset,
      yOffset,
      defaultAtShift: splitYAxisLabelDefaultShift(axisOptions),
      defaultHorizontal: yAxisMiddle ? "right" : "left",
      defaultVertical: yAxisMiddle ? "below" : "center"
      }
    );
    const labelOptions = [
      "axis label",
      "tikzkit layout bbox",
      `anchor=${placement.anchor}`,
      ...axisLabelVisualOptions(ylabelStyle),
      ...plainLabelWidthOptions(axisOptions.ylabel, yAxisMiddle)
    ];
    if (labelFont("y")) labelOptions.push(`font=${labelFont("y")}`);
    if (rotation !== null) labelOptions.push(`rotate=${rotation}`);
    commands.push(`\\node[${joinOptions(labelOptions)}] at ${formatAxisPoint(placement.point)} {${axisLabelText(axisOptions.ylabel, ylabelStyle)}};`);
  }
  if (axisOptions.title) {
    const titleStyle = axisOptions["title style"];
    const titleStyleOptions = parseOptions(String(titleStyle || ""));
    const styledPoint = axisDescriptionPoint(titleStyleOptions.at, geometry);
    const basePoint = styledPoint || geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMax });
    const defaultShift = middleAxis
      ? PGFPLOTS_MIDDLE_AXIS_TITLE_OFFSET
      : axisTitleDefaultShift(axisOptions);
    const point = offsetPoint(
      basePoint,
      explicitStyleShift(titleStyleOptions.xshift, 0),
      defaultShift + explicitStyleShift(titleStyleOptions.yshift, 0)
    );
    const titleOptions = [
      "axis label",
      "tikzkit layout bbox",
      titleFont ? `font=${titleFont}` : "",
      `anchor=${String(titleStyleOptions.anchor || "south").trim()}`,
      ...axisLabelVisualOptions(titleStyle)
    ];
    commands.push(`\\node[${joinOptions(titleOptions)}] at ${formatAxisPoint(point)} {${axisLabelText(axisOptions.title, titleStyle)}};`);
  }
  return commands;
}

function axisTitleDefaultShift(axisOptions = {}) {
  const explicit = axisOptions["every axis title shift"];
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    const parsed = parseDimension(String(explicit), {});
    if (Number.isFinite(parsed)) return parsed;
  }
  if (axisOptions.footnotesize || axisOptions.tiny) return 0;
  return PGFPLOTS_AXIS_TITLE_SHIFT;
}

function axisLabelFontOption(axisOptions = {}, axis) {
  const values = [
    axisOptions["axis label font"],
    fontFromStyle(axisOptions["label style"]),
    fontFromStyle(axisOptions[`${axis} label style`]),
    axisOptions[`${axis} label font`]
  ];
  return values.filter((value) => value !== undefined && value !== null && String(value).trim()).at(-1) || "";
}

function fontFromStyle(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return "";
  return String(parseOptions(String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1")).font || "").trim();
}

function roleFontOption(role, axisOptions, explicit) {
  if (pgfplotsPictureFontScale(axisOptions) === 1 && !String(explicit || "").trim() && !hasPgfplotsFontProfile(axisOptions)) return "";
  return pgfplotsRoleFontCommand(role, axisOptions, explicit);
}

function hasPgfplotsFontProfile(axisOptions = {}) {
  return ["normalsize", "small", "footnotesize", "tiny"].some((name) => axisOptions[name]);
}

function isAxisLineMiddle(axisOptions = {}, axis) {
  const explicit = axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`];
  const raw = explicit ?? axisOptions["axis lines"] ?? axisOptions["axis lines*"] ?? axisOptions.axis ?? axisOptions.axisLines;
  const mode = String(raw || "").trim().toLowerCase();
  return mode === "middle" || mode === "center";
}

function middleAxisMathLabelLayoutOptions(value, rawStyle, middleAxis) {
  if (!middleAxis || !String(value ?? "").includes("$")) return [];
  const style = parseOptions(String(rawStyle || ""));
  const at = String(style.at || "");
  const anchor = String(style.anchor || "").trim().toLowerCase();
  if (!/axis\s+description\s+cs/i.test(at) || (anchor && anchor !== "north")) return [];
  // PGF includes the full TeX math strut below a north-anchored axis
  // description. SVG text metrics omit that invisible descent unless the
  // layout box reserves it explicitly.
  return [`tikzkit layout bbox bottom padding=${PGFPLOTS_MIDDLE_AXIS_MATH_LABEL_BOTTOM_PADDING}`];
}

function plainLabelWidthOptions(value, _middleAxis) {
  const text = String(value ?? "").trim();
  if (!text || text.includes("$")) return [];
  // Axis descriptions use the TeX font's physical width. The renderer's
  // generic serif fallback compression predates the bundled CMU fonts and
  // visibly shortens both horizontal labels and rotated y-axis labels. CMU's
  // browser glyph outlines are about 6% narrower than the native dvips output.
  return ["tikzkit anchor text width scale=1.06", "tikzkit text width scale=1.06"];
}

function parseAxisLabelOffset(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = parseDimension(String(value), {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultXAxisLabelOffset(axisOptions = {}, geometry = {}, fallback, middleAxis) {
  if (middleAxis) return fallback;
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const alignment = String(axisOptions["xtick align"] ?? axisOptions["tick align"] ?? "inside").trim().toLowerCase();
  const tickProjection = alignment === "outside"
    ? tickLength
    : alignment === "center"
      ? tickLength / 2
      : 0;
  const tickFont = pgfplotsRoleFontCommand("tick", axisOptions, axisTickLabelFontOption(axisOptions, "x"));
  const tickFontSizePt = Number(parseTikzFontPatch(tickFont).sizePt) || 10;
  const tickFontHeight = parseDimension(`${tickFontSizePt}pt`, {});
  const tickInnerSep = explicitTickLabelInnerSep(axisOptions, "x");
  const baselineShift = parseDimension("0.8pt", {});
  return Math.max(fallback, tickProjection + baselineShift + tickFontHeight + tickInnerSep * 2);
}

function axisTickLabelFontOption(axisOptions = {}, axis) {
  const styles = [
    axisOptions["axis tick label font"],
    fontFromStyle(axisOptions["tick label style"]),
    fontFromStyle(axisOptions["ticklabel style"]),
    fontFromStyle(axisOptions.ticklabelStyle),
    axisOptions[`${axis} tick label font`],
    axisOptions[`${axis}ticklabel font`],
    fontFromStyle(axisOptions[`${axis} tick label style`]),
    fontFromStyle(axisOptions[`${axis}ticklabel style`])
  ];
  return styles.filter((value) => value !== undefined && value !== null && String(value).trim()).at(-1) || "";
}

function explicitTickLabelInnerSep(axisOptions = {}, axis) {
  const values = [
    axisOptions["axis tick label inner sep"],
    styleOption(axisOptions["tick label style"], "inner sep"),
    styleOption(axisOptions["ticklabel style"], "inner sep"),
    styleOption(axisOptions.ticklabelStyle, "inner sep"),
    styleOption(axisOptions[`${axis} tick label style`], "inner sep"),
    styleOption(axisOptions[`${axis}ticklabel style`], "inner sep")
  ].filter((value) => value !== undefined && value !== null && value !== true && value !== false && String(value).trim());
  if (!values.length) return 0;
  const parsed = parseDimension(String(values.at(-1)), {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function styleOption(rawStyle, key) {
  if (rawStyle === undefined || rawStyle === null || rawStyle === true || rawStyle === false) return undefined;
  return parseOptions(String(rawStyle))[key];
}

function axisLabelRotation(rawStyle, fallback) {
  const raw = parseOptions(String(rawStyle || "")).rotate;
  if (raw === undefined || raw === null || raw === true || raw === false) return fallback;
  const value = Number(String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim());
  return Number.isFinite(value) ? value : fallback;
}

function axisLabelText(value, rawStyle = "") {
  const text = String(value ?? "");
  if (!text.includes("\\\\")) return text;
  const options = parseOptions(String(rawStyle || ""));
  if (options.align || options["text width"]) return text;
  return inlineTextLineBreaks(text);
}

function inlineTextLineBreaks(text) {
  let output = "";
  let inMath = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "$" && text[index - 1] !== "\\") {
      inMath = !inMath;
      output += char;
      continue;
    }
    if (!inMath && char === "\\" && text[index + 1] === "\\") {
      output = output.replace(/\s+$/, "");
      output += " ";
      index += 1;
      while (/\s/.test(text[index + 1] || "")) index += 1;
      continue;
    }
    output += char;
  }
  return output.replace(/[ \t]{2,}/g, " ").trim();
}

function applyAxisLabelStyle(point, anchor, rawStyle, placement) {
  const rawStyleText = String(rawStyle || "");
  const style = rawStyleText.toLowerCase();
  const next = { point: { ...point }, anchor };
  if (!style.trim()) return next;
  const styleOptions = parseOptions(rawStyleText);
  const atPoint = axisDescriptionPoint(styleOptions.at, placement.geometry);
  if (atPoint) {
    next.point = atPoint;
    next.point.x += explicitStyleShift(styleOptions.xshift, placement.defaultAtShift?.x || 0);
    next.point.y += explicitStyleShift(styleOptions.yshift, placement.defaultAtShift?.y || 0);
  } else {
    next.point.x += explicitStyleShift(styleOptions.xshift, 0);
    next.point.y += explicitStyleShift(styleOptions.yshift, 0);
  }
  let horizontal = anchor.includes("east") ? "east" : anchor.includes("west") ? "west" : "";
  let vertical = anchor.includes("north") ? "north" : anchor.includes("south") ? "south" : "";
  if (/\bleft\b/.test(style) && placement.defaultHorizontal !== "left") {
    next.point.x -= placement.xOffset * 1.2;
    horizontal = "east";
  }
  if (/\bright\b/.test(style)) {
    next.point.x += placement.xOffset * (placement.defaultHorizontal === "right" ? 2.5 : 1.2);
    horizontal = "west";
  }
  if (/\bbelow\b/.test(style) && placement.defaultVertical !== "below") {
    next.point.y -= placement.yOffset * 0.6;
    vertical = "north";
  }
  if (/\babove\b/.test(style) && placement.defaultVertical !== "above") {
    next.point.y += placement.yOffset * 0.6;
    vertical = "south";
  }
  const explicitAnchor = styleOptions.anchor ? String(styleOptions.anchor).trim() : "";
  next.anchor = explicitAnchor || [vertical, horizontal].filter(Boolean).join(" ") || anchor;
  return next;
}

function axisLabelVisualOptions(rawStyle) {
  if (rawStyle === undefined || rawStyle === null || rawStyle === true || rawStyle === false) return [];
  const options = parseOptions(String(rawStyle));
  const textColor = options.text || options.color;
  return [
    textColor ? `text=${textColor}` : "",
    options.align ? `align=${options.align}` : "",
    options["inner sep"] !== undefined ? `inner sep=${options["inner sep"]}` : "",
    options["text width"] !== undefined ? `text width=${options["text width"]}` : ""
  ].filter(Boolean);
}

function explicitStyleShift(raw, fallback) {
  if (raw === undefined || raw === null || raw === true || raw === false || String(raw).trim() === "") return fallback;
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitYAxisLabelDefaultShift(axisOptions = {}) {
  const raw = axisOptions["axis y line"] ?? axisOptions["axis y line*"];
  const mode = String(raw || "").trim().toLowerCase();
  return mode === "left" || mode === "right"
    ? { x: -parseDimension("35pt", {}), y: 0 }
    : { x: 0, y: 0 };
}

function isLeftOpenAxis(axisOptions = {}) {
  const global = String(axisOptions["axis lines"] ?? axisOptions["axis lines*"] ?? axisOptions.axis ?? "")
    .trim()
    .toLowerCase();
  if (global === "left") return true;
  const yLine = String(axisOptions["axis y line"] ?? axisOptions["axis y line*"] ?? "")
    .trim()
    .toLowerCase();
  return yLine === "left";
}

function axisDescriptionPoint(rawAt, geometry = {}) {
  if (rawAt === undefined || rawAt === null || rawAt === true || rawAt === false) return null;
  const text = String(rawAt).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const match = text.match(/^\(([\s\S]*)\)$/);
  if (!match) return null;
  const coordinate = match[1].replace(/^\s*axis\s+description\s+cs\s*:\s*/i, "");
  const parts = splitTopLevel(coordinate, ",");
  if (parts.length < 2) return null;
  const x = Number(String(parts[0]).trim());
  const y = Number(String(parts[1]).trim());
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (typeof geometry.mapAxisDescriptionPoint === "function") {
    return geometry.mapAxisDescriptionPoint({ x, y });
  }
  const origin = geometry.origin || { x: 0, y: 0 };
  const width = Number(geometry.width);
  const height = Number(geometry.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return {
    x: origin.x + x * width,
    y: origin.y + y * height
  };
}

function parseAxisCleanPadding(axisOptions = {}) {
  const raw = axisOptions["datavis clean padding"] || "0.175cm";
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0.175;
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}
