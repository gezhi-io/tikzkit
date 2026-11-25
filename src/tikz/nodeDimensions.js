import { TIKZ_DEFAULT_INNER_SEP } from "./metrics.js";

// Shorthand keys write both registers immediately. A later per-axis key
// replaces only that register, including when the values come from styles.
export function nodeBoxDimensions(options, dimension) {
  let innerX = dimension(TIKZ_DEFAULT_INNER_SEP), innerY = innerX;
  let minWidth = dimension("1pt"), minHeight = minWidth;
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
  return { innerX, innerY, minWidth, minHeight };
}
