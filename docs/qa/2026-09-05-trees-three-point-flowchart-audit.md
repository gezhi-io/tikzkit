# Semantic Audit: flowchart.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 7 | 15 | 0 | 14 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js + src/frontend/parser.js:parseParabolaSegment + src/tikz/pathOperations/parabola.js:pgfParabolaCommands + src/engine/evaluate.js:resolveParabolaBend | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/mergeTreeGrowthOptions/treeGrowthSpec/treeChildOffset/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions + src/tikz/libraries/trees.js:parseGrowViaThreePoints/threePointChildOffset + src/tikz/commands/foreach.js:foreachIterationVariables | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 11, 12 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 20, 21 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 1 | 16 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\tikzset` | 1 | 6 | src/engine/options.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\usepackage` | 1 | 3 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 4 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 11 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 12 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | verified |
| node | `fill` | `blue!15` | 16 | src/engine/options.js | verified |
| node | `stage` | `true` | 16 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style` | `{grow via three points={one child at (0,-12mm) and<br>    two children at (-18mm,-20mm) and (18mm,-20mm)}}` | 12 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style / grow via three points` | `{one child at (0,-12mm) and<br>    two children at (-18mm,-20mm) and (18mm,-20mm)}` | 12 | src/tikz/libraries/trees.js:parseGrowViaThreePoints/threePointChildOffset + src/engine/evaluate.js:treeGrowthSpec/treeChildOffset | verified |
| tikzset | `every edge from parent/.style` | `{draw,thick,-stealth}` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / -stealth` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / thick` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `stage/.style` | `{draw,rounded corners=2pt,minimum width=18mm,minimum height=8mm,inner sep=2pt}` | 6 | src/engine/options.js | verified |
| tikzset | `stage/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `stage/.style / inner sep` | `2pt` | 6 | src/engine/options.js | verified |
| tikzset | `stage/.style / minimum height` | `8mm` | 6 | src/engine/options.js | verified |
| tikzset | `stage/.style / minimum width` | `18mm` | 6 | src/engine/options.js | verified |
| tikzset | `stage/.style / rounded corners` | `2pt` | 6 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| literal | `12` | 1 | 19 | src/engine/units.js | verified |
| literal | `15` | 1 | 18 | src/engine/units.js | verified |
| literal | `18` | 1 | 17 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | verified |
| option:node | `15` | 1 | 16 | src/engine/options.js | verified |
| option:tikzpicture | `-12mm` | 1 | 13 | src/engine/options.js | verified |
| option:tikzpicture | `-18mm` | 1 | 14 | src/engine/options.js | verified |
| option:tikzpicture | `-20mm` | 2 | 14 | src/engine/options.js | verified |
| option:tikzpicture | `0` | 1 | 13 | src/engine/options.js | verified |
| option:tikzpicture | `1` | 1 | 13 | src/engine/options.js | verified |
| option:tikzpicture | `18mm` | 1 | 14 | src/engine/options.js | verified |
| option:tikzset | `18mm` | 1 | 7 | src/engine/options.js | verified |
| option:tikzset | `2pt` | 2 | 7 | src/engine/options.js | verified |
| option:tikzset | `8mm` | 1 | 7 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
