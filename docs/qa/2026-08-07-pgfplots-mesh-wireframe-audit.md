# Semantic Audit: plot-box-ratio-3d.tex

Status: **incomplete**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 6 | 9 | 0 | 7 | 1 | 34 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `pgfplots` | partial / src/pgfplots/axisEnvironment.js:expandPgfplotsAxes; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisLines.js:axisOuterBounds; src/frontend/latex-shell.js:pgfplotsPictureStyleOptions; src/pgfplots/histogram.js:preparePgfplotsHistogram; src/pgfplots/plotNodes.js:renderNodesNearCoords/lowerNodeNearCoordTextTemplate; src/pgfplots/plotReferences.js:lowerPgfplotsPlotReferences; src/pgfplots/rangeResolver.js:computeAxisRanges; src/pgfplots/axis3d.js:renderAxis3DTicks/renderAxisLabels3D; src/pgfplots/geometry.js:axisContainerMargin/createPgfplots3DViewProjection/pgfplotsViewDirection; src/pgfplots/labels.js:renderAxisLabels; src/pgfplots/ticks.js:renderTickScaleLabel; src/pgfplots/gnuplot.js:sampleRawGnuplotAddplot; src/pgfplots/rawGnuplotRuntime.js; src/tikz/plotReferenceSamples.js; src/renderers/svg/mathMatrixFallback.js:renderMathMatrixFallback; src/renderers/svg/plainTextNode.js:renderPlainTextNodeWithTextEngine; scripts/gallery-resources.js:galleryRenderOptions | /usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty | no |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\addplot` | 1 | 15 | src/pgfplots/addplotParser.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | todo |
| `\begin` | 3 | 5, 6, 7 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |
| `\end` | 3 | 16, 17, 18 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |
| `\pgfplotsset` | 1 | 4 | src/pgfplots/axisOptions.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | todo |
| `\usepackage` | 1 | 3 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 5 | src/frontend/latex-shell.js | stable | todo |
| `tikzpicture` | 1 | 6 | src/frontend/parser.js | stable | todo |
| `axis` | 1 | 7 | src/pgfplots/axisEnvironment.js | partial | todo |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| axis | `mesh` | `true` | 7 | src/pgfplots/axisOptions.js | todo |
| axis | `no marks` | `true` | 7 | src/pgfplots/axisOptions.js | todo |
| axis | `plot box ratio` | `{1}{2}{1}` | 7 | src/pgfplots/axisOptions.js | todo |
| axis | `samples` | `10` | 7 | src/pgfplots/axisOptions.js | todo |
| axis | `view` | `{120}{35}` | 7 | src/pgfplots/axisOptions.js | todo |
| axis | `width` | `5cm` | 7 | src/pgfplots/axisOptions.js | todo |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | todo |
| documentclass | `tikz` | `true` | 2 | src/engine/options.js | todo |
| pgfplotsset | `compat` | `newest` | 4 | src/pgfplots/axisOptions.js | todo |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| option:axis | `1` | 2 | 13 | src/pgfplots/axisOptions.js | todo |
| option:axis | `10` | 1 | 9 | src/pgfplots/axisOptions.js | todo |
| option:axis | `120` | 1 | 12 | src/pgfplots/axisOptions.js | todo |
| option:axis | `2` | 1 | 13 | src/pgfplots/axisOptions.js | todo |
| option:axis | `35` | 1 | 12 | src/pgfplots/axisOptions.js | todo |
| option:axis | `5cm` | 1 | 8 | src/pgfplots/axisOptions.js | todo |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | todo |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |
| 15 | `y` | src/pgfplots/expressions.js | todo |

## Acceptance Gate

### Required Reviews

- dependency:package:pgfplots: local source not reviewed
- command:\addplot: local source not reviewed
- command:\addplot: review required
- command:\begin: local source not reviewed
- command:\begin: review required
- command:\documentclass: local source not reviewed
- command:\documentclass: review required
- command:\end: local source not reviewed
- command:\end: review required
- command:\pgfplotsset: local source not reviewed
- command:\pgfplotsset: review required
- command:\usepackage: local source not reviewed
- command:\usepackage: review required
- environment:document: review required
- environment:tikzpicture: review required
- environment:axis: review required
- option:axis:mesh: review required
- option:axis:no marks: review required
- option:axis:plot box ratio: review required
- option:axis:samples: review required
- option:axis:view: review required
- option:axis:width: review required
- option:documentclass:border: review required
- option:documentclass:tikz: review required
- option:pgfplotsset:compat: review required
- number:option:axis:1: review required
- number:option:axis:10: review required
- number:option:axis:120: review required
- number:option:axis:2: review required
- number:option:axis:35: review required
- number:option:axis:5cm: review required
- number:option:documentclass:2pt: review required
- expression:addplot:1: review required
- case: explicit caseStatus=accepted is required
