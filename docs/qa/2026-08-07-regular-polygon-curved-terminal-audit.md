# Semantic Audit: regular-polygon-curved-terminal.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 7 | 16 | 0 | 22 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform + src/tikz/textMetrics.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `arrows.meta` | builtin / src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth + src/renderers/svg/paths.js:inlineArrowGeometry | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex | yes |
| tikz-library | `shapes.geometric` | partial / src/engine/evaluate.js:regularPolygonLayoutSize/regularPolygonStartAngle/regularPolygonOuterRadiusExtension/nodeBorderPoint,src/renderers/svg/nodeShapes.js:regularPolygonNodePoints | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 6, 7 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\draw` | 3 | 12, 13, 14 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\end` | 2 | 15, 16 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 3 | 8, 9, 10 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\usepackage` | 1 | 3 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 4 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 6 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 7 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | verified |
| draw | `-{Latex[length=3mm,width=2.25mm]}` | `true` | 14 | src/engine/options.js | verified |
| draw | `-{Latex[length=4mm,width=3mm]}` | `true` | 12 | src/engine/options.js | verified |
| draw | `{Latex[length=4mm,width=3mm]}-` | `true` | 13 | src/engine/options.js | verified |
| draw | `thick` | `true` | 14 | src/engine/options.js | verified |
| draw | `very thick` | `true` | 12, 13 | src/engine/options.js | verified |
| node | `draw` | `true` | 8, 9, 10 | src/engine/options.js | verified |
| node | `minimum height` | `1.1cm` | 8 | src/engine/options.js | verified |
| node | `minimum size` | `1.7cm`<br>`1.35cm` | 9, 10 | src/engine/options.js | verified |
| node | `minimum width` | `2.2cm` | 8 | src/engine/options.js | verified |
| node | `rectangle` | `true` | 8 | src/engine/options.js | verified |
| node | `regular polygon` | `true` | 9, 10 | src/engine/options.js | verified |
| node | `regular polygon rotate` | `15` | 10 | src/engine/options.js | verified |
| node | `regular polygon sides` | `6` | 9, 10 | src/engine/options.js | verified |
| tikzpicture | `x` | `1cm` | 7 | src/engine/options.js | verified |
| tikzpicture | `y` | `1cm` | 7 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| draw | `-35` | 1 | 14 | src/engine/units.js | verified |
| draw | `0` | 1 | 13 | src/engine/units.js | verified |
| draw | `145` | 1 | 14 | src/engine/units.js | verified |
| draw | `190` | 1 | 12 | src/engine/units.js | verified |
| draw | `250` | 1 | 13 | src/engine/units.js | verified |
| draw | `30` | 1 | 12 | src/engine/units.js | verified |
| node | `-2.1` | 1 | 10 | src/engine/units.js | verified |
| node | `0` | 2 | 8 | src/engine/units.js | verified |
| node | `1.8` | 1 | 9 | src/engine/units.js | verified |
| node | `2.2` | 1 | 10 | src/engine/units.js | verified |
| node | `5` | 1 | 9 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | verified |
| option:draw | `2.25mm` | 1 | 14 | src/engine/options.js | verified |
| option:draw | `3mm` | 3 | 12, 13, 14 | src/engine/options.js | verified |
| option:draw | `4mm` | 2 | 12, 13 | src/engine/options.js | verified |
| option:node | `1.1cm` | 1 | 8 | src/engine/options.js | verified |
| option:node | `1.35cm` | 1 | 10 | src/engine/options.js | verified |
| option:node | `1.7cm` | 1 | 9 | src/engine/options.js | verified |
| option:node | `15` | 1 | 10 | src/engine/options.js | verified |
| option:node | `2.2cm` | 1 | 8 | src/engine/options.js | verified |
| option:node | `6` | 2 | 9, 10 | src/engine/options.js | verified |
| option:tikzpicture | `1cm` | 2 | 7 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
