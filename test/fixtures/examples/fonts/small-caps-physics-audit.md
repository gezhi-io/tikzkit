# Semantic Audit: small-caps-physics.tex

Status: **blocked**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 2 | 11 | 10 | 0 | 4 | 0 | 8 | 1 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `amsmath` | partial / src/tikz/text.js + src/tikz/textMetrics.js + src/tikz/mathMatrixSyntax.js + src/renderers/svg/mathMatrixFallback.js + src/renderers/svg/mathNode.js + src/renderers/svg/textEngine.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/renderSvg.js + src/frontend/latex-shell.js:parseDeclareMathOperator + web/workbench.js | /usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty | no |
| package | `xcolor` | builtin / src/frontend/latex-shell.js:collectColorDefinitions + src/frontend/parser.js + src/engine/options.js:normalizeColor + src/engine/evaluate.js + src/tikz/text.js + src/renderers/svg/mathNode.js | /usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty | no |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | no |
| tikz-library | `arrows.meta` | builtin / src/engine/options.js:parseArrowOption/parseArrowTipSpec/parseArrowTipBending + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth/stealthMetaArrowGeometryFromLineWidth + src/renderers/svg/paths.js:renderArrowedPath/resolveInlineArrowTipSequence/placeResolvedInlineArrowTips + src/renderers/svg/arrowBending.js:curvedArrowPaint + src/renderers/svg/bounds.js:arrowEndpointBounds | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex | yes |
| tikz-library | `positioning` | builtin / src/tikz/libraries/positioning.js; src/engine/evaluate.js:nodeTextAnchorOffsets/nodeAnchorCoordinate/shapeCompassLocalAnchor | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 6, 7 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\draw` | 1 | 23 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\end` | 2 | 24, 25 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 2 | 8, 15 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\psi` | 1 | 23 | src/renderers/svg/mathNode.js | - | partial | verified |
| `\scshape` | 2 | 13, 20 | - | - | unmapped | verified |
| `\small` | 2 | 13, 20 | src/tex/fontSpec.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/size10.clo | partial | verified |
| `\textcolor` | 2 | 14, 22 | src/renderers/svg/textEngine.js | /usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty | partial | verified |
| `\usepackage` | 3 | 2, 3, 4 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 5 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 6 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 7 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| draw | `->` | `true` | 23 | src/engine/options.js | verified |
| draw | `very thick` | `true` | 23 | src/engine/options.js | verified |
| node | `align` | `center` | 8, 15 | src/engine/options.js | verified |
| node | `circle` | `true` | 8, 15 | src/engine/options.js | verified |
| node | `draw` | `true` | 8, 15 | src/engine/options.js | verified |
| node | `font` | `\small\scshape` | 8, 15 | src/engine/options.js | verified |
| node | `minimum size` | `1.7cm` | 8, 15 | src/engine/options.js | verified |
| node | `right` | `2.2cm of initial` | 15 | src/engine/options.js | verified |
| tikzpicture | `>` | `Latex` | 7 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| option:node | `1.7cm` | 2 | 11, 18 | src/engine/options.js | verified |
| option:node | `2.2cm` | 1 | 21 | src/engine/options.js | verified |
| psi | `0` | 1 | 23 | src/engine/units.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

### Blockers

- command:\scshape: no implementation owner

### Required Reviews

- dependency:package:amsmath: local source not reviewed
- dependency:package:xcolor: local source not reviewed
- dependency:package:tikz: local source not reviewed
- command:\draw: local source not reviewed
- command:\node: local source not reviewed
- command:\small: local source not reviewed
- command:\textcolor: local source not reviewed
- command:\usetikzlibrary: local source not reviewed
