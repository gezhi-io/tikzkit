# LaTeX-examples Batch 5 Visual QA

Acceptance target: every case must render in TikZKit, have a usable tikztosvg reference when the source can compile locally, and match the reference in structure, coordinates, dimensions, text, strokes, colors, arrows, and layers. Pixel-diff numbers are supporting evidence only.

| Case | Current visual status | Observed difference | Shared owner / next action |
| --- | --- | --- | --- |
| feed-forward-perceptron | Near pass | Topology, coordinates, sizes, and colors match; small Latex-tip and circle-boundary differences remain. | Arrow tip geometry and endpoint shortening. |
| flowchart-network-design | Pending | Text is smaller, line wrapping differs, and the `no` label on the orthogonal return path is misplaced. | Text metrics, wrapped node layout, orthogonal path-label placement. |
| force-distance-diagram-constant | Blocked reference | `fill between` area is missing; `\coloneqq` prevents the local reference from compiling. | TeX-lite `\coloneqq`, fillbetween plot handler. |
| force-distance-diagram | Blocked reference | Curve renders but the filled interval is missing; axis labels overlap. | TeX-lite `\coloneqq`, fillbetween and axis-label anchors. |
| geometry-1 | Improved, pending | Negative `-90` labels are now below their points; small font/baseline differences remain. | Fixed core numeric label-angle parsing; continue math text metrics. |
| geometry-2 | Improved, pending | Negative `-90` labels are now below their points; phi-label baseline and bbox still differ. | Fixed core numeric label-angle parsing; continue math text metrics. |
| geometry-3 | Unsupported | TikZKit image is blank and tikztosvg is blocked by legacy `\usetkzobj`. | tkz-euclide compatibility slice. |
| geometry-4 | Unsupported | Triangle, dashed line, points, and labels are absent. | tkz-euclide compatibility slice. |
| geometry-5 | Unsupported | Intersections, lines, points, and labels are absent. | tkz-euclide construction/intersection commands. |
| geometry-6 | Unsupported | Parallel lines, angle fill, marks, and labels are absent. | tkz-euclide angle and segment-mark commands. |
| geometry-7 | Unsupported | Only a few labels remain; geometry and angle graphics are absent. | tkz-euclide drawing and angle commands. |
| geometry-8 | Unsupported | Output is blank. | tkz-euclide `\tkzInterLL`, segments, points, and angles. |
| geometry-9 | Unsupported | Output is blank. | tkz-euclide polygon and point commands. |
| elevation-chart | Improved, pending | CSV resource and reference now load; TikZKit still draws bars where plot-level `smooth` should override axis-level `ybar`. | Resource pipeline fixed; plot-handler precedence pending. |
| graph-banner | Near pass | Structure and node sizes match; narrow stroke-edge differences remain. | Line width, clipping, and raster alignment. |
| graph-circles | Pending | Snake amplitude, wavelength, and phase differ, especially on long edges. | decorations.pathmorphing geometry. |
| graph-content-and-structure | Pending | Headings are too condensed and bbox is slightly shifted. | Font family/metrics and text bbox. |
| graph-mrf-image-segmentation | Pending | Math subscripts enlarge node contents and circles. | Math script layout and node natural size. |
| graph-triangles | Blocked reference | Extra boundary segments appear on bottom/right edges. | Nested foreach `\ifthenelse` numeric comparison. |
| graph-v6-e8 | Near pass | Nodes/colors match; subtle clipping and line-cap differences remain. | Compound path caps and node-boundary clipping. |
| halbleiterspeicher-klassifizierung | Pending | Nodes are narrower/taller and tree edges are too thin. | Sans-serif metrics and picture-level edge-style inheritance. |
| half-space | Pending | Custom red/green hatch regions collapse to a faint triangular pattern. | Custom PGF pattern declaration, clipping, pattern color. |
| hard-limit-function | Near pass | Step function matches; extra zero tick and bbox padding remain. | Middle-axis tick suppression and bbox. |
| haskell-type-classes | Failing | Ellipses become very wide rectangles and the matrix layout is rebuilt incorrectly. | Legacy `\tikzstyle`, ellipse shape, text-width and matrix metrics. |
| heap | Pending | Layout matches, but all tree edges are thinner than native `very thick`. | Picture-level style inheritance for generated tree edges. |
| hidden-markov-model-abc-2 | Blocked reference | `\nicefrac` is not lowered; text, loops, and nodes overlap. | Preserve `units` package semantics and implement `\nicefrac`. |
| hidden-markov-model-abc | Blocked reference | Same `\nicefrac` and overlap failures as the two-node variant. | Preserve `units` package semantics and implement `\nicefrac`. |
| hidden-markov-model-three-state-symbol | Near pass | Layout is close; loop arrows, endpoints, and lower labels are slightly shifted. | Loop arrow geometry, font baseline, bbox. |
| histogram-simple | Failing | A diagonal line is rendered instead of three histogram bins. | PGFPlots `hist`, `ybar interval`, tick-label macros. |
| histogram-large-1d-dataset | Failing | Bars are absent; only node values and axes remain, with label overlap. | `/tikz/ybar interval`, nodes-near-coords, width/bbox macros. |

## Shared fixes completed in this batch

- Numeric label and pin directions now preserve unary minus, so `-90` and `-45` no longer become positive angles.
- Example resources can be declared in the manifest, loaded by the Node renderer and browser workbench, and rewritten to stable fixture-relative paths for tikztosvg.
- `elevation-chart` now carries its source `data.csv`; both TikZKit and tikztosvg can consume it.
- The `bias-variance` legend uses native left-aligned cells and has been visually verified in the browser.

## Next implementation order

1. PGFPlots plot-handler dispatch: histogram/ybar interval plus plot-level `smooth` precedence.
2. Tree edge style inheritance: `heap` and `halbleiterspeicher-klassifizierung`.
3. tkz-euclide minimal compatibility for geometry-3 through geometry-9.
4. TeX-lite package macros (`\coloneqq`, `\nicefrac`) and reference extraction.
5. Font/math-script metrics, snake geometry, custom patterns, and remaining near-pass geometry.
