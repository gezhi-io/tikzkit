# Semantic Audit: math.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 6 | 15 | 0 | 13 | 1 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `pgfplots` | partial / src/pgfplots/axisEnvironment.js:expandPgfplotsAxes; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisLines.js:axisOuterBounds; src/frontend/latex-shell.js:pgfplotsPictureStyleOptions; src/pgfplots/histogram.js:preparePgfplotsHistogram; src/pgfplots/plotNodes.js:renderNodesNearCoords/lowerNodeNearCoordTextTemplate; src/pgfplots/plotReferences.js:lowerPgfplotsPlotReferences; src/pgfplots/rangeResolver.js:computeAxisRanges; src/pgfplots/axis3d.js:renderAxis3DTicks/renderAxisLabels3D; src/pgfplots/geometry.js:axisContainerMargin/axisHasExplicitDescriptionPlacement/createPgfplots3DViewProjection/pgfplotsViewDirection; src/pgfplots/labels.js:renderAxisLabels/middleAxisPlainYLabelLayoutOptions; src/pgfplots/ticks.js:renderTickScaleLabel; src/pgfplots/gnuplot.js:sampleRawGnuplotAddplot; src/pgfplots/rawGnuplotRuntime.js; src/tikz/plotReferenceSamples.js; src/renderers/svg/mathMatrixFallback.js:renderMathMatrixFallback; src/renderers/svg/plainTextNode.js:renderPlainTextNodeWithTextEngine; scripts/gallery-resources.js:galleryRenderOptions; src/pgfplots/axis3d.js:renderAxis3DColorbar/colorbarOrientation/colorbarBox/colorbarGradientStops; src/renderers/svg/defs.js:renderAxisGradientDef arbitrary stops; src/pgfplots/axis3d.js:axis3DParentBounds parent-description geometry for default 3D colorbar anchors; src/pgfplots/logAxis.js:axisLogBase/axisLogMajorTickValues/axisLogMinorTickValues/axisLogTickLabel; src/pgfplots/rangeResolver.js:logarithmic survey filtering; src/pgfplots/transformDataToCanvas.js:custom-base transforms | /usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\addplot` | 1 | 21 | src/pgfplots/addplotParser.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | verified |
| `\begin` | 3 | 4, 5, 6 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 3 | 22, 23, 24 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\pgfplotsset` | 1 | 3 | src/pgfplots/axisOptions.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 4 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 5 | src/frontend/parser.js | stable | verified |
| `axis` | 1 | 6 | src/pgfplots/axisEnvironment.js | partial | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| axis | `domain` | `0:3` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `grid` | `both` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `height` | `8cm` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `samples` | `11` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `view` | `{40}{30}` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `width` | `10cm` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `xlabel` | `{$x$}` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `y domain` | `0:3` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `ylabel` | `{$y$}` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `zlabel` | `{$10^{x+y}$}` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `zmax` | `1000000` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `zmin` | `1` | 6 | src/pgfplots/axisOptions.js | verified |
| axis | `zmode` | `log` | 6 | src/pgfplots/axisOptions.js | verified |
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| pgfplotsset | `compat` | `1.18` | 3 | src/pgfplots/axisOptions.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| expression:addplot:1 | `10` | 1 | 21 | src/pgfplots/expressions.js | verified |
| option:axis | `0` | 2 | 10, 11 | src/pgfplots/axisOptions.js | verified |
| option:axis | `1` | 1 | 14 | src/pgfplots/axisOptions.js | verified |
| option:axis | `10` | 1 | 19 | src/pgfplots/axisOptions.js | verified |
| option:axis | `1000000` | 1 | 15 | src/pgfplots/axisOptions.js | verified |
| option:axis | `10cm` | 1 | 7 | src/pgfplots/axisOptions.js | verified |
| option:axis | `11` | 1 | 12 | src/pgfplots/axisOptions.js | verified |
| option:axis | `3` | 2 | 10, 11 | src/pgfplots/axisOptions.js | verified |
| option:axis | `30` | 1 | 9 | src/pgfplots/axisOptions.js | verified |
| option:axis | `40` | 1 | 9 | src/pgfplots/axisOptions.js | verified |
| option:axis | `8cm` | 1 | 8 | src/pgfplots/axisOptions.js | verified |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| option:pgfplotsset | `1.18` | 1 | 3 | src/pgfplots/axisOptions.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |
| 21 | `10^(x+y)` | src/pgfplots/expressions.js | verified |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.

