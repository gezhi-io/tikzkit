export const SUPPORT_STATUS = ["none", "partial", "stable"];

export const capabilityMatrix = {
  frontend_active_figure_scan: {
    id: "frontend_active_figure_scan",
    parser: "stable",
    semantic: "none",
    svg: "none",
    modules: ["src/frontend/parser.js", "src/frontend/latex-shell.js"],
    fixtures: ["test/fixtures/basic/multi-figure-active.tex"],
    verification: {
      oracle: "unit-test",
      tests: ["test/frontend.test.js", "test/parser.test.js"]
    },
    notes: "The frontend scans all tikzpicture environments, exposes a figure inventory, and can parse a requested activeFigureId while preserving preamble style/macro context for that figure."
  },
  path_statement: {
    id: "path_statement",
    parser: "stable",
    semantic: "stable",
    svg: "stable",
    modules: ["src/frontend/parser.js", "src/engine/evaluate.js", "src/renderers/svg/paths.js"],
    fixtures: ["test/fixtures/basic/paths-polyline-cycle.tikz"],
    verification: {
      oracle: "unit-test",
      tests: ["test/engine.test.js", "test/svg-renderer.test.js"]
    },
    notes: "Core move/line/curve/close path statements lower to SceneGraph path items before SVG rendering."
  },
  path_curves: {
    id: "path_curves",
    parser: "stable",
    semantic: "partial",
    svg: "partial",
    modules: ["src/engine/pathBuilder.js", "src/scene/bbox.js", "src/renderers/svg/pathData.js"],
    fixtures: ["test/fixtures/basic/path-curves.tikz"],
    verification: {
      oracle: "unit-test",
      tests: ["test/geometry.test.js", "test/svg-renderer.test.js"]
    },
    notes: "Bezier curves render and use tight bounds; full TikZ curve/path shortening semantics remain partial."
  },
  node_statement: {
    id: "node_statement",
    parser: "stable",
    semantic: "partial",
    svg: "partial",
    modules: ["src/tikz/commands/node.js", "src/engine/evaluate.js", "src/renderers/svg/renderSvg.js"],
    fixtures: ["test/fixtures/basic/nodes-math-box.tikz"],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/interpreter.test.js", "test/renderer.test.js"]
    },
    notes: "Common node placement, text, and node boxes are supported; full PGF shape library parity is tracked separately."
  },
  node_text_measurement: {
    id: "node_text_measurement",
    parser: "stable",
    semantic: "partial",
    svg: "partial",
    modules: ["src/index.js", "src/tikz/textMetrics.js", "src/tikz/text.js", "src/renderers/svg/textEngine.js", "src/renderers/svg/mathNode.js", "src/renderers/svg/textLayout.js"],
    fixtures: [
      "test/fixtures/basic/node-text-measurement.tikz",
      "test/fixtures/examples/latex-examples/aggregation-blocks.tex"
    ],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/convert.test.js", "test/svg-renderer.test.js"],
      artifacts: ["outputs/qa-plain-node-logical-metrics"]
    },
    notes: "KaTeX/svg-text sizing now has a dedicated renderer text-engine boundary with measured baseline/midline and cached render payloads; public svg-text conversion creates the textEngine before engine evaluation and node sizing can consume math and plain text metrics, including TikZ text width for plain wrapped nodes. SVG plain text rendering can reuse the same textEngine cache payload while preserving font weight/style. Async conversion can run bounded multi-pass text measurement flushes and reevaluate node layout until the text engine reports no pending work; exhausting the pass limit emits a warning diagnostic. Full paragraph shaping remains partial. Normal single-line unwrapped Main-Regular plain nodes now use verified logical TeX box metrics for semantic node sizing and anchors. Remaining gaps include wrapped paragraph/minipage text, mixed inline math, styled fonts, glyph paint fidelity, and broader shaping/unsupported characters."
  },
  foreach_statement: {
    id: "foreach_statement",
    parser: "stable",
    semantic: "partial",
    svg: "stable",
    modules: ["src/tikz/commands/foreach.js", "src/engine/evaluate.js", "src/frontend/latex-shell.js"],
    fixtures: ["test/fixtures/basic/foreach-grid.tikz"],
    verification: {
      oracle: "unit-test",
      tests: ["test/interpreter.test.js", "test/engine.test.js"]
    },
    notes: "Common foreach expansion works, including several option forms; full TeX macro interaction remains partial."
  },
  arrow_tips: {
    id: "arrow_tips",
    parser: "stable",
    semantic: "partial",
    svg: "partial",
    modules: ["src/tikz/metrics.js", "src/engine/options.js", "src/renderers/svg/paths.js", "src/renderers/svg/markers.js"],
    fixtures: ["test/fixtures/basic/arrow-tips.tikz"],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/renderer.test.js", "test/svg-renderer.test.js"]
    },
    notes: "inline tip paths and terminal shaft shortening are implemented for common tips; classic stealth uses the PGF base formula 0.28pt + 0.3*line width and the thin/thick calibrations are verified against TeX Live 2025; full arrows.meta grammar and curved-path slicing remain partial."
  },
  matrix_node: {
    id: "matrix_node",
    parser: "partial",
    semantic: "partial",
    svg: "partial",
    modules: ["src/libraries/matrix.js", "src/tikz/libraries/matrix.js", "src/engine/evaluate.js"],
    fixtures: ["test/fixtures/basic/matrix-node.tikz"],
    verification: {
      oracle: "unit-test",
      tests: ["test/library-modules.test.js", "test/interpreter.test.js"]
    },
    notes: "Matrix of nodes has focused compatibility support for observed cases."
  },
  decorations_pathmorphing: {
    id: "decorations_pathmorphing",
    parser: "partial",
    semantic: "partial",
    svg: "partial",
    modules: ["src/tikz/libraries/decorations.pathmorphing.js", "src/engine/evaluate.js"],
    fixtures: ["test/fixtures/basic/decorations-pathmorphing-snake.tikz"],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/library-modules.test.js", "test/renderer.test.js"]
    },
    notes: "Snake/path morphing support is case-driven and not yet a complete PGF decorations engine."
  },
  datavisualization_functions: {
    id: "datavisualization_functions",
    parser: "partial",
    semantic: "partial",
    svg: "partial",
    modules: ["src/tikz/libraries/datavisualization.js", "src/tikz/libraries/datavisualization.formats.functions.js", "src/frontend/latex-shell.js"],
    fixtures: ["test/fixtures/basic/datavisualization-functions.tex"],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/extensions.test.js", "test/example-render-script.test.js"]
    },
    notes: "Function-format data visualization examples lower to TikZ-compatible plots; native survey pipeline, legends, and polar axes are incomplete."
  },
  pgfplots_axis: {
    id: "pgfplots_axis",
    parser: "partial",
    semantic: "partial",
    svg: "partial",
    modules: ["src/pgfplots/axisEnvironment.js", "src/pgfplots/axisOptions.js", "src/pgfplots/axisTikzLowering.js", "src/pgfplots/ticks.js"],
    fixtures: [
      "test/fixtures/examples/pgfplots/axis-basic-range.tex",
      "test/fixtures/examples/pgfplots/axis-middle-lines.tex",
      "test/fixtures/examples/latex-examples/2d-parted-function.tex",
      "test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex"
    ],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/pgfplots-seams.test.js", "test/example-render-script.test.js"],
      artifacts: [
        "outputs/qa-pgfplots-middle-axis-framing",
        "outputs/qa-pgfplots-middle-axis-labels",
        "outputs/qa-pgfplots-classic-stealth-axes",
        "outputs/qa-pgfplots-tick-label-metrics-alignment",
        "outputs/qa-pgfplots-compact-middle-axis-tick-density"
      ]
    },
    notes: "Axis environments lower through an Axis Model seam. Default enlarged middle-axis framing is verified only for default-size enlarged middle axes against two real visual gates, using the exact 45pt reserve and exact 0.2pt outer margins; these are the 0.2pt base outer margins. The verified middle-axis terminal labels use PGFPlots ticklabel* cs:1 against the final transformed limits while explicit label description coordinates, boxed axes, and datavis placement remain unchanged. The classic stealth axis gate is also verified with the exact 0.4pt, -stealth visual style. Local TeX Live pgfplots.code.tex and pgfplotsticks.code.tex sources were reviewed for non-boxed middle-axis ticks: default labels inherit the normal font and ordinary TikZ inner sep, inside/center/outside plus independent per-axis alignment drive both major/minor tick segments and label points, and explicit nonnegative x/y tick-label distances including 0pt take precedence. For compact middle-axis x ranges, the verified automatic tick-density override activates only when geometry.transformRanges shows actual x-range enlargement, and grid lines share the same selected count. Parser, semantic, and SVG support remain partial; this does not claim stable or full PGFPlots parity. Remaining gaps are boxed tick-label font/bbox calibration; broader automatic tick density and origin/padded minor behavior; other label placements/styles/rotation; 3D tick labels; non-enlarged outer-margin calibration; layer ordering and paint order parity; the transitional auto-Y bottom tick-label overflow reserve; and broader PGFPlots input handlers."
  },
  pgfplots_addplot: {
    id: "pgfplots_addplot",
    parser: "partial",
    semantic: "partial",
    svg: "partial",
    modules: ["src/pgfplots/addplot.js", "src/pgfplots/addplotParser.js", "src/pgfplots/addplotLowering.js", "src/pgfplots/plotPath.js"],
    fixtures: ["test/fixtures/pgfplots/addplot-coordinates.tex"],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/pgfplots-seams.test.js", "test/pgfplots-docsrc.test.js"]
    },
    notes: "Coordinate/expression/function plots are supported for observed cases; full pgfplots input handlers are incomplete."
  },
  pgfplots_3d_surface: {
    id: "pgfplots_3d_surface",
    parser: "partial",
    semantic: "partial",
    svg: "partial",
    modules: ["src/pgfplots/axis3d.js", "src/pgfplots/surface.js", "src/pgfplots/rangeResolver.js"],
    fixtures: [
      "test/fixtures/examples/latex-examples/3d-manhattan-bar-plot.tex",
      "test/fixtures/examples/latex-examples/3d-gaussian-distribution.tex",
      "test/fixtures/examples/latex-examples/3d-function-8.tex",
      "test/fixtures/examples/latex-examples/3d-function-2.tex",
      "test/fixtures/examples/latex-examples/3d-gradient-cos.tex"
    ],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/pgfplots-seams.test.js", "test/example-render-script.test.js"],
      artifacts: ["outputs/qa-pgfplots-3d-annotation", "outputs/qa-pgfplots-faceted-order"]
    },
    notes: "View-aware projected-edge annotation layout is verified for opposing views. Per-patch faceted painter ordering is verified. Remaining differences include projection calibration, surface/color interpolation, overlays, colorbar placement, exact TeX glyph metrics, and unsupported shader/patch modes."
  },
  pgfplots_colorbar: {
    id: "pgfplots_colorbar",
    parser: "partial",
    semantic: "partial",
    svg: "partial",
    modules: ["src/pgfplots/axis3d.js", "src/pgfplots/axisOptions.js"],
    fixtures: ["test/fixtures/implementation-examples/latex-examples-master/3d-function-semicubical-parabola.tex"],
    verification: {
      oracle: "unit-test+tikztosvg",
      tests: ["test/pgfplots-seams.test.js", "test/example-render-script.test.js"]
    },
    notes: "Colorbar rendering exists, but style placement, title spacing, and tick label collision remain partial."
  },
  latex_shell_packages: {
    id: "latex_shell_packages",
    parser: "partial",
    semantic: "partial",
    svg: "none",
    modules: ["src/frontend/latex-shell.js", "src/packages/index.js", "src/packages/declarations.js"],
    fixtures: ["test/fixtures/basic/latex-shell-packages.tex"],
    verification: {
      oracle: "unit-test",
      tests: ["test/package-modules.test.js", "test/frontend.test.js"]
    },
    notes: "Package declarations are collected and normalized for supported compatibility slices; arbitrary package semantics are not implemented."
  },
  browser_workbench: {
    id: "browser_workbench",
    parser: "stable",
    semantic: "stable",
    svg: "stable",
    modules: ["web/server.js", "web/workbench.js", "web/app.js", "web/qaGrid.js"],
    fixtures: ["test/fixtures/examples/milestone-1.json"],
    verification: {
      oracle: "browser+unit-test",
      tests: ["test/web-server.test.js", "test/web-workbench.test.js", "test/web-qa-grid.test.js"]
    },
    notes: "The workbench renders through src/index.js in the browser. Reference artifacts are generated offline and are not a browser runtime dependency."
  }
};
