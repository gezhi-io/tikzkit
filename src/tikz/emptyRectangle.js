import { nodeBoxDimensions } from "./nodeDimensions.js";

// PGF's rectangular background excludes outer sep; the named edge anchors do not.
export function emptyRectangleSize(options, dimension) {
  const { innerX, innerY, minWidth, minHeight } = nodeBoxDimensions(options, dimension);
  return { width: Math.max(0, minWidth, dimension(options["text width"] ?? "0pt") + 2 * innerX),
    height: Math.max(0, minHeight, dimension(options["text height"] ?? "0pt") +
      dimension(options["text depth"] ?? "0pt") + 2 * innerY), strokeBoundsIncluded: false };
}

// A coordinate has no background path. Unknown shapes should not silently
// acquire a rectangle just because their general layout fallback is one.
export function isPlainRectangle(options, shape) {
  return shape === "rectangle" && !options.coordinate && (!options.shape || options.shape === "rectangle");
}
