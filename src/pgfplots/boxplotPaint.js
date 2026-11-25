import { mergeOptionOrder } from "../engine/options.js";
import { plotMarkLocalOptions } from "../tikz/libraries/plotmarks.js";
import { boxplotPoint } from "./boxplotGeometry.js";
import { axisViewportClipOption } from "./clipping.js";
import { filledPlotPaint } from "./filledPlotPaint.js";
import { formatAxisPoint, joinOptions } from "./format.js";
import { axisPointIsValidForScale } from "./logAxis.js";
import { renderPlotMark } from "./marks.js";
import { selectedPlotMarkIndices } from "./markSelection.js";

// tikzlibrarypgfplots.statistics.code.tex: the prepared handler draws on
// stream start and discards the stream itself. Only the separate marks phase
// visits the surveyed outliers. Both raw and prepared plots use this handler.
// Only the stock 2D draw hooks and ordinary part styles are lowered here;
// replacement TeX draw programs and custom scatter phases are outside it.
export function renderBoxplot(plot, axis, ranges, geometry, index, afterAxisMarks, variables) {
  const box = plot.boxplot, parts = box.partStyles ?? {};
  const options = tikzKeys(plot.options);
  const seriesAxis = { ...axis, clip: options.clip ?? axis.clip };
  const clip = axisViewportClipOption(axis["clip mode"] === "individual" ? seriesAxis : axis, ranges, geometry);
  const commands = [];
  function point(value, fraction, extent) {
    if (!Number.isFinite(value)) return null;
    const p = boxplotPoint(box, value, fraction, extent);
    return axisPointIsValidForScale(p, axis) ? geometry.mapPoint(p) : null;
  }
  function draw(role, points, path) {
    if (points.some(p => !p)) return;
    // Each nested \\draw restarts the draw action, but inherits the plot's
    // inks, fill mode and pen. Native every <part> then runs inside that path.
    const opts = mergeOptionOrder(mergeOptionOrder({ ...options }, { draw: true }), tikzKeys(parts[role]));
    const style = joinOptions(["axis boxplot " + role, scopePaint(opts, axis).style, clip]);
    commands.push(`\\draw[${style}] ${path(...points.map(formatAxisPoint))};`);
  }
  const hasBox = Number.isFinite(box.lowerQuartile) && Number.isFinite(box.upperQuartile);
  // With either quartile missing, PGF connects each whisker to the other.
  // A lone whisker without its starting value is not a valid native path.
  const whisker = (start, tip) => draw("whisker",
    [point(start), point(tip), point(tip, 0, box.whiskerExtend), point(tip, 1, box.whiskerExtend)],
    (a, b, c, d) => `${a} -- ${b} ${c} -- ${d}`);
  whisker(hasBox ? box.lowerQuartile : box.upperWhisker, box.lowerWhisker);
  whisker(hasBox ? box.upperQuartile : box.lowerWhisker, box.upperWhisker);
  if (hasBox) draw("box", [point(box.lowerQuartile, 0), point(box.upperQuartile, 1)], (a, b) => `${a} rectangle ${b}`);
  draw("median", [point(box.median, 0), point(box.median, 1)], (a, b) => `${a} -- ${b}`);

  const outlierMark = selectedMark(options, box.ensureMark);
  const avgPoint = point(box.average, .5);
  if (avgPoint) {
    const local = tikzKeys(parts.average ?? { mark: "diamond*" });
    const mark = local.mark ?? outlierMark;
    if (hasMark(mark)) {
      // The average calls pgfuseplotmark inside pgfextra, before the
      // enclosing path installs its local inks/pen. No "every mark" here.
      const paint = scopePaint(options, axis);
      const path = renderPlotMark(avgPoint, markerGeometry(options, local, mark), index, paint.mark);
      commands.push(markScope("average", path, paint, clip));
    }
  }
  if (!hasMark(outlierMark) || !plot.points.length) return commands;
  // A cycle's "mark fill" is an every-mark style, not the plot's fill ink.
  // A later mark options replaces that style; an append retains it.
  const local = tikzKeys(plotMarkLocalOptions(options, options["mark fill"] ? { fill: options["mark fill"] } : {}));
  const mark = local.mark ?? outlierMark;
  if (!hasMark(mark)) return commands;
  const paint = scopePaint(mergeOptionOrder({ ...options }, local), axis);
  const markers = markerGeometry(options, local, mark, true);
  const points = plot.points.filter(p => axisPointIsValidForScale(p, axis));
  // Test centers in plot-local coordinates; clip the whole marker scope
  // (also multi-path glyphs) only if it paints inside the axis clip.
  const clipMarks = options["clip marker paths"] ?? axis["clip marker paths"];
  const limits = geometry.lineRanges ?? geometry.transformRanges ?? ranges;
  const marks = [];
  for (const i of selectedPlotMarkIndices(plot, points, axis, limits, variables)) {
    marks.push(renderPlotMark(geometry.mapPoint(points[i]), markers, index, paint.mark));
  }
  if (marks.length) (afterAxisMarks ?? commands).push(markScope("outlier", marks.join("\n"), paint,
    /^(?:true|1|on|yes)$/i.test(String(clipMarks)) ? clip : ""));
  return commands;
}

function tikzKeys(options = {}) {
  const normalized = {};
  for (const [raw, value] of Object.entries(options)) {
    const key = raw.replace(/^\/tikz\//, "");
    if (key === "mark") {
      delete normalized.mark;
      normalized.mark = Array.isArray(value) ? value.at(-1) : value;
    } else mergeOptionOrder(normalized, { [key]: value });
  }
  return normalized;
}

function selectedMark(options, ensure) {
  // If the handler was set on the axis, it already ran before plot options.
  // Otherwise replay only the ordered writes to this one TikZ register. A
  // mark=none in a cycle or before the handler is not a later explicit none.
  let mark = ensure ? "*" : null;
  for (const [key, value] of Object.entries(options)) {
    if (key === "mark") mark = value;
    else if (key === "no markers" && value) mark = null;
    else if (/^(?:\/pgfplots\/)?boxplot(?: prepared)?$/.test(key) && ensure && !hasMark(mark)) mark = "*";
  }
  return mark;
}

function hasMark(mark) {
  return mark != null && mark !== false && !["", "none"].includes(String(mark).trim());
}

function markerGeometry(options, local, mark, useEveryMark = false) {
  // Supply only glyph registers. The surrounding scope already has the
  // right pen; a local average line width, for example, is not yet active.
  const geometry = { mark };
  for (const [key, value] of Object.entries({ ...options, ...local })) {
    if (key === "mark size" || key === "mark color" || key.startsWith("text mark") ||
        key === "tikzkit plot mark declarations") geometry[key] = value;
  }
  if (useEveryMark) geometry["mark options"] = Object.fromEntries(Object.entries(local)
    .filter(([key]) => /^(?:rotate|scale|[xy](?:scale|slant|shift))$/.test(key)));
  return geometry;
}

function markScope(role, paths, paint, clip) {
  // PGF quick marks choose their own stroke/fill actions. In particular a
  // stroked-only mark must not fill just because its plot requested a fill.
  return `{[${joinOptions(["axis boxplot " + role, paint.style, "fill=none", clip])}]\n${paths}\n}`;
}

function scopePaint(options, axis) {
  const paint = filledPlotPaint(options, axis);
  // A bare draw/fill (or none) changes an action without replacing the ink.
  // The ordered TikZ parser retains the earlier ink separately in this case.
  const writes = {};
  for (let [key, value] of Object.entries(options)) {
    if (key === "mark fill") continue;
    if (key === "tikzkit stroke ink") key = "draw";
    if (key === "tikzkit fill ink") key = "fill";
    if ((key === "draw" || key === "fill") && [true, "", "none", false].includes(value)) continue;
    delete writes[key];
    writes[key] = value;
  }
  const { mark } = filledPlotPaint(writes, axis);
  const style = joinOptions([paint.style, options.draw === true && "draw=" + mark.stroke,
    options.fill === true && !paint.fillStyle.startsWith("pattern=") && "fill=" + mark.fill]);
  return { style, mark };
}
