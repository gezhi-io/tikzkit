import { TIKZ_DASH_PATTERN_STYLES } from "../tikz/metrics.js";
import { joinOptions } from "./format.js";
import { isPlotColorToken, plotLineWidthOption } from "./plotStyle.js";

// The bar handler builds rectangles. TikZ, not the handler, decides whether
// to stroke or fill them. A color changes both inks without enabling a fill;
// a bare draw/fill enables that action without replacing its current ink.
export function filledPlotPaint(options = {}, axis = {}, { legendDraw = false } = {}) {
  let stroke = options["pgfplots cycle color"] || "black", fill = stroke;
  let currentColor = stroke;
  let pattern;
  let draw = true, filled = false, drawOpacity, fillOpacity;
  let width = plotLineWidthOption(axis), dash = "", cap = "", join = "";
  for (const [key, value] of Object.entries(options)) {
    if (key === "color" || (value === true && isPlotColorToken(key))) {
      currentColor = stroke = fill = key === "color" ? value : key;
      pattern = undefined;
    } else if (key === "pattern" || key === "/tikz/pattern") {
      filled = value !== "none";
      if (filled && value !== true && value !== "") pattern = value;
    } else if (key === "draw" || key === "fill") {
      const enabled = ![false, "none", "false", "off"].includes(value);
      if (key === "draw") {
        draw = enabled;
        if (enabled && value !== true) stroke = value;
      } else {
        filled = enabled;
        if (enabled && value !== true) {
          fill = value;
          pattern = undefined;
        }
      }
    } else if (key === "opacity") {
      // PGF sets both channels. SVG element opacity would composite the
      // finished object and would multiply a later independent fill opacity.
      drawOpacity = fillOpacity = value;
    } else if (key === "fill opacity") fillOpacity = value;
    else if (key === "draw opacity" || key === "stroke opacity") drawOpacity = value;
    else if (key === "line cap") cap = "line cap=" + value;
    else if (key === "line join") join = "line join=" + value;
    else if (key === "dash pattern") dash = "dash pattern=" + value;
    else if (Object.hasOwn(TIKZ_DASH_PATTERN_STYLES, key)) dash = key;
    else if (key === "line width" || /^(?:(?:very|ultra) )?(?:thick|thin)$|^semithick$/.test(key))
      width = key === "line width" ? "line width=" + value : key;
  }
  const alpha = [fillOpacity !== undefined && "fill opacity=" + fillOpacity,
    drawOpacity !== undefined && "draw opacity=" + drawOpacity].filter(Boolean);
  // A fresh legend draw is already unfilled. Preserve an explicit fill=none,
  // but don't introduce a fill option when the series never selected one.
  const fillOption = filled ? "fill=" + fill : legendDraw && !Object.hasOwn(options, "fill") ? "" : "fill=none";
  const fillStyle = filled && pattern ? joinOptions(["pattern=" + pattern,
    options["pattern color"] && "pattern color=" + options["pattern color"]]) : fillOption;
  return {
    currentColor,
    fillStyle,
    style: joinOptions([fillStyle, "draw=" + (draw || legendDraw ? stroke : "none"), width, cap, join, dash, ...alpha]),
    mark: { stroke, fill: options["mark fill"] ?? fill, alpha }
  };
}
