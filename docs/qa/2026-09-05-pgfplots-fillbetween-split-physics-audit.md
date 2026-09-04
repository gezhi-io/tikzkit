# Semantic Audit: physics.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 7 | 28 | 0 | 19 | 2 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `pgfplots` | partial / src/pgfplots/axisEnvironment.js:expandPgfplotsAxes; src/pgfplots/axisTikzLowering.js:renderPgfplotsAxisAsTikz; src/pgfplots/axisLines.js:axisOuterBounds; src/frontend/latex-shell.js:pgfplotsPictureStyleOptions; src/pgfplots/histogram.js:preparePgfplotsHistogram; src/pgfplots/plotNodes.js:renderNodesNearCoords/lowerNodeNearCoordTextTemplate; src/pgfplots/plotReferences.js:lowerPgfplotsPlotReferences; src/pgfplots/rangeResolver.js:computeAxisRanges; src/pgfplots/axis3d.js:renderAxis3DTicks/renderAxisLabels3D; src/pgfplots/geometry.js:axisContainerMargin/axisHasExplicitDescriptionPlacement/createPgfplots3DViewProjection/pgfplotsViewDirection; src/pgfplots/labels.js:renderAxisLabels/middleAxisPlainYLabelLayoutOptions; src/pgfplots/ticks.js:renderTickScaleLabel; src/pgfplots/gnuplot.js:sampleRawGnuplotAddplot; src/pgfplots/rawGnuplotRuntime.js; src/tikz/plotReferenceSamples.js; src/renderers/svg/mathMatrixFallback.js:renderMathMatrixFallback; src/renderers/svg/plainTextNode.js:renderPlainTextNodeWithTextEngine; scripts/gallery-resources.js:galleryRenderOptions; src/pgfplots/axis3d.js:renderAxis3DColorbar/colorbarOrientation/colorbarBox/colorbarGradientStops; src/renderers/svg/defs.js:renderAxisGradientDef arbitrary stops; src/pgfplots/axis3d.js:axis3DParentBounds parent-description geometry for default 3D colorbar anchors; src/pgfplots/logAxis.js:axisLogBase/axisLogMajorTickValues/axisLogMinorTickValues/axisLogTickLabel; src/pgfplots/rangeResolver.js:logarithmic survey filtering; src/pgfplots/transformDataToCanvas.js:custom-base transforms; src/pgfplots/geometry.js:z logarithmic transform and projection; src/pgfplots/axis3d.js:z logarithmic ticks and labels; src/pgfplots/surface.js:logarithmic surface depth and default point-meta color; src/pgfplots/axis3d.js:axis3DRenderedTickLabels custom 3D labels and template lowering; src/pgfplots/ticks.js:shared tick-label list/style/template helpers; src/pgfplots/ticks.js:renderTickLabelTemplate/pgfNumberFormatOptions; src/pgfplots/format.js:formatAxisTickLabel; src/pgf/numberFormat.js:pgfNumberFormatOptions/pgfScientificParts/formatPgfScientificNumber shared PGF number semantics | /usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty | yes |
| pgfplots-library | `fillbetween` | partial / src/pgfplots/fillBetween.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\addplot` | 3 | 21, 28, 35 | src/pgfplots/addplotParser.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | verified |
| `\begin` | 3 | 6, 7, 8 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 3 | 41, 42, 43 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\pgfplotsset` | 1 | 4 | src/pgfplots/axisOptions.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | partial | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usepgfplotslibrary` | 1 | 3 | src/pgfplots/axisOptions.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 6 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 7 | src/frontend/parser.js | stable | verified |
| `axis` | 1 | 8 | src/pgfplots/axisEnvironment.js | partial | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| addplot | `black` | `true` | 21 | src/pgfplots/addplotParser.js | verified |
| addplot | `domain` | `0.25:9.75` | 21, 28 | src/pgfplots/addplotParser.js | verified |
| addplot | `fill` | `blue!28` | 35 | src/pgfplots/addplotParser.js | verified |
| addplot | `fill opacity` | `0.72` | 35 | src/pgfplots/addplotParser.js | verified |
| addplot | `gray!70!black` | `true` | 28 | src/pgfplots/addplotParser.js | verified |
| addplot | `name path` | `signal`<br>`zero` | 21, 28 | src/pgfplots/addplotParser.js | verified |
| addplot | `samples` | `191`<br>`2` | 21, 28 | src/pgfplots/addplotParser.js | verified |
| addplot | `thick` | `true` | 28 | src/pgfplots/addplotParser.js | verified |
| addplot | `very thick` | `true` | 21 | src/pgfplots/addplotParser.js | verified |
| axis | `axis lines` | `middle` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `grid` | `major` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `height` | `6cm` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `title` | `{Positive and negative displacement of a damped oscillator}` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `width` | `11cm` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `xlabel` | `{$t$}` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `xmax` | `9.75` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `xmin` | `0.25` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `ylabel` | `{$x(t)$}` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `ymax` | `1` | 8 | src/pgfplots/axisOptions.js | verified |
| axis | `ymin` | `-1` | 8 | src/pgfplots/axisOptions.js | verified |
| documentclass | `border` | `4pt` | 1 | src/engine/options.js | verified |
| fill between | `every even segment/.style` | `{fill=blue!28}` | 35 | src/pgfplots/fillBetween.js | verified |
| fill between | `every even segment/.style / fill` | `blue!28` | 35 | src/pgfplots/fillBetween.js | verified |
| fill between | `every odd segment/.style` | `{fill=red!28}` | 35 | src/pgfplots/fillBetween.js | verified |
| fill between | `every odd segment/.style / fill` | `red!28` | 35 | src/pgfplots/fillBetween.js | verified |
| fill between | `of` | `signal and zero` | 35 | src/pgfplots/fillBetween.js | verified |
| fill between | `split` | `true` | 35 | src/pgfplots/fillBetween.js | verified |
| pgfplotsset | `compat` | `1.18` | 4 | src/pgfplots/axisOptions.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| expression:addplot:1 | `-0.18` | 1 | 27 | src/pgfplots/expressions.js | verified |
| expression:addplot:1 | `90` | 1 | 27 | src/pgfplots/expressions.js | verified |
| expression:addplot:2 | `0` | 1 | 34 | src/pgfplots/expressions.js | verified |
| option:addplot | `0.25` | 2 | 25, 32 | src/pgfplots/addplotParser.js | verified |
| option:addplot | `0.72` | 1 | 35 | src/pgfplots/addplotParser.js | verified |
| option:addplot | `191` | 1 | 26 | src/pgfplots/addplotParser.js | verified |
| option:addplot | `2` | 1 | 33 | src/pgfplots/addplotParser.js | verified |
| option:addplot | `28` | 1 | 35 | src/pgfplots/addplotParser.js | verified |
| option:addplot | `70` | 1 | 30 | src/pgfplots/addplotParser.js | verified |
| option:addplot | `9.75` | 2 | 25, 32 | src/pgfplots/addplotParser.js | verified |
| option:axis | `-1` | 1 | 13 | src/pgfplots/axisOptions.js | verified |
| option:axis | `0.25` | 1 | 11 | src/pgfplots/axisOptions.js | verified |
| option:axis | `1` | 1 | 14 | src/pgfplots/axisOptions.js | verified |
| option:axis | `11cm` | 1 | 9 | src/pgfplots/axisOptions.js | verified |
| option:axis | `6cm` | 1 | 10 | src/pgfplots/axisOptions.js | verified |
| option:axis | `9.75` | 1 | 12 | src/pgfplots/axisOptions.js | verified |
| option:documentclass | `4pt` | 1 | 1 | src/engine/options.js | verified |
| option:fill between | `28` | 2 | 38, 39 | src/pgfplots/fillBetween.js | verified |
| option:pgfplotsset | `1.18` | 1 | 4 | src/pgfplots/axisOptions.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |
| 21 | `exp(-0.18*x)*sin(90*x)` | src/pgfplots/expressions.js | verified |
| 28 | `0` | src/pgfplots/expressions.js | verified |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
