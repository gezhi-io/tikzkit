# Semantic Audit: declared-polar-math.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 23 | 16 | 0 | 17 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js + src/frontend/parser.js:parseParabolaSegment + src/tikz/pathOperations/parabola.js:pgfParabolaCommands + src/engine/evaluate.js:resolveParabolaBend | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `arrows` | partial / src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseLegacyArrowExtents/legacyDelimiterArrowMetrics/legacyTriangleArrowMetrics/legacyDiamondArrowMetrics/legacySquareArrowMetrics/legacyCircleArrowMetrics/legacyHookArrowMetrics/legacySideToArrowMetrics/legacyImpliesArrowMetrics/legacySerifCmArrowMetrics/legacyCapArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/legacyLatexArrowGeometryFromLineWidth/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyDelimiterInlineGeometry/legacyTriangleInlineGeometry/legacyDiamondInlineGeometry/legacySquareInlineGeometry/legacyCircleInlineGeometry/legacyHookInlineGeometry/legacySideToInlineGeometry/legacyImpliesArrowInlineGeometry/legacySerifCmInlineGeometry/renderInlineArrowTip + src/frontend/latex-shell.js:expandTheoreticalComputerScienceLogoMacros + src/engine/evaluate.js:curveArrowTerminalBorderPadding/nodeBorderPoint/polygonBorderPointWithPadding/regularPolygonOuterRadiusExtension + src/tikz/libraries/arrows.js:legacyPrimeArrowMetrics + src/tikz/metrics.js:normalizeArrowKind + src/renderers/svg/paths.js:legacyPrimeArrowInlineGeometry + src/engine/evaluate.js:arrowTipShortenCoordinateLength + src/tikz/libraries/arrows.js:resolveDeclaredArrowGeometry/evaluateDeclaredDimensionProgram/evaluateDeclaredDimension/declaredArrowDrawingStyle + src/renderers/svg/paths.js:resolveInlineArrowTip/renderInlineArrowTip + src/tikz/libraries/arrows.js:parsePgfPoint/readPgfCommandArguments/splitPolarRadii | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex | yes |
| tikz-library | `positioning` | builtin / src/tikz/libraries/positioning.js; src/engine/evaluate.js:nodeTextAnchorOffsets/nodeAnchorCoordinate/shapeCompassLocalAnchor | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\advance` | 3 | 10, 13, 18 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\begin` | 2 | 28, 29 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\draw` | 3 | 38, 39, 40 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\end` | 2 | 41, 42 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\makeatletter` | 1 | 6 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\makeatother` | 1 | 26 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 4 | 33, 34, 35, 36 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\pgfarrowsdeclare` | 1 | 7 | src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfarrowsleftextend` | 1 | 11 | src/tikz/libraries/arrows.js:parseDeclaredArrow/setupDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfarrowsrightextend` | 1 | 14 | src/tikz/libraries/arrows.js:parseDeclaredArrow/setupDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgflinewidth` | 4 | 10, 11, 13, 18 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram/evaluateDeclaredDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathclose` | 1 | 23 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathlineto` | 2 | 21, 22 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathmoveto` | 1 | 20 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpointorigin` | 1 | 21 | src/engine/evaluate.js:resolvePgfFormOnlyPatternPoint + src/tikz/libraries/arrows.js:parsePgfPoint | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex | partial | verified |
| `\pgfqpointpolar` | 2 | 20, 22 | src/tikz/libraries/arrows.js:parsePgfPoint | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex | partial | verified |
| `\pgfsetmiterjoin` | 1 | 19 | src/tikz/libraries/arrows.js:declaredArrowDrawingStyle | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoregraphicstate.code.tex | partial | verified |
| `\pgfusepathqstroke` | 1 | 24 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex | partial | verified |
| `\pgfutil@tempdima` | 7 | 9, 10, 12, 17, 18, 20, 22 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfutil@tempdimb` | 3 | 12, 13, 14 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 3 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 28 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 29 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `4pt` | 1 | src/engine/options.js | verified |
| draw | `-{polar inclusion}` | `true` | 38, 39, 40 | src/engine/options.js | verified |
| draw | `blue` | `true` | 38 | src/engine/options.js | verified |
| draw | `line width` | `.4pt`<br>`1pt`<br>`1.6pt` | 38, 39, 40 | src/engine/options.js | verified |
| draw | `purple` | `true` | 39 | src/engine/options.js | verified |
| draw | `red` | `true` | 40 | src/engine/options.js | verified |
| node | `below` | `of A` | 35 | src/engine/options.js | verified |
| node | `fill` | `blue!8`<br>`green!10`<br>`orange!10`<br>`purple!8` | 33, 34, 35, 36 | src/engine/options.js | verified |
| node | `right` | `of A`<br>`of C` | 34, 36 | src/engine/options.js | verified |
| node | `space` | `true` | 33, 34, 35, 36 | src/engine/options.js | verified |
| tikzpicture | `node distance` | `16mm and 25mm` | 29 | src/engine/options.js | verified |
| tikzpicture | `space/.style` | `{draw,circle,minimum size=10mm,inner sep=1pt}` | 29 | src/engine/options.js | verified |
| tikzpicture | `space/.style / circle` | `true` | 29 | src/engine/options.js | verified |
| tikzpicture | `space/.style / draw` | `true` | 29 | src/engine/options.js | verified |
| tikzpicture | `space/.style / inner sep` | `1pt` | 29 | src/engine/options.js | verified |
| tikzpicture | `space/.style / minimum size` | `10mm` | 29 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| option:documentclass | `4pt` | 1 | 1 | src/engine/options.js | verified |
| option:draw | `.4pt` | 1 | 38 | src/engine/options.js | verified |
| option:draw | `1.6pt` | 1 | 40 | src/engine/options.js | verified |
| option:draw | `1pt` | 1 | 39 | src/engine/options.js | verified |
| option:node | `10` | 2 | 34, 35 | src/engine/options.js | verified |
| option:node | `8` | 2 | 33, 36 | src/engine/options.js | verified |
| option:tikzpicture | `10mm` | 1 | 31 | src/engine/options.js | verified |
| option:tikzpicture | `16mm` | 1 | 30 | src/engine/options.js | verified |
| option:tikzpicture | `1pt` | 1 | 31 | src/engine/options.js | verified |
| option:tikzpicture | `25mm` | 1 | 30 | src/engine/options.js | verified |
| pgfqpointpolar | `-30` | 1 | 22 | src/engine/units.js | verified |
| pgfqpointpolar | `30` | 1 | 20 | src/engine/units.js | verified |
| pgfqpointpolar | `9` | 2 | 20, 22 | src/engine/units.js | verified |
| pgfutil@tempdima | `.5pt` | 2 | 9, 17 | src/engine/units.js | verified |
| pgfutil@tempdima | `25` | 2 | 10, 18 | src/engine/units.js | verified |
| pgfutil@tempdimb | `5` | 1 | 13 | src/engine/units.js | verified |
| pgfutil@tempdimb | `7.794` | 1 | 12 | src/engine/units.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
