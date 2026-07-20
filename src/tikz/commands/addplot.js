export const tikzCommand = {
  name: "addplot",
  kind: "command",
  status: "partial",
  implementedBy: [
    "src/pgfplots/addplot.js:createAddplotModel",
    "src/pgfplots/coordinates.js:parseCoordinateList",
    "src/pgfplots/addplotParser.js:parseAddplots",
    "src/pgfplots/expressions.js:evaluateAxisExpression",
    "src/pgfplots/expressions.js:evaluateAxisExpressionAtSample",
    "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz"
  ],
  package: "pgfplots",
  optionScope: "plot",
  options: [
    {
      name: "{x} / {-x*ln(x)}",
      category: "function expression",
      status: "partial",
      implementedBy: "src/pgfplots/expressions.js:evaluateAxisExpressionAtSample",
      notes: "Function plots are sampled in JS with common PGF math functions and removable endpoint handling."
    },
    {
      name: "coordinates {(x,y) ...}",
      category: "data",
      status: "implemented",
      implementedBy: "src/pgfplots/addplotParser.js:parseAddplots + src/pgfplots/coordinates.js",
      notes: "2D and focused 3D coordinate lists are parsed from addplot bodies."
    },
    {
      name: "table",
      category: "data",
      status: "partial",
      implementedBy: "src/pgfplots/addplotParser.js:parseAddplots + pgfplotstable helpers",
      notes: "Inline and registered tables cover common corpus cases."
    },
    {
      name: "domain / samples",
      category: "sampling",
      status: "implemented",
      implementedBy: "src/pgfplots/addplotParser.js:parseAddplots + src/pgfplots/rangeResolver.js:computeAxisRanges",
      notes: "Plot-local sampling options override axis defaults."
    },
    {
      name: "color / thick / dashed / mark",
      category: "style",
      status: "partial",
      implementedBy: "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz + src/engine/options.js:normalizeOptions",
      notes: "Plot styles are forwarded to generated TikZ paths."
    },
    {
      name: "smooth",
      category: "path handler",
      status: "partial",
      implementedBy: "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz",
      notes: "Smooth plots use a practical SVG/TikZ curve approximation."
    },
    {
      name: "only marks / mark=* / mark size",
      category: "plot marks",
      status: "partial",
      implementedBy: "src/tikz/libraries/plotmarks.js + src/frontend/latex-shell.js",
      notes: "Common marks are emitted as small node/path glyphs."
    },
    {
      name: "fill / closed cycle / area legend",
      category: "area",
      status: "partial",
      implementedBy: "src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz",
      notes: "Filled/closed plots are implemented for common 2D examples."
    }
  ],
  examples: [
    String.raw`\addplot[color=blue]{x};`,
    String.raw`\addplot[color=red, domain=0:1]{-x*ln(x)};`
  ]
};
