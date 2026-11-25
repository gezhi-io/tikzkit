import { normalizeOptions, parseOptions } from "../engine/options.js";
import { TIKZ_UNIT } from "../tikz/metrics.js";
import { axisViewportClipOption } from "./clipping.js";
import { errorBarEndpoints, resolvePlotErrorBars } from "./errorBars.js";
import { filledPlotPaint } from "./filledPlotPaint.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { renderPlotMark } from "./marks.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";

const origin = { x: 0, y: 0 };
const markBox = "tikzkit@pgfplots@error@mark";

// PGFPlots paints an error as its own clipped path after the plot handler.
// Map the actual endpoint, even when it is outside: clipping must not create
// a replacement cap at the boundary or a mark on an interpolated sample.
export function renderAxisErrorBars(plot, points, axis, ranges, geometry, plotIndex, barAxis, layout) {
  const config = resolvePlotErrorBars(axis, plot);
  if (!config) return [];
  const options = mergePgfplotsOptionMaps(plot.options, config.barStyle);
  const paint = filledPlotPaint(options, axis);
  const clip = axisViewportClipOption(axis, ranges, geometry);
  const stemStyle = joinOptions(["axis error bar", paint.style, clip]);
  const cap = errorCap(config, options, paint, plotIndex);
  const nodeStyle = joinOptions(["draw=none", "fill=none", "outer sep=0pt",
    ...["font", "inner sep", "inner xsep", "inner ysep"].filter(key => options[key] != null)
      .map(key => `${key}={${options[key]}}`)]);
  const commands = [];
  for (const point of points) {
    const tips = errorBarEndpoints(point, config);
    if (!tips.length) continue;
    const shift = layout?.(point).shift || 0;
    const map = p => {
      const mapped = geometry.mapPoint(p);
      if (!shift) return mapped;
      return barAxis === "y" ? { ...mapped, x: mapped.x + shift } : { ...mapped, y: mapped.y + shift };
    };
    const start = map(point);
    for (const tip of tips) {
      const end = map(tip);
      commands.push(`\\draw[${stemStyle}] ${formatAxisPoint(start)} -- ${formatAxisPoint(end)};`);
      if (cap) {
        // The nested mark sees the directed stem's local frame before its
        // own rotate/scale options. Its size is in TeX points, not data units.
        const dx = end.x - start.x, dy = end.y - start.y;
        // pgfmath atan2(0,0) returns +90, unlike Math.atan2(0,0).
        const angle = dx === 0 && dy === 0 ? 90 : Math.atan2(dy, dx) * 180 / Math.PI;
        const frame = joinOptions(["axis error cap", cap.style, clip, `shift={${formatAxisPoint(end)}}`, `rotate=${angle}`]);
        const mark = `{[${frame}]\n${cap.path}\n}`;
        // PGF puts the mark in a sloped node. With clipping off, its unpainted
        // inner sep sizes the picture (never the surveyed data limits).
        if (clip) commands.push(mark);
        else commands.push(`{[local bounding box=${markBox}]\n${mark}\n}`,
          `\\node[${nodeStyle},fit=(${markBox})] {};`);
      } else if (!clip) commands.push(`\\node[${nodeStyle}] at ${formatAxisPoint(end)} {};`);
    }
  }
  return commands;
}

function errorCap(config, options, paint, plotIndex) {
  if (!config.mark || config.mark === "none") return null;
  // A nested TikZ picture starts with a fresh pen and the current *color*,
  // not the shaft's draw ink. Dash lengths and alpha survive in the driver.
  const stem = normalizeOptions("draw", parseOptions(paint.style), { styles: {} }).style;
  const inherited = { color: paint.currentColor, "line width": ".4pt" };
  if (stem.dashArray?.length) inherited["dash pattern"] = stem.dashArray.map((value, i) =>
    `${i % 2 ? "off" : "on"} ${value / TIKZ_UNIT}cm`).join(" ");
  if (stem.strokeOpacity !== undefined) inherited["draw opacity"] = stem.strokeOpacity;
  if (stem.fillOpacity !== undefined) inherited["fill opacity"] = stem.fillOpacity;
  const cap = filledPlotPaint(mergePgfplotsOptionMaps(inherited, config.markOptions));
  const transforms = Object.fromEntries(Object.entries(config.markOptions)
    .filter(([key]) => /^(?:rotate|scale|[xy](?:scale|slant|shift))$/.test(key)));
  const path = renderPlotMark(origin, {
    mark: config.mark,
    "mark size": config.markOptions["mark size"] ?? options["mark size"],
    "mark options": transforms,
    "tikzkit plot mark declarations": options["tikzkit plot mark declarations"]
  }, plotIndex, cap.mark);
  return { path, style: cap.style };
}
