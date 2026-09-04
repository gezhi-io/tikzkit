# Semantic Audit: physics-decay.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 10 | 26 | 0 | 15 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/mergeTreeGrowthOptions/treeGrowthSpec/treeChildOffset/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions + src/tikz/commands/foreach.js:foreachIterationVariables | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 12, 13 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 30, 31 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\mu` | 2 | 22, 23 | src/renderers/svg/mathNode.js | - | partial | verified |
| `\node` | 1 | 19 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\pi` | 1 | 28 | src/renderers/svg/mathNode.js | - | partial | verified |
| `\psi` | 1 | 21 | src/renderers/svg/mathNode.js | - | partial | verified |
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
| child | `grow'` | `right` | 27 | src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach | verified |
| child | `level distance` | `19mm` | 27 | src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach | verified |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | verified |
| node | `particle` | `true` | 19 | src/engine/options.js | verified |
| tikzpicture | `grow'` | `down` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style` | `{sibling distance=38mm}` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style / sibling distance` | `38mm` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 2/.style` | `{sibling distance=17mm}` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 2/.style / sibling distance` | `17mm` | 13 | src/engine/options.js | verified |
| tikzpicture | `level distance` | `16mm` | 13 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style` | `{draw,thick,-stealth}` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / -stealth` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / thick` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `particle/.style` | `{draw,circle,minimum size=10mm,inner sep=1pt,fill=blue!10}` | 6 | src/engine/options.js | verified |
| tikzset | `particle/.style / circle` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `particle/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `particle/.style / fill` | `blue!10` | 6 | src/engine/options.js | verified |
| tikzset | `particle/.style / inner sep` | `1pt` | 6 | src/engine/options.js | verified |
| tikzset | `particle/.style / minimum size` | `10mm` | 6 | src/engine/options.js | verified |
| tikzset | `product/.style` | `{draw,rounded corners=2pt,minimum width=11mm,minimum height=7mm,inner sep=1pt}` | 6 | src/engine/options.js | verified |
| tikzset | `product/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `product/.style / inner sep` | `1pt` | 6 | src/engine/options.js | verified |
| tikzset | `product/.style / minimum height` | `7mm` | 6 | src/engine/options.js | verified |
| tikzset | `product/.style / minimum width` | `11mm` | 6 | src/engine/options.js | verified |
| tikzset | `product/.style / rounded corners` | `2pt` | 6 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| literal | `0` | 1 | 26 | src/engine/units.js | verified |
| node | `0` | 1 | 19 | src/engine/units.js | verified |
| option:child | `19mm` | 1 | 27 | src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach | verified |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | verified |
| option:tikzpicture | `1` | 1 | 16 | src/engine/options.js | verified |
| option:tikzpicture | `16mm` | 1 | 15 | src/engine/options.js | verified |
| option:tikzpicture | `17mm` | 1 | 17 | src/engine/options.js | verified |
| option:tikzpicture | `2` | 1 | 17 | src/engine/options.js | verified |
| option:tikzpicture | `38mm` | 1 | 16 | src/engine/options.js | verified |
| option:tikzset | `10` | 1 | 7 | src/engine/options.js | verified |
| option:tikzset | `10mm` | 1 | 7 | src/engine/options.js | verified |
| option:tikzset | `11mm` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `1pt` | 2 | 7, 8 | src/engine/options.js | verified |
| option:tikzset | `2pt` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `7mm` | 1 | 8 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
