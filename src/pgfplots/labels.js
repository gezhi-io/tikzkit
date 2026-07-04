import { parseDimension } from "../engine/math.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { isMiddleAxis } from "./geometry.js";

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
  const yAxis = ranges.yMin <= 0 && ranges.yMax >= 0 ? 0 : ranges.yMin;
  const xAxis = ranges.xMin <= 0 && ranges.xMax >= 0 ? 0 : ranges.xMin;
  const xOffset = Math.max(0.28, geometry.width * 0.035);
  const yOffset = Math.max(0.22, geometry.height * 0.06);
  const middleAxis = isMiddleAxis(axisOptions);
  const labelFont = axisOptions["axis label font"] || "";
  const xLabelOffset = parseAxisLabelOffset(axisOptions["x axis label offset"], yOffset);
  const datavisLabelPlacement = String(axisOptions["datavis axis label placement"] || "").trim().toLowerCase();
  if (datavisLabelPlacement === "end") {
    const cleanAxisOffset = axisOptions["datavis clean axes"] ? parseAxisCleanPadding(axisOptions) : 0;
    const optionPrefix = labelFont ? `axis label,font=${labelFont}` : "axis label";
    if (axisOptions.xlabel) {
      const point = offsetPoint(geometry.mapPoint({ x: ranges.xMax, y: ranges.yMin }), Math.max(0.08, xOffset * 0.25), -cleanAxisOffset);
      commands.push(`\\node[${optionPrefix},anchor=west] at ${formatAxisPoint(point)} {${axisOptions.xlabel}};`);
    }
    if (axisOptions.ylabel) {
      const point = offsetPoint(geometry.mapPoint({ x: ranges.xMin, y: ranges.yMax }), -cleanAxisOffset, Math.max(0.26, yOffset * 1.1));
      commands.push(`\\node[${optionPrefix},anchor=south] at ${formatAxisPoint(point)} {${axisOptions.ylabel}};`);
    }
    if (axisOptions.title) {
      const point = offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMax }), 0, yOffset);
      commands.push(`\\node[axis label, anchor=south] at ${formatAxisPoint(point)} {${axisOptions.title}};`);
    }
    return commands;
  }
  if (axisOptions.xlabel) {
    const point = middleAxis
      ? offsetPoint(geometry.mapPoint({ x: ranges.xMax, y: yAxis }), Math.min(0.08, xOffset * 0.25), 0)
      : offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMin }), 0, -xLabelOffset);
    const placement = applyAxisLabelStyle(point, middleAxis ? "south east" : "north", axisOptions["xlabel style"] || axisOptions["x label style"], {
      xOffset,
      yOffset,
      defaultHorizontal: middleAxis ? "right" : "center",
      defaultVertical: middleAxis ? "above" : "below"
    });
    const labelOptions = ["axis label", `anchor=${placement.anchor}`];
    if (labelFont) labelOptions.push(`font=${labelFont}`);
    commands.push(`\\node[${joinOptions(labelOptions)}] at ${formatAxisPoint(placement.point)} {${axisOptions.xlabel}};`);
  }
  if (axisOptions.ylabel) {
    const ylabelStyle = axisOptions["ylabel style"] || axisOptions["y label style"];
    const ylabelXOffset =
      datavisLabelPlacement === "upright" && !middleAxis
        ? (axisOptions["datavis clean axes"] ? parseAxisCleanPadding(axisOptions) : 0) + Math.max(0.48, xOffset * 1.8)
        : middleAxis
          ? xOffset * 0.2
          : Math.max(xOffset * 2.6, 1.1);
    const point = middleAxis
      ? offsetPoint(geometry.mapPoint({ x: xAxis, y: ranges.yMax }), ylabelXOffset, -yOffset * 0.2)
      : offsetPoint(geometry.mapPoint({ x: ranges.xMin, y: (ranges.yMin + ranges.yMax) / 2 }), -ylabelXOffset, 0);
    const placement = applyAxisLabelStyle(point, middleAxis ? "west" : "east", ylabelStyle, {
      xOffset,
      yOffset,
      defaultHorizontal: middleAxis ? "right" : "left",
      defaultVertical: middleAxis ? "below" : "center"
    });
    const rotation = axisLabelRotation(ylabelStyle, middleAxis || datavisLabelPlacement === "upright" ? null : 90);
    const labelOptions = ["axis label", `anchor=${placement.anchor}`];
    if (labelFont) labelOptions.push(`font=${labelFont}`);
    if (rotation !== null) labelOptions.push(`rotate=${rotation}`);
    commands.push(`\\node[${joinOptions(labelOptions)}] at ${formatAxisPoint(placement.point)} {${axisOptions.ylabel}};`);
  }
  if (axisOptions.title) {
    const point = offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMax }), 0, yOffset);
    commands.push(`\\node[axis label, anchor=south] at ${formatAxisPoint(point)} {${axisOptions.title}};`);
  }
  return commands;
}

function parseAxisLabelOffset(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = parseDimension(String(value), {});
  return Number.isFinite(parsed) ? parsed : fallback;
}

function axisLabelRotation(rawStyle, fallback) {
  const match = String(rawStyle || "").match(/\brotate\s*=\s*([-+]?\d+(?:\.\d+)?)/);
  if (!match) return fallback;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : fallback;
}

function applyAxisLabelStyle(point, anchor, rawStyle, placement) {
  const style = String(rawStyle || "").toLowerCase();
  const next = { point: { ...point }, anchor };
  if (!style.trim()) return next;
  let horizontal = anchor.includes("east") ? "east" : anchor.includes("west") ? "west" : "";
  let vertical = anchor.includes("north") ? "north" : anchor.includes("south") ? "south" : "";
  if (/\bleft\b/.test(style) && placement.defaultHorizontal !== "left") {
    next.point.x -= placement.xOffset * 1.2;
    horizontal = "east";
  }
  if (/\bright\b/.test(style) && placement.defaultHorizontal !== "right") {
    next.point.x += placement.xOffset * 1.2;
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
  next.anchor = [vertical, horizontal].filter(Boolean).join(" ") || anchor;
  return next;
}

function parseAxisCleanPadding(axisOptions = {}) {
  const raw = axisOptions["datavis clean padding"] || "0.175cm";
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0.175;
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}
