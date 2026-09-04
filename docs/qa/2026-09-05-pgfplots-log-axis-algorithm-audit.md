# Semantic Audit: algorithm.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 7 | 15 | 0 | 18 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `pgfplots` | partial / src/pgfplots/axisEnvironment.js:expandPgfplotsAxes; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisLines.js:axisOuterBounds; src/frontend/latex-shell.js:pgfplotsPictureStyleOptions; src/pgfplots/histogram.js:preparePgfplotsHistogram; src/pgfplots/plotNodes.js:renderNodesNearCoords/lowerNodeNearCoordTextTemplate; src/pgfplots/plotReferences.js:lowerPgfplotsPlotReferences; src/pgfplots/rangeResolver.js:computeAxisRanges; src/pgfplots/axis3d.js:renderAxis3DTicks/renderAxisLabels3D; src/pgfplots/geometry.js:axisContainerMargin/axisHasExplicitDescriptionPlacement/createPgfplots3DViewProjection/pgfplotsViewDirection; src/pgfplots/labels.js:renderAxisLabels/middleAxisPlainYLabelLayoutOptions; src/pgfplots/ticks.js:renderTickScaleLabel; src/pgfplots/gnuplot.js:sampleRawGnuplotAddplot; src/pgfplots/rawGnuplotRuntime.js; src/tikz/plotReferenceSamples.js; src/renderers/svg/mathMatrixFallback.js:renderMathMatrixFallback; src/renderers/svg/plainTextNode.js:renderPlainTextNodeWithTextEngine; scripts/gallery-resources.js:galleryRenderOptions; src/pgfplots/axis3d.js:renderAxis3DColorbar/colorbarOrientation/colorbarBox/colorbarGradientStops; src/renderers/svg/defs.js:renderAxisGradientDef arbitrary stops; src/pgfplots/axis3d.js:axis3DParentBounds parent-description geometry for default 3D colorbar anchors; src/pgfplots/logAxis.js:axisLogBase/axisLogMajorTickValues/axisLogMinorTickValues/axisLogTickLabel; src/pgfplots/rangeResolver.js:logarithmic survey filtering; src/pgfplots/transformDataToCanvas.js:custom-base transforms | /usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\addlegendentry` | 1 | 21 | src/pgfplots/legend.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | verified |
| `\addplot` | 1 | 18 | src/pgfplots/addplotParser.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | verified |
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
| `semilogxaxis` | 1 | 6 | src/pgfplots/axisEnvironment.js | partial | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| addplot | `blue` | `true` | 18 | src/pgfplots/addplotParser.js | verified |
| addplot | `mark` | `*` | 18 | src/pgfplots/addplotParser.js | verified |
| addplot | `very thick` | `true` | 18 | src/pgfplots/addplotParser.js | verified |
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| pgfplotsset | `compat` | `1.18` | 3 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `grid` | `both` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `height` | `6cm` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `legend pos` | `north west` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `width` | `10cm` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `xlabel` | `{Input size $n$}` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `xmax` | `1000` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `xmin` | `1` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `ylabel` | `{Runtime (ms)}` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `ymax` | `4` | 6 | src/pgfplots/axisOptions.js | verified |
| semilogxaxis | `ymin` | `0` | 6 | src/pgfplots/axisOptions.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| literal | `-10` | 1 | 19 | src/engine/units.js | verified |
| literal | `0.4` | 1 | 19 | src/engine/units.js | verified |
| literal | `0.8` | 1 | 19 | src/engine/units.js | verified |
| literal | `1` | 1 | 19 | src/engine/units.js | verified |
| literal | `1.7` | 1 | 19 | src/engine/units.js | verified |
| literal | `10` | 1 | 19 | src/engine/units.js | verified |
| literal | `100` | 1 | 19 | src/engine/units.js | verified |
| literal | `1000` | 1 | 19 | src/engine/units.js | verified |
| literal | `3.4` | 1 | 19 | src/engine/units.js | verified |
| literal | `3.8` | 1 | 19 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| option:pgfplotsset | `1.18` | 1 | 3 | src/pgfplots/axisOptions.js | verified |
| option:semilogxaxis | `0` | 1 | 11 | src/pgfplots/axisOptions.js | verified |
| option:semilogxaxis | `1` | 1 | 9 | src/pgfplots/axisOptions.js | verified |
| option:semilogxaxis | `1000` | 1 | 10 | src/pgfplots/axisOptions.js | verified |
| option:semilogxaxis | `10cm` | 1 | 7 | src/pgfplots/axisOptions.js | verified |
| option:semilogxaxis | `4` | 1 | 12 | src/pgfplots/axisOptions.js | verified |
| option:semilogxaxis | `6cm` | 1 | 8 | src/pgfplots/axisOptions.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
