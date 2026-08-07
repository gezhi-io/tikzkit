# Semantic Audit: groupplots-edge-descriptions-top-right.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 7 | 22 | 0 | 10 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `pgfplots` | partial / src/pgfplots/axisEnvironment.js:expandPgfplotsAxes; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisLines.js:axisOuterBounds; src/frontend/latex-shell.js:pgfplotsPictureStyleOptions; src/pgfplots/histogram.js:preparePgfplotsHistogram; src/pgfplots/plotNodes.js:renderNodesNearCoords/lowerNodeNearCoordTextTemplate; src/pgfplots/plotReferences.js:lowerPgfplotsPlotReferences; src/pgfplots/rangeResolver.js:computeAxisRanges; src/pgfplots/axis3d.js:renderAxis3DTicks/renderAxisLabels3D; src/pgfplots/geometry.js:axisContainerMargin/createPgfplots3DViewProjection/pgfplotsViewDirection; src/pgfplots/labels.js:renderAxisLabels; src/pgfplots/ticks.js:renderTickScaleLabel; src/pgfplots/gnuplot.js:sampleRawGnuplotAddplot; src/pgfplots/rawGnuplotRuntime.js; src/tikz/plotReferenceSamples.js; src/renderers/svg/mathMatrixFallback.js:renderMathMatrixFallback; src/renderers/svg/plainTextNode.js:renderPlainTextNodeWithTextEngine; scripts/gallery-resources.js:galleryRenderOptions | /usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty | yes |
| pgfplots-library | `groupplots` | partial / src/frontend/latex-shell.js:expandPgfplotsGroupplots/renderGroupplotAsAxes; src/pgfplots/axisTikzLowering.js:renderCurrentAxisCoordinates | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.groupplots.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\addplot` | 4 | 26, 28, 30, 32 | src/pgfplots/addplotParser.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | verified |
| `\begin` | 3 | 6, 7, 8 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 3 | 33, 34, 35 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\nextgroupplot` | 4 | 25, 27, 29, 31 | src/frontend/latex-shell.js:renderGroupplotAsAxes | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.groupplots.code.tex | partial | verified |
| `\usepackage` | 1 | 3 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usepgfplotslibrary` | 1 | 4 | src/pgfplots/axisOptions.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 6 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 7 | src/frontend/parser.js | stable | verified |
| `groupplot` | 1 | 8 | src/pgfplots/axisEnvironment.js | partial | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| addplot | `blue` | `true` | 26 | src/pgfplots/addplotParser.js | verified |
| addplot | `green!60!black` | `true` | 30 | src/pgfplots/addplotParser.js | verified |
| addplot | `orange` | `true` | 32 | src/pgfplots/addplotParser.js | verified |
| addplot | `red` | `true` | 28 | src/pgfplots/addplotParser.js | verified |
| addplot | `thick` | `true` | 26, 28, 30, 32 | src/pgfplots/addplotParser.js | verified |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | verified |
| groupplot | `grid` | `major` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `group style` | `{<br>    group name=measurements,<br>    group size=2 by 2,<br>    x descriptions at=edge top,<br>    y descriptions at=edge right,<br>    horizontal sep=0.5cm,<br>    vertical sep=0.5cm<br>  }` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `group style / group name` | `measurements` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `group style / group size` | `2 by 2` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `group style / horizontal sep` | `0.5cm` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `group style / vertical sep` | `0.5cm` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `group style / x descriptions at` | `edge top` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `group style / y descriptions at` | `edge right` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `height` | `3.5cm` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `width` | `4cm` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `xlabel` | `{time $t$ / h}` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `xmax` | `2` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `xmin` | `0` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `ylabel` | `{$c$ / mol/L}` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `ymax` | `2` | 8 | src/pgfplots/axisOptions.js | verified |
| groupplot | `ymin` | `0` | 8 | src/pgfplots/axisOptions.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| addplot | `0` | 7 | 26, 28, 30, 32 | src/pgfplots/axisOptions.js | verified |
| addplot | `1` | 9 | 26, 28, 30, 32 | src/pgfplots/axisOptions.js | verified |
| addplot | `2` | 8 | 26, 28, 30, 32 | src/pgfplots/axisOptions.js | verified |
| option:addplot | `60` | 1 | 30 | src/pgfplots/addplotParser.js | verified |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | verified |
| option:groupplot | `0` | 2 | 19, 20 | src/pgfplots/axisOptions.js | verified |
| option:groupplot | `0.5cm` | 2 | 14, 15 | src/pgfplots/axisOptions.js | verified |
| option:groupplot | `2` | 4 | 11, 19, 20 | src/pgfplots/axisOptions.js | verified |
| option:groupplot | `3.5cm` | 1 | 18 | src/pgfplots/axisOptions.js | verified |
| option:groupplot | `4cm` | 1 | 17 | src/pgfplots/axisOptions.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
