# Semantic Audit: math.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 7 | 18 | 0 | 13 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js + src/frontend/parser.js:parseParabolaSegment + src/tikz/pathOperations/parabola.js:pgfParabolaCommands + src/engine/evaluate.js:resolveParabolaBend | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/mergeTreeGrowthOptions/treeGrowthSpec/treeChildOffset/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions + src/tikz/libraries/trees.js:parseGrowViaThreePoints/threePointChildOffset + src/tikz/commands/foreach.js:foreachIterationVariables | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 12, 13 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 21, 22 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 1 | 17 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\tikzset` | 1 | 6 | src/engine/options.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\usepackage` | 1 | 3 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 4 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 12 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 13 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | verified |
| node | `term` | `true` | 17 | src/engine/options.js | verified |
| tikzpicture | `grow via three points` | `{one child at (0,-11mm) and<br>    two children at (-16mm,-18mm) and (16mm,-18mm)}` | 13 | src/tikz/libraries/trees.js:parseGrowViaThreePoints/threePointChildOffset + src/engine/evaluate.js:treeGrowthSpec/treeChildOffset | verified |
| tikzset | `every edge from parent/.style` | `{draw,thick}` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / thick` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `leaf/.style` | `{draw,rounded corners=2pt,minimum width=14mm,minimum height=8mm,inner sep=1pt}` | 6 | src/engine/options.js | verified |
| tikzset | `leaf/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `leaf/.style / inner sep` | `1pt` | 6 | src/engine/options.js | verified |
| tikzset | `leaf/.style / minimum height` | `8mm` | 6 | src/engine/options.js | verified |
| tikzset | `leaf/.style / minimum width` | `14mm` | 6 | src/engine/options.js | verified |
| tikzset | `leaf/.style / rounded corners` | `2pt` | 6 | src/engine/options.js | verified |
| tikzset | `term/.style` | `{draw,circle,minimum size=9mm,inner sep=1pt,fill=blue!10}` | 6 | src/engine/options.js | verified |
| tikzset | `term/.style / circle` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `term/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `term/.style / fill` | `blue!10` | 6 | src/engine/options.js | verified |
| tikzset | `term/.style / inner sep` | `1pt` | 6 | src/engine/options.js | verified |
| tikzset | `term/.style / minimum size` | `9mm` | 6 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| literal | `2` | 1 | 18 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | verified |
| option:tikzpicture | `-11mm` | 1 | 14 | src/engine/options.js | verified |
| option:tikzpicture | `-16mm` | 1 | 15 | src/engine/options.js | verified |
| option:tikzpicture | `-18mm` | 2 | 15 | src/engine/options.js | verified |
| option:tikzpicture | `0` | 1 | 14 | src/engine/options.js | verified |
| option:tikzpicture | `16mm` | 1 | 15 | src/engine/options.js | verified |
| option:tikzset | `10` | 1 | 7 | src/engine/options.js | verified |
| option:tikzset | `14mm` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `1pt` | 2 | 7, 8 | src/engine/options.js | verified |
| option:tikzset | `2pt` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `8mm` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `9mm` | 1 | 7 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
