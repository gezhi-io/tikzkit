export const tikzCommand = {
  name: "addplot",
  kind: "command",
  status: "partial",
  implementedBy: [
    "src/preprocess.js:parseAddplots",
    "src/preprocess.js:evaluateAxisExpression",
    "src/preprocess.js:evaluateAxisExpressionAtSample",
    "src/preprocess.js:renderAxisAsTikz"
  ],
  package: "pgfplots",
  optionScope: "plot",
  options: [
    {
      name: "{x} / {-x*ln(x)}",
      category: "function expression",
      status: "partial",
      implementedBy: "src/preprocess.js:evaluateAxisExpressionAtSample",
      notes: "Function plots are sampled in JS with common PGF math functions and removable endpoint handling."
    },
    {
      name: "coordinates {(x,y) ...}",
      category: "data",
      status: "implemented",
      implementedBy: "src/preprocess.js:parseAddplots",
      notes: "2D and focused 3D coordinate lists are parsed from addplot bodies."
    },
    {
      name: "table",
      category: "data",
      status: "partial",
      implementedBy: "src/preprocess.js:parseAddplots + pgfplotstable helpers",
      notes: "Inline and registered tables cover common corpus cases."
    },
    {
      name: "domain / samples",
      category: "sampling",
      status: "implemented",
      implementedBy: "src/preprocess.js:parseAddplots + src/preprocess.js:computeAxisRanges",
      notes: "Plot-local sampling options override axis defaults."
    },
    {
      name: "color / thick / dashed / mark",
      category: "style",
      status: "partial",
      implementedBy: "src/preprocess.js:renderAxisAsTikz + src/options.js:normalizeOptions",
      notes: "Plot styles are forwarded to generated TikZ paths."
    },
    {
      name: "smooth",
      category: "path handler",
      status: "partial",
      implementedBy: "src/preprocess.js:renderAxisAsTikz",
      notes: "Smooth plots use a practical SVG/TikZ curve approximation."
    },
    {
      name: "only marks / mark=* / mark size",
      category: "plot marks",
      status: "partial",
      implementedBy: "src/libraries/plotmarks.js + src/preprocess.js",
      notes: "Common marks are emitted as small node/path glyphs."
    },
    {
      name: "fill / closed cycle / area legend",
      category: "area",
      status: "partial",
      implementedBy: "src/preprocess.js:renderAxisAsTikz",
      notes: "Filled/closed plots are implemented for common 2D examples."
    }
  ],
  examples: [
    String.raw`\addplot[color=blue]{x};`,
    String.raw`\addplot[color=red, domain=0:1]{-x*ln(x)};`
  ]
};
