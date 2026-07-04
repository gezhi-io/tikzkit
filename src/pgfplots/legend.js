import { parseOptions } from "../options.js";
import { fontScaleFromTikzFont } from "../tex-text.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { selectPlotStyle } from "./plotStyle.js";

export function renderLegendEntries(axisOptions, _ranges, geometry, bodyEntries = [], addplots = []) {
  const raw = axisOptions["legend entries"];
  const entries = raw ? splitLegendEntries(raw) : bodyEntries;
  if (!entries.length) return [];
  const font = legendFontOption(axisOptions);
  const fontScale = fontScaleFromTikzFont(font);
  const placement = legendPlacement(axisOptions["legend pos"], geometry);
  const rowHeight = Math.max(0.19, 0.31 * fontScale / 0.7);
  const imageWidth = Math.max(0.28, 0.38 * fontScale / 0.7);
  const horizontalPadding = Math.max(0.12, 0.26 * fontScale / 0.7);
  const verticalPadding = Math.max(0.08, 0.16 * fontScale / 0.7);
  const boxWidth = Math.max(0.85, horizontalPadding * 2 + imageWidth + 0.12 + Math.max(...entries.map((entry) => estimateLegendEntryWidth(entry, fontScale))));
  const boxHeight = Math.max(0.28, verticalPadding + entries.length * rowHeight);
  const box = legendBoxFromAnchor(placement.point, placement.anchor, boxWidth, boxHeight);
  const commands = [
    `\\draw[axis legend box, draw=black, fill=white, line width=0.2pt] ${formatAxisPoint({ x: box.left, y: box.top })} -- ${formatAxisPoint({
      x: box.right,
      y: box.top
    })} -- ${formatAxisPoint({ x: box.right, y: box.bottom })} -- ${formatAxisPoint({ x: box.left, y: box.bottom })} -- cycle;`
  ];
  entries.forEach((entry, index) => {
    const y = box.top - verticalPadding / 2 - rowHeight * (index + 0.5);
    const x0 = box.left + horizontalPadding * 0.55;
    const x1 = x0 + imageWidth;
    const textX = x1 + Math.max(0.08, 0.12 * fontScale / 0.7);
    const plot = addplots[index];
    const imageStyle = joinOptions(["axis legend image", selectPlotStyle(plot?.options || {}, index), axisOptions.thick ? "thick" : ""]);
    commands.push(`\\draw[${imageStyle}] ${formatAxisPoint({ x: x0, y })} -- ${formatAxisPoint({ x: x1, y })};`);
    commands.push(`\\node[axis legend, anchor=west, ${font}] at ${formatAxisPoint({ x: textX, y })} {${entry.trim()}};`);
  });
  return commands;
}

export function legendFontOption(axisOptions = {}) {
  const style = parseOptions(axisOptions["legend style"] || "");
  const font = style.font ? String(style.font).trim() : "";
  return font ? `font=${font}` : "font=\\scriptsize";
}

export function legendPlacement(rawPosition, geometry) {
  const value = String(rawPosition || "north east").trim().toLowerCase();
  const presets = {
    "south west": { x: 0.03, y: 0.03, anchor: "south west" },
    "south east": { x: 0.97, y: 0.03, anchor: "south east" },
    "north west": { x: 0.03, y: 0.97, anchor: "north west" },
    "north east": { x: 0.97, y: 0.97, anchor: "north east" },
    "outer north east": { x: 1.03, y: 1, anchor: "north west" },
    "south east outside": { x: 1.03, y: 0.03, anchor: "south west" }
  };
  const preset = presets[value] || presets["north east"];
  return {
    anchor: preset.anchor,
    point: {
      x: geometry.origin.x + geometry.width * preset.x,
      y: geometry.origin.y + geometry.height * preset.y
    }
  };
}

export function legendBoxFromAnchor(point, anchor, width, height) {
  const horizontal = anchor.includes("east") ? "east" : "west";
  const vertical = anchor.includes("south") ? "south" : "north";
  const left = horizontal === "east" ? point.x - width : point.x;
  const right = left + width;
  const bottom = vertical === "north" ? point.y - height : point.y;
  const top = bottom + height;
  return { left, right, top, bottom };
}

export function estimateLegendEntryWidth(entry, fontScale = 0.7) {
  return Math.max(0.28, stripTexForLength(entry).length * 0.075 * (fontScale / 0.7));
}

export function splitLegendEntries(raw) {
  const entries = [];
  let start = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === "," && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      entries.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  entries.push(text.slice(start).trim());
  return entries.filter(Boolean);
}

export function stripTexForLength(value) {
  return String(value || "")
    .replace(/\\[a-zA-Z]+\s*/g, "")
    .replace(/[{}$]/g, "")
    .trim();
}
