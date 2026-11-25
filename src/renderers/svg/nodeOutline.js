import { doubleStrokeStyles } from "./paths.js";
import { styleAttributes } from "./style.js";

// PGF paints the same centerline twice. The fill belongs to the first pass
// only; an inset copy would change the gap at corners and on curved borders.
export function paintNodeOutline(geometry, style, innerClass = "") {
  const paint = (pen, className = "") => `${geometry}${className}${styleAttributes(pen)} />`;
  if (style?.doubleColor === undefined || style.stroke === "none") return paint(style);
  const { outerStyle, innerStyle } = doubleStrokeStyles(style);
  return paint({ ...outerStyle, fill: style.fill }) + (innerStyle.lineWidth > 0 ? paint(innerStyle, innerClass) : "");
}
