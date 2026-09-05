# Semantic Audit: declared-sizing-flowchart.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 19 | 17 | 0 | 31 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js + src/frontend/parser.js:parseParabolaSegment + src/tikz/pathOperations/parabola.js:pgfParabolaCommands + src/engine/evaluate.js:resolveParabolaBend | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `arrows` | partial / src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseLegacyArrowExtents/legacyDelimiterArrowMetrics/legacyTriangleArrowMetrics/legacyDiamondArrowMetrics/legacySquareArrowMetrics/legacyCircleArrowMetrics/legacyHookArrowMetrics/legacySideToArrowMetrics/legacyImpliesArrowMetrics/legacySerifCmArrowMetrics/legacyCapArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/legacyLatexArrowGeometryFromLineWidth/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyDelimiterInlineGeometry/legacyTriangleInlineGeometry/legacyDiamondInlineGeometry/legacySquareInlineGeometry/legacyCircleInlineGeometry/legacyHookInlineGeometry/legacySideToInlineGeometry/legacyImpliesArrowInlineGeometry/legacySerifCmInlineGeometry/renderInlineArrowTip + src/frontend/latex-shell.js:expandTheoreticalComputerScienceLogoMacros + src/engine/evaluate.js:curveArrowTerminalBorderPadding/nodeBorderPoint/polygonBorderPointWithPadding/regularPolygonOuterRadiusExtension + src/tikz/libraries/arrows.js:legacyPrimeArrowMetrics + src/tikz/metrics.js:normalizeArrowKind + src/renderers/svg/paths.js:legacyPrimeArrowInlineGeometry + src/engine/evaluate.js:arrowTipShortenCoordinateLength + src/tikz/libraries/arrows.js:resolveDeclaredArrowGeometry/evaluateDeclaredDimensionProgram/evaluateDeclaredDimension/declaredArrowDrawingStyle + src/renderers/svg/paths.js:resolveInlineArrowTip/renderInlineArrowTip | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex | yes |
| tikz-library | `positioning` | builtin / src/tikz/libraries/positioning.js; src/engine/evaluate.js:nodeTextAnchorOffsets/nodeAnchorCoordinate/shapeCompassLocalAnchor | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\advance` | 2 | 10, 16 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\begin` | 2 | 34, 35 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\draw` | 3 | 44, 45, 46 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\end` | 2 | 47, 48 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\makeatletter` | 1 | 6 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\makeatother` | 1 | 32 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 4 | 39, 40, 41, 42 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\pgfarrowsdeclare` | 1 | 7 | src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfarrowsleftextend` | 1 | 11 | src/tikz/libraries/arrows.js:parseDeclaredArrow/setupDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfarrowsrightextend` | 1 | 12 | src/tikz/libraries/arrows.js:parseDeclaredArrow/setupDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgflinewidth` | 2 | 10, 16 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram/evaluateDeclaredDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathcurveto` | 3 | 18, 22, 26 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathmoveto` | 1 | 17 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfqpoint` | 10 | 17, 19, 20, 21, 23, 24, 25, 27, 28, 29 | src/engine/evaluate.js:resolvePgfFormOnlyPatternPoint + src/tikz/libraries/arrows.js:parsePgfPoint | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex | partial | verified |
| `\pgfusepathqfill` | 1 | 30 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex | partial | verified |
| `\pgfutil@tempdima` | 24 | 9, 10, 11, 12, 15, 16, 17, 19, 20, 21, 23, 24, 25, 27, 28, 29 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 3 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 34 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 35 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `4pt` | 1 | src/engine/options.js | verified |
| draw | `-{adaptive process}` | `true` | 44, 45, 46 | src/engine/options.js | verified |
| draw | `blue` | `true` | 44 | src/engine/options.js | verified |
| draw | `green!50!black` | `true` | 45 | src/engine/options.js | verified |
| draw | `line width` | `.4pt`<br>`1pt`<br>`1.6pt` | 44, 45, 46 | src/engine/options.js | verified |
| draw | `red` | `true` | 46 | src/engine/options.js | verified |
| node | `below` | `of review` | 42 | src/engine/options.js | verified |
| node | `fill` | `blue!8`<br>`yellow!16`<br>`green!10`<br>`red!8` | 39, 40, 41, 42 | src/engine/options.js | verified |
| node | `right` | `of draft`<br>`of review` | 40, 41 | src/engine/options.js | verified |
| node | `stage` | `true` | 39, 40, 41, 42 | src/engine/options.js | verified |
| tikzpicture | `node distance` | `13mm and 18mm` | 35 | src/engine/options.js | verified |
| tikzpicture | `stage/.style` | `{draw,rounded corners=2pt,minimum width=24mm,minimum height=8mm,align=center}` | 35 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / align` | `center` | 35 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / draw` | `true` | 35 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / minimum height` | `8mm` | 35 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / minimum width` | `24mm` | 35 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / rounded corners` | `2pt` | 35 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| option:documentclass | `4pt` | 1 | 1 | src/engine/options.js | verified |
| option:draw | `.4pt` | 1 | 44 | src/engine/options.js | verified |
| option:draw | `1.6pt` | 1 | 46 | src/engine/options.js | verified |
| option:draw | `1pt` | 1 | 45 | src/engine/options.js | verified |
| option:draw | `50` | 1 | 45 | src/engine/options.js | verified |
| option:node | `10` | 1 | 41 | src/engine/options.js | verified |
| option:node | `16` | 1 | 40 | src/engine/options.js | verified |
| option:node | `8` | 2 | 39, 42 | src/engine/options.js | verified |
| option:tikzpicture | `13mm` | 1 | 36 | src/engine/options.js | verified |
| option:tikzpicture | `18mm` | 1 | 36 | src/engine/options.js | verified |
| option:tikzpicture | `24mm` | 1 | 37 | src/engine/options.js | verified |
| option:tikzpicture | `2pt` | 1 | 37 | src/engine/options.js | verified |
| option:tikzpicture | `8mm` | 1 | 37 | src/engine/options.js | verified |
| pgfarrowsleftextend | `-4` | 1 | 11 | src/engine/units.js | verified |
| pgfarrowsrightextend | `6` | 1 | 12 | src/engine/units.js | verified |
| pgfqpoint | `-1` | 2 | 20, 27 | src/engine/units.js | verified |
| pgfqpoint | `-1.5` | 2 | 23, 24 | src/engine/units.js | verified |
| pgfqpoint | `-4` | 2 | 21, 25 | src/engine/units.js | verified |
| pgfqpoint | `3.5` | 2 | 19, 28 | src/engine/units.js | verified |
| pgfqpoint | `6` | 2 | 17, 29 | src/engine/units.js | verified |
| pgfutil@tempdima | `-.5` | 1 | 28 | src/engine/units.js | verified |
| pgfutil@tempdima | `-1` | 1 | 24 | src/engine/units.js | verified |
| pgfutil@tempdima | `-1.5` | 1 | 27 | src/engine/units.js | verified |
| pgfutil@tempdima | `-3.75` | 1 | 25 | src/engine/units.js | verified |
| pgfutil@tempdima | `.28pt` | 2 | 9, 15 | src/engine/units.js | verified |
| pgfutil@tempdima | `.5` | 1 | 19 | src/engine/units.js | verified |
| pgfutil@tempdima | `0pt` | 2 | 17, 29 | src/engine/units.js | verified |
| pgfutil@tempdima | `1` | 1 | 23 | src/engine/units.js | verified |
| pgfutil@tempdima | `1.5` | 1 | 20 | src/engine/units.js | verified |
| pgfutil@tempdima | `3` | 2 | 10, 16 | src/engine/units.js | verified |
| pgfutil@tempdima | `3.75` | 1 | 21 | src/engine/units.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
