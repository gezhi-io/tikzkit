import { normalizePgfRgbColor, resolveColorSpec, convertColorSpec } from "../engine/colors.js";
import { TIKZ_DASH_PATTERN_STYLES } from "../tikz/metrics.js";
import { pgfplotsOptionEnabled } from "./axisOptions.js";
import { axisViewportClipOption } from "./clipping.js";
import { colormapColorCss, parsePgfplotsColormaps } from "./colormap.js";
import { axisNumber } from "./coordinates.js";
import { filledPlotPaint } from "./filledPlotPaint.js";
import { formatAxisPoint, formatAxisTickLabel, joinOptions } from "./format.js";
import { renderPlotMark, shouldRenderPlotMarks } from "./marks.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";
import { isPlotColorToken, plotLineWidthOption } from "./plotStyle.js";
import { pgfplotsSurfaceColor } from "./surface.js";

const mapped = "mapped color";

function unqualified(options = {}) {
  const result = {};
  for (const [raw, value] of Object.entries(options)) {
    const key = raw.replace(/^\/(?:tikz|pgfplots)\//, "");
    delete result[key];
    result[key] = value;
  }
  return result;
}

// pgfplotsmeshplotimage.code.tex emits the penultimate and final scanlines
// together, one column at a time. Translucent neighboring outlines expose it.
function* faceOrder(cells, width) {
  const lastPair = cells.length - 2 * width;
  if (!(Number.isInteger(width) && width >= 2 && lastPair >= 0 && cells.length % width === 0)) {
    yield* cells;
    return;
  }
  for (let i = 0; i < lastPair; ++i) yield cells[i];
  for (let i = lastPair; i < lastPair + width; ++i) {
    yield cells[i];
    yield cells[i + width];
  }
}

function numericColor(survey, axis, options) {
  const aMaps = parsePgfplotsColormaps(axis.colormap);
  const pMaps = parsePgfplotsColormaps(options.colormap);
  const maps = { ...axis["pgfplots colormaps"], ...aMaps, ...pMaps };
  const name = options["colormap name"] || Object.keys(pMaps).at(-1) ||
    axis["colormap name"] || Object.keys(aMaps).at(-1) || "hot";
  const perPlot = (options["point meta rel"] ?? axis["point meta rel"]) === "per plot";
  let range = survey.metaRange ?? (!perPlot && axis["pgfplots matrix meta range"]);
  if (!range) {
    let min = Infinity, max = -Infinity;
    for (const { meta } of survey.cells) if (Number.isFinite(meta)) {
      min = Math.min(min, meta);
      max = Math.max(max, meta);
    }
    const bound = key => perPlot ? options[key] ?? axis[key] : axis[key] ?? options[key];
    range = { min:axisNumber(bound("point meta min"), min), max:axisNumber(bound("point meta max"), max) };
  }
  const limits = { zMin:range.min, zMax:range.max };
  const context = { "colormap name":name, "pgfplots colormaps":maps, "tikzkit explicit surface point meta":true };
  const stops = maps[name];
  if ((options["colormap access"] ?? axis["colormap access"]) === "direct" && stops?.length) {
    const spec = stop => stop.colorSpec ?? resolveColorSpec(stop.color);
    const model = spec(stops[0])?.model === "cmyk" ? "cmyk" : "rgb";
    const palette = stops.map(stop => {
      const color = spec(stop);
      return color ? colormapColorCss(convertColorSpec(color, model)) : stop.color;
    });
    return value => palette[Math.max(0, Math.min(Math.trunc(value), palette.length - 1))];
  }
  return value => pgfplotsSurfaceColor(value, limits, 0, context);
}

function matrixInks(axis, options) {
  const paint = {};
  for (const layer of [axis, options]) {
    for (const [raw, value] of Object.entries(layer)) {
      let key = raw;
      // mesh/true installs color=mapped color at this point in the style.
      if (key === "surf" || /^(?:matrix plot|imagesc)\*?$/.test(key)) {
        delete paint.draw; delete paint.fill; delete paint.color;
        continue;
      }
      // The flat mesh uses qfillstroke itself; a surrounding TikZ path action
      // (draw=none, fill=none or bare draw) does not change either ink.
      if ((key === "draw" || key === "fill") && (value === true || !pgfplotsOptionEnabled(value))) continue;
      const named = value === true && isPlotColorToken(key);
      if (!(named || /^(?:color|draw|fill|(?:draw |fill |stroke )?opacity|line (?:width|cap|join)|dash pattern|(?:(?:very|ultra) )?(?:thick|thin)|semithick)$/.test(key) ||
        Object.hasOwn(TIKZ_DASH_PATTERN_STYLES, key))) continue;
      const ink = named ? key : value;
      if (named) key = "color";
      delete paint[key];
      paint[key] = ink;
    }
  }
  return paint;
}

function nearCoord(cell, at, settings, color, clip) {
  const raw = settings["nodes near coords"];
  if (!raw) return "";
  const value = Number.isFinite(cell.meta) ? formatAxisTickLabel(cell.meta) : String(cell.point.meta ?? "");
  const label = raw === true ? value : String(raw)
    .replace(/\\coordindex\b/g, String(cell.index))
    .replace(/(?:\\pgfmathprintnumber\s*)?\\pgfplotspointmeta\b/g, value);
  const align = settings["nodes near coords align"] ?? "auto";
  const horizontal = align === "horizontal" || (align === "auto" && settings["point meta"] === "x");
  const symbolic = String(settings["mesh/color input"] ?? "").startsWith("explicit");
  const anchor = symbolic ? "south" : horizontal ? (cell.meta < 0 ? "east" : "west") : (cell.meta < 0 ? "north" : "south");
  const placement = ["auto","horizontal","vertical"].includes(align) ? "anchor=" + anchor
    : /^(?:north|south|east|west|center|mid|base)\b/.test(align) ? "anchor=" + align : align;
  const style = joinOptions(["axis near coord", "tikzkit tex node anchors", placement,
    "text=" + color, plotLineWidthOption(settings), settings.font && "font=" + settings.font,
    ...[settings["every node near coord/.style"], settings["every node near coord/.append style"],
      settings["nodes near coords style"]].flat(), clip]);
  return "\\node[" + style + "] at " + formatAxisPoint(at) + " {" + label + "};";
}

export function renderMatrixPlot(plot, axisOptions, ranges, geometry, afterAxisMarks = null) {
  const survey = plot.matrixSurvey, commands = [];
  if (!survey?.cells?.length) return commands;
  axisOptions = unqualified(axisOptions);
  const options = unqualified(plot.options);
  const settings = mergePgfplotsOptionMaps(axisOptions, options);
  const limits = geometry.lineRanges ?? geometry.transformRanges ?? ranges;
  const clip = axisViewportClipOption(settings, ranges, { ...geometry, lineRanges:limits });
  const paint = matrixInks(axisOptions, options);
  const faceStyle = filledPlotPaint(mergePgfplotsOptionMaps({ "pgfplots cycle color":mapped, fill:true }, paint)).style;
  const explicit = String(settings["mesh/color input"] ?? "").startsWith("explicit");
  const lookup = explicit ? null : numericColor(survey, axisOptions, options);
  for (const cell of faceOrder(survey.cells, survey.scanlineLength)) {
    // Explicit mesh colors default to RGB output. Document-defined names
    // that have not been resolved yet belong to the surrounding TikZ scope.
    const color = explicit ? (cell.color && resolveColorSpec(cell.color)?.model === "cmyk" ? normalizePgfRgbColor(cell.color) : cell.color)
      : Number.isFinite(cell.meta) && lookup(cell.meta);
    if (!color) continue;
    const corners = cell.corners.map(p => geometry.mapPoint(p));
    if (!corners.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
    const style = joinOptions(["axis matrix cell", "tikzkit quick path", faceStyle.replaceAll(mapped, () => color), clip]);
    commands.push("\\draw[" + style + "] " + corners.map(formatAxisPoint).join(" -- ") + " -- cycle;");
  }

  const hasMarks = shouldRenderPlotMarks(settings);
  if (!hasMarks && !settings["nodes near coords"]) return commands;
  const overlays = afterAxisMarks ?? commands;
  const markerClip = pgfplotsOptionEnabled(settings["clip marker paths"]) ? clip : "";
  const marks = markerClip ? { ...settings, "tikzkit clip rect":markerClip.slice("tikzkit clip rect=".length) } : settings;
  const inks = filledPlotPaint({ ...paint, "mark fill":options["mark fill"] });
  // scatter/@post marker code appends the node immediately after each mark,
  // even for an original coordinate whose unbounded meta discarded its face.
  for (const cell of survey.cells) {
    const { x, y } = cell.point;
    if (clip && (x < limits.xMin || x > limits.xMax || y < limits.yMin || y > limits.yMax)) continue;
    const at = geometry.mapPoint(cell.point);
    if (![at.x, at.y].every(Number.isFinite)) continue;
    if (hasMarks) overlays.push(renderPlotMark(at, marks, 0, inks.mark));
    const node = nearCoord(cell, at, settings, inks.currentColor, markerClip);
    if (node) overlays.push(node);
  }
  return commands;
}
