import { TIKZ_DEFAULT_INNER_SEP } from "./metrics.js";

// PGF's rectangular background excludes outer sep; the named edge anchors do not.
export function emptyRectangleSize(options, dimension) {
  let innerX = dimension(TIKZ_DEFAULT_INNER_SEP), innerY = innerX;
  let minWidth = dimension("1pt"), minHeight = minWidth;
  // The two shorthand keys assign both axes at the point where they occur.
  for (const [key, value] of Object.entries(options)) {
    switch (key) {
      case "inner sep": innerX = innerY = dimension(value); break;
      case "inner xsep": innerX = dimension(value); break;
      case "inner ysep": innerY = dimension(value); break;
      case "minimum size": minWidth = minHeight = dimension(value); break;
      case "minimum width": minWidth = dimension(value); break;
      case "minimum height": minHeight = dimension(value); break;
    }
  }
  return { width: Math.max(0, minWidth, dimension(options["text width"] ?? "0pt") + 2 * innerX),
    height: Math.max(0, minHeight, dimension(options["text height"] ?? "0pt") +
      dimension(options["text depth"] ?? "0pt") + 2 * innerY), strokeBoundsIncluded: false };
}

// A coordinate has no background path. Unknown shapes should not silently
// acquire a rectangle just because their general layout fallback is one.
export function isPlainRectangle(options, shape) {
  return shape === "rectangle" && !options.coordinate && (!options.shape || options.shape === "rectangle");
}
