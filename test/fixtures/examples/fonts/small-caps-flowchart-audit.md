# Semantic Audit: small-caps-flowchart.tex

Status: **blocked**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 2 | 10 | 13 | 0 | 6 | 0 | 6 | 2 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `xcolor` | builtin / src/frontend/latex-shell.js:collectColorDefinitions + src/frontend/parser.js + src/engine/options.js:normalizeColor + src/engine/evaluate.js + src/tikz/text.js + src/renderers/svg/mathNode.js | /usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty | no |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | no |
| tikz-library | `arrows.meta` | builtin / src/engine/options.js:parseArrowOption/parseArrowTipSpec/parseArrowTipBending + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth/stealthMetaArrowGeometryFromLineWidth + src/renderers/svg/paths.js:renderArrowedPath/resolveInlineArrowTipSequence/placeResolvedInlineArrowTips + src/renderers/svg/arrowBending.js:curvedArrowPaint + src/renderers/svg/bounds.js:arrowEndpointBounds | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex | yes |
| tikz-library | `positioning` | builtin / src/tikz/libraries/positioning.js; src/engine/evaluate.js:nodeTextAnchorOffsets/nodeAnchorCoordinate/shapeCompassLocalAnchor | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarypositioning.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 5, 6 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\draw` | 2 | 19, 20 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\end` | 2 | 22, 23 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 4 | 16, 17, 18, 21 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\scshape` | 1 | 13 | - | - | unmapped | verified |
| `\textcolor` | 1 | 16 | src/renderers/svg/textEngine.js | /usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty | partial | verified |
| `\textsc` | 1 | 21 | - | - | unmapped | verified |
| `\usepackage` | 2 | 2, 3 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 4 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 5 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 6 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| draw | `->` | `true` | 19, 20 | src/engine/options.js | verified |
| draw | `thick` | `true` | 19, 20 | src/engine/options.js | verified |
| node | `below` | `4mm of parse` | 21 | src/engine/options.js | verified |
| node | `right` | `1.2cm of source`<br>`1.2cm of parse` | 17, 18 | src/engine/options.js | verified |
| node | `stage` | `true` | 16, 17, 18 | src/engine/options.js | verified |
| tikzpicture | `>` | `Stealth` | 6 | src/engine/options.js | verified |
| tikzpicture | `stage/.style` | `{<br>    draw,<br>    rounded corners=2pt,<br>    minimum width=2.6cm,<br>    minimum height=0.8cm,<br>    font=\scshape<br>  }` | 6 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / font` | `\scshape` | 6 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / minimum height` | `0.8cm` | 6 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / minimum width` | `2.6cm` | 6 | src/engine/options.js | verified |
| tikzpicture | `stage/.style / rounded corners` | `2pt` | 6 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| option:node | `1.2cm` | 2 | 17, 18 | src/engine/options.js | verified |
| option:node | `4mm` | 1 | 21 | src/engine/options.js | verified |
| option:tikzpicture | `0.8cm` | 1 | 12 | src/engine/options.js | verified |
| option:tikzpicture | `2.6cm` | 1 | 11 | src/engine/options.js | verified |
| option:tikzpicture | `2pt` | 1 | 10 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

### Blockers

- command:\scshape: no implementation owner
- command:\textsc: no implementation owner

### Required Reviews

- dependency:package:xcolor: local source not reviewed
- dependency:package:tikz: local source not reviewed
- command:\draw: local source not reviewed
- command:\node: local source not reviewed
- command:\textcolor: local source not reviewed
- command:\usetikzlibrary: local source not reviewed
