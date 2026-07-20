export const tikzCommand = {
  name: "path",
  kind: "command",
  status: "core",
  implementedBy: [
    "src/frontend/parser.js:parsePathStatement",
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
      name: "to / edge",
      category: "path operation",
      status: "partial",
      implementedBy: "src/frontend/parser.js:parsePathTargetOperation + src/engine/evaluate.js:buildPath",
      notes: "Common bend/in/out/loop cases are covered; graphdrawing is not complete."
    },
    {
      name: "circle / ellipse / rectangle / arc",
      category: "shape path",
      status: "partial",
      implementedBy: "src/frontend/parser.js:parsePathStatement + src/engine/evaluate.js:buildPath",
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
      implementedBy: "src/engine/options.js:defaultStyleForCommand + src/engine/evaluate.js",
      notes: "Fill and stroke are core; clip is limited to practical gallery slices."
    }
  ],
  examples: [
    String.raw`\path[draw, thick] (A) -- (B) node[midway, above] {$x$};`
  ]
};
