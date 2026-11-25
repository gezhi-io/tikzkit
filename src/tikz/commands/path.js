export const tikzCommand = {
  name: "path",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/frontend/parser.js:parsePathCommand",
    "src/engine/evaluate.js:interpretPathStatement",
    "src/engine/evaluate.js:buildPath"
  ],
  optionScope: "path",
  options: [
    {
      name: "--",
      category: "path operation",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:buildPath",
      notes: "Straight-line segments, including node-boundary clipping, are core."
    },
    {
      name: ".. controls ..",
      category: "path operation",
      status: "implemented",
      implementedBy: "src/frontend/parser.js + src/engine/evaluate.js:buildPath",
      notes: "Cubic Bezier segments are converted to drawing IR curve commands."
    },
    {
      name: "grid",
      category: "path operation",
      status: "partial",
      implementedBy: "src/tikz/pathOperations/grid.js + src/frontend/parser.js + src/engine/evaluate.js:buildPath",
      notes: "step, xstep, ystep, coordinate-valued steps, grid-local step overrides, affine scopes, grid cycle and the final move to the requested corner. General grid-local transforms are not covered."
    },
    {
      name: "parabola / parabola bend",
      category: "path operation",
      status: "implemented",
      implementedBy: "src/frontend/parser.js:parseParabolaSegment + src/tikz/pathOperations/parabola.js:pgfParabolaCommands + src/engine/evaluate.js:resolveParabolaBend",
      notes: "Default half-parabolas, explicit bend coordinates, bend, bend pos, and parabola height use PGF's two exact cubic coefficient sets under active coordinate transforms."
    },
    {
      name: "to / edge",
      category: "path operation",
      status: "partial",
      implementedBy: "src/frontend/parser.js:parsePathTargetOperation + src/engine/evaluate.js:buildPath/edgeCurveSpec/constrainedCurveControlDistance",
      notes: "Covers bend left/right, out/in, relative, looseness, in/out looseness, exact distance, and shared or independent min/max distance constraints in source order. Explicit control points, arbitrary custom to path callbacks, and graphdrawing remain partial."
    },
    {
      name: "circle / ellipse",
      category: "shape path",
      status: "partial",
      implementedBy: "src/frontend/parser.js:parseEllipseSegment + src/tikz/pathOperations/ellipse.js + src/engine/evaluate.js:resolvePathEllipse",
      notes: "Modern radius, x radius, y radius, every circle, at, local affine transforms and legacy scalar or paired radii. Closed contours share compound fills and translucent strokes; arbitrary TeX callbacks are outside this slice."
    },
    {
      name: "rectangle / arc",
      category: "shape path",
      status: "partial",
      implementedBy: "src/frontend/parser.js:parsePathCommand + src/engine/evaluate.js:buildPath",
      notes: "Core geometric path operations map to normalized path commands."
    },
    {
      name: "plot coordinates / plot function",
      category: "plot path",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:buildPlotCoordinates + src/engine/evaluate.js:buildPlot",
      notes: "TikZ path plots and function samples cover common math-gallery cases."
    },
    {
      name: "tips",
      category: "path paint",
      status: "partial",
      implementedBy: "src/tikz/pathOperations/arrowActions.js:resolveArrowActions + src/renderers/svg/arrowTerminals.js:prepareArrowTerminals + src/renderers/svg/paths.js:renderArrowedPath",
      notes: "on draw, true, proper, on proper draw, false and never select whether to paint arrow tips. Eligibility belongs to the entire path; only the final open subpath receives tips. Independently painted edges are separate actions."
    },
    {
      name: "cycle / close path",
      category: "path operation",
      status: "implemented",
      implementedBy: "src/engine/evaluate.js:buildPath",
      notes: "Closed paths use IR closePath and SVG Z output."
    },
    {
      name: "fill / filldraw / clip",
      category: "operation",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:interpretPathStatement/applyScopeClips + src/renderers/svg/scopeClips.js",
      notes: "Ordinary clip paths intersect in source order until the end of the scope. Compound subpaths share one fill rule. Draw-and-clip paints the outline before restricting later paint."
    },
    {
      name: "transform canvas={...}",
      category: "canvas transform",
      status: "partial",
      implementedBy: "src/engine/evaluate.js:transformCanvasTransform + src/engine/evaluate.js:interpretPathStatement",
      notes: "Uniform scale, rotation, and shifts are applied after normal coordinate transforms, including path stroke metrics. PGF's automatic picture-size tracking is locally disabled; general non-uniform node anchor geometry remains partial."
    }
  ],
  examples: [
    String.raw`\path[draw, thick] (A) -- (B) node[midway, above] {$x$};`
  ]
};
