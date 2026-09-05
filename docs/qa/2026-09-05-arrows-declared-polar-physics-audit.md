# Semantic Audit: declared-polar-physics.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 23 | 7 | 0 | 28 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js + src/frontend/parser.js:parseParabolaSegment + src/tikz/pathOperations/parabola.js:pgfParabolaCommands + src/engine/evaluate.js:resolveParabolaBend | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `arrows` | partial / src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseLegacyArrowExtents/legacyDelimiterArrowMetrics/legacyTriangleArrowMetrics/legacyDiamondArrowMetrics/legacySquareArrowMetrics/legacyCircleArrowMetrics/legacyHookArrowMetrics/legacySideToArrowMetrics/legacyImpliesArrowMetrics/legacySerifCmArrowMetrics/legacyCapArrowMetrics + src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/legacyArrowTipBase/legacyLatexArrowGeometryFromLineWidth/normalizeArrowKind + src/renderers/svg/paths.js:inlineArrowGeometry/legacyDelimiterInlineGeometry/legacyTriangleInlineGeometry/legacyDiamondInlineGeometry/legacySquareInlineGeometry/legacyCircleInlineGeometry/legacyHookInlineGeometry/legacySideToInlineGeometry/legacyImpliesArrowInlineGeometry/legacySerifCmInlineGeometry/renderInlineArrowTip + src/frontend/latex-shell.js:expandTheoreticalComputerScienceLogoMacros + src/engine/evaluate.js:curveArrowTerminalBorderPadding/nodeBorderPoint/polygonBorderPointWithPadding/regularPolygonOuterRadiusExtension + src/tikz/libraries/arrows.js:legacyPrimeArrowMetrics + src/tikz/metrics.js:normalizeArrowKind + src/renderers/svg/paths.js:legacyPrimeArrowInlineGeometry + src/engine/evaluate.js:arrowTipShortenCoordinateLength + src/tikz/libraries/arrows.js:resolveDeclaredArrowGeometry/evaluateDeclaredDimensionProgram/evaluateDeclaredDimension/declaredArrowDrawingStyle + src/renderers/svg/paths.js:resolveInlineArrowTip/renderInlineArrowTip + src/tikz/libraries/arrows.js:parsePgfPoint/readPgfCommandArguments/splitPolarRadii | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\advance` | 2 | 10, 16 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\begin` | 2 | 26, 27 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\draw` | 5 | 28, 29, 32, 33, 34 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\end` | 2 | 35, 36 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\fill` | 1 | 30 | src/tikz/commands/fill.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\makeatletter` | 1 | 6 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\makeatother` | 1 | 24 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\pgfarrowsdeclare` | 1 | 7 | src/tikz/libraries/arrows.js:lowerDeclaredArrowTips/parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfarrowsleftextend` | 1 | 11 | src/tikz/libraries/arrows.js:parseDeclaredArrow/setupDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfarrowsrightextend` | 1 | 12 | src/tikz/libraries/arrows.js:parseDeclaredArrow/setupDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgflinewidth` | 2 | 10, 16 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram/evaluateDeclaredDimension | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathclose` | 1 | 21 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathlineto` | 2 | 19, 20 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpathmoveto` | 1 | 18 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\pgfpointpolar` | 2 | 18, 20 | src/tikz/libraries/arrows.js:parsePgfPoint | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex | partial | verified |
| `\pgfqpoint` | 1 | 19 | src/engine/evaluate.js:resolvePgfFormOnlyPatternPoint + src/tikz/libraries/arrows.js:parsePgfPoint | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex | partial | verified |
| `\pgfsetmiterjoin` | 1 | 17 | src/tikz/libraries/arrows.js:declaredArrowDrawingStyle | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoregraphicstate.code.tex | partial | verified |
| `\pgfusepathqfillstroke` | 1 | 22 | src/tikz/libraries/arrows.js:parseDeclaredArrow | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex | partial | verified |
| `\pgfutil@tempdima` | 11 | 9, 10, 11, 12, 15, 16, 18, 19, 20 | src/tikz/libraries/arrows.js:evaluateDeclaredDimensionProgram | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex | partial | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 3 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |
| `\vec` | 3 | 32, 33, 34 | src/renderers/svg/mathNode.js | - | partial | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 26 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 27 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `4pt` | 1 | src/engine/options.js | verified |
| draw | `-{polar thrust}` | `true` | 32, 33, 34 | src/engine/options.js | verified |
| draw | `blue` | `true` | 32 | src/engine/options.js | verified |
| draw | `gray!35` | `true` | 28, 29 | src/engine/options.js | verified |
| draw | `green!50!black` | `true` | 34 | src/engine/options.js | verified |
| draw | `line width` | `.4pt`<br>`1pt`<br>`1.6pt` | 32, 33, 34 | src/engine/options.js | verified |
| draw | `red` | `true` | 33 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| draw | `-2.05` | 1 | 34 | src/engine/units.js | verified |
| draw | `-2.3` | 1 | 29 | src/engine/units.js | verified |
| draw | `-2.45` | 1 | 33 | src/engine/units.js | verified |
| draw | `-3.2` | 1 | 28 | src/engine/units.js | verified |
| draw | `0` | 11 | 28, 29, 32, 33, 34 | src/engine/units.js | verified |
| draw | `1.35` | 1 | 32 | src/engine/units.js | verified |
| draw | `1.55` | 1 | 33 | src/engine/units.js | verified |
| draw | `2.5` | 1 | 29 | src/engine/units.js | verified |
| draw | `2.65` | 1 | 32 | src/engine/units.js | verified |
| draw | `3.2` | 1 | 28 | src/engine/units.js | verified |
| fill | `0` | 2 | 30 | src/engine/units.js | verified |
| fill | `2pt` | 1 | 30 | src/engine/units.js | verified |
| option:documentclass | `4pt` | 1 | 1 | src/engine/options.js | verified |
| option:draw | `.4pt` | 1 | 32 | src/engine/options.js | verified |
| option:draw | `1.6pt` | 1 | 34 | src/engine/options.js | verified |
| option:draw | `1pt` | 1 | 33 | src/engine/options.js | verified |
| option:draw | `35` | 2 | 28, 29 | src/engine/options.js | verified |
| option:draw | `50` | 1 | 34 | src/engine/options.js | verified |
| pgfarrowsleftextend | `-6` | 1 | 11 | src/engine/units.js | verified |
| pgfpointpolar | `-145` | 1 | 20 | src/engine/units.js | verified |
| pgfpointpolar | `145` | 1 | 18 | src/engine/units.js | verified |
| pgfpointpolar | `7` | 2 | 18, 20 | src/engine/units.js | verified |
| pgfutil@tempdima | `.5pt` | 2 | 9, 15 | src/engine/units.js | verified |
| pgfutil@tempdima | `0pt` | 1 | 19 | src/engine/units.js | verified |
| pgfutil@tempdima | `25` | 2 | 10, 16 | src/engine/units.js | verified |
| pgfutil@tempdima | `5` | 2 | 18, 20 | src/engine/units.js | verified |
| vec | `1` | 1 | 32 | src/engine/units.js | verified |
| vec | `2` | 1 | 33 | src/engine/units.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
