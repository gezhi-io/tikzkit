# Semantic Audit: shape-curved-terminal-miters.tex

Status: **incomplete**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 7 | 23 | 0 | 40 | 0 | 81 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform + src/tikz/textMetrics.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | no |
| tikz-library | `arrows.meta` | builtin / src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth + src/renderers/svg/paths.js:inlineArrowGeometry | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex | yes |
| tikz-library | `shapes.geometric` | partial / src/engine/evaluate.js:regularPolygonLayoutSize/regularPolygonStartAngle/regularPolygonOuterRadiusExtension/nodeBorderPoint/polygonBorderPointWithPadding,src/tikz/libraries/shapes.geometric.js:trapeziumLayoutSize/trapeziumNodePoints,src/renderers/svg/nodeShapes.js:regularPolygonNodePoints | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 6, 7 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |
| `\draw` | 5 | 14, 15, 16, 19, 20 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | todo |
| `\end` | 2 | 21, 22 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |
| `\node` | 4 | 8, 9, 10, 11 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | todo |
| `\usepackage` | 1 | 3 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | todo |
| `\usetikzlibrary` | 1 | 4 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | todo |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 6 | src/frontend/latex-shell.js | stable | todo |
| `tikzpicture` | 1 | 7 | src/frontend/parser.js | stable | todo |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | todo |
| draw | `-{Latex[length=4mm,width=3mm]}` | `true` | 14, 15, 16, 19, 20 | src/engine/options.js | todo |
| draw | `blue` | `true` | 14 | src/engine/options.js | todo |
| draw | `green!60!black` | `true` | 16 | src/engine/options.js | todo |
| draw | `line width` | `6pt`<br>`10pt` | 14, 15, 16, 19, 20 | src/engine/options.js | todo |
| draw | `orange` | `true` | 19 | src/engine/options.js | todo |
| draw | `purple` | `true` | 20 | src/engine/options.js | todo |
| draw | `red` | `true` | 15 | src/engine/options.js | todo |
| node | `aspect` | `1.4` | 9 | src/engine/options.js | todo |
| node | `diamond` | `true` | 9 | src/engine/options.js | todo |
| node | `draw` | `true` | 8, 9, 10, 11 | src/engine/options.js | todo |
| node | `minimum height` | `1.2cm`<br>`1.6cm`<br>`1.3cm` | 8, 9, 11 | src/engine/options.js | todo |
| node | `minimum size` | `2cm` | 10 | src/engine/options.js | todo |
| node | `minimum width` | `2.2cm`<br>`2cm`<br>`2.4cm` | 8, 9, 11 | src/engine/options.js | todo |
| node | `rectangle` | `true` | 8 | src/engine/options.js | todo |
| node | `star` | `true` | 10 | src/engine/options.js | todo |
| node | `star point ratio` | `1.8` | 10 | src/engine/options.js | todo |
| node | `star points` | `5` | 10 | src/engine/options.js | todo |
| node | `trapezium` | `true` | 11 | src/engine/options.js | todo |
| node | `trapezium left angle` | `70` | 11 | src/engine/options.js | todo |
| node | `trapezium right angle` | `110` | 11 | src/engine/options.js | todo |
| tikzpicture | `x` | `1cm` | 7 | src/engine/options.js | todo |
| tikzpicture | `y` | `1cm` | 7 | src/engine/options.js | todo |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| draw | `-1.1` | 1 | 20 | src/engine/units.js | todo |
| draw | `-1.9` | 1 | 19 | src/engine/units.js | todo |
| draw | `-160` | 1 | 19 | src/engine/units.js | todo |
| draw | `-2` | 1 | 16 | src/engine/units.js | todo |
| draw | `-25` | 2 | 14, 20 | src/engine/units.js | todo |
| draw | `-5.1` | 1 | 20 | src/engine/units.js | todo |
| draw | `-5.2` | 1 | 14 | src/engine/units.js | todo |
| draw | `-90` | 2 | 15, 16 | src/engine/units.js | todo |
| draw | `0.4` | 1 | 16 | src/engine/units.js | todo |
| draw | `126` | 1 | 20 | src/engine/units.js | todo |
| draw | `14.5` | 1 | 19 | src/engine/units.js | todo |
| draw | `3` | 1 | 15 | src/engine/units.js | todo |
| draw | `45` | 1 | 14 | src/engine/units.js | todo |
| draw | `5.2` | 1 | 14 | src/engine/units.js | todo |
| draw | `5.3` | 1 | 15 | src/engine/units.js | todo |
| draw | `6.4` | 1 | 19 | src/engine/units.js | todo |
| draw | `90` | 2 | 15, 16 | src/engine/units.js | todo |
| node | `-2` | 2 | 8, 10 | src/engine/units.js | todo |
| node | `-3.1` | 2 | 10, 11 | src/engine/units.js | todo |
| node | `1.8` | 2 | 8, 9 | src/engine/units.js | todo |
| node | `3` | 1 | 9 | src/engine/units.js | todo |
| node | `3.3` | 1 | 11 | src/engine/units.js | todo |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | todo |
| option:draw | `10pt` | 1 | 19 | src/engine/options.js | todo |
| option:draw | `3mm` | 5 | 14, 15, 16, 19, 20 | src/engine/options.js | todo |
| option:draw | `4mm` | 5 | 14, 15, 16, 19, 20 | src/engine/options.js | todo |
| option:draw | `60` | 1 | 16 | src/engine/options.js | todo |
| option:draw | `6pt` | 4 | 14, 15, 16, 20 | src/engine/options.js | todo |
| option:node | `1.2cm` | 1 | 8 | src/engine/options.js | todo |
| option:node | `1.3cm` | 1 | 11 | src/engine/options.js | todo |
| option:node | `1.4` | 1 | 9 | src/engine/options.js | todo |
| option:node | `1.6cm` | 1 | 9 | src/engine/options.js | todo |
| option:node | `1.8` | 1 | 10 | src/engine/options.js | todo |
| option:node | `110` | 1 | 11 | src/engine/options.js | todo |
| option:node | `2.2cm` | 1 | 8 | src/engine/options.js | todo |
| option:node | `2.4cm` | 1 | 11 | src/engine/options.js | todo |
| option:node | `2cm` | 2 | 9, 10 | src/engine/options.js | todo |
| option:node | `5` | 1 | 10 | src/engine/options.js | todo |
| option:node | `70` | 1 | 11 | src/engine/options.js | todo |
| option:tikzpicture | `1cm` | 2 | 7 | src/engine/options.js | todo |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

### Required Reviews

- dependency:package:tikz: local source not reviewed
- command:\begin: local source not reviewed
- command:\begin: review required
- command:\documentclass: local source not reviewed
- command:\documentclass: review required
- command:\draw: local source not reviewed
- command:\draw: review required
- command:\end: local source not reviewed
- command:\end: review required
- command:\node: local source not reviewed
- command:\node: review required
- command:\usepackage: local source not reviewed
- command:\usepackage: review required
- command:\usetikzlibrary: local source not reviewed
- command:\usetikzlibrary: review required
- environment:document: review required
- environment:tikzpicture: review required
- option:documentclass:border: review required
- option:draw:-{Latex[length=4mm,width=3mm]}: review required
- option:draw:blue: review required
- option:draw:green!60!black: review required
- option:draw:line width: review required
- option:draw:orange: review required
- option:draw:purple: review required
- option:draw:red: review required
- option:node:aspect: review required
- option:node:diamond: review required
- option:node:draw: review required
- option:node:minimum height: review required
- option:node:minimum size: review required
- option:node:minimum width: review required
- option:node:rectangle: review required
- option:node:star: review required
- option:node:star point ratio: review required
- option:node:star points: review required
- option:node:trapezium: review required
- option:node:trapezium left angle: review required
- option:node:trapezium right angle: review required
- option:tikzpicture:x: review required
- option:tikzpicture:y: review required
- number:draw:-1.1: review required
- number:draw:-1.9: review required
- number:draw:-160: review required
- number:draw:-2: review required
- number:draw:-25: review required
- number:draw:-5.1: review required
- number:draw:-5.2: review required
- number:draw:-90: review required
- number:draw:0.4: review required
- number:draw:126: review required
- number:draw:14.5: review required
- number:draw:3: review required
- number:draw:45: review required
- number:draw:5.2: review required
- number:draw:5.3: review required
- number:draw:6.4: review required
- number:draw:90: review required
- number:node:-2: review required
- number:node:-3.1: review required
- number:node:1.8: review required
- number:node:3: review required
- number:node:3.3: review required
- number:option:documentclass:2pt: review required
- number:option:draw:10pt: review required
- number:option:draw:3mm: review required
- number:option:draw:4mm: review required
- number:option:draw:60: review required
- number:option:draw:6pt: review required
- number:option:node:1.2cm: review required
- number:option:node:1.3cm: review required
- number:option:node:1.4: review required
- number:option:node:1.6cm: review required
- number:option:node:1.8: review required
- number:option:node:110: review required
- number:option:node:2.2cm: review required
- number:option:node:2.4cm: review required
- number:option:node:2cm: review required
- number:option:node:5: review required
- number:option:node:70: review required
- number:option:tikzpicture:1cm: review required
- case: explicit caseStatus=accepted is required
