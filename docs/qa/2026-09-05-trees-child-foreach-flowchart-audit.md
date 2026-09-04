# Semantic Audit: child-foreach-flowchart.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 9 | 16 | 2 | 9 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions + src/tikz/commands/foreach.js:foreachIterationVariables | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 10, 11 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 16, 17 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 1 | 12 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\stage` | 2 | 13, 15 | source declaration | - | source-local | verified |
| `\tikzset` | 1 | 5 | src/engine/options.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\tone` | 3 | 13, 15 | source declaration | - | source-local | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 3 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 10 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 11 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| child | `draw` | `\tone` | 13 | src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach | verified |
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| node | `fill` | `blue!10` | 12 | src/engine/options.js | verified |
| node | `stage` | `true` | 12 | src/engine/options.js | verified |
| tikzpicture | `grow` | `down` | 11 | src/engine/options.js | verified |
| tikzpicture | `level distance` | `14mm` | 11 | src/engine/options.js | verified |
| tikzpicture | `sibling distance` | `26mm` | 11 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style` | `{draw,thick}` | 5 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / draw` | `true` | 5 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / thick` | `true` | 5 | src/engine/options.js | verified |
| tikzset | `stage/.style` | `{draw,rounded corners=2pt,minimum width=18mm,minimum height=7mm,inner sep=2pt}` | 5 | src/engine/options.js | verified |
| tikzset | `stage/.style / draw` | `true` | 5 | src/engine/options.js | verified |
| tikzset | `stage/.style / inner sep` | `2pt` | 5 | src/engine/options.js | verified |
| tikzset | `stage/.style / minimum height` | `7mm` | 5 | src/engine/options.js | verified |
| tikzset | `stage/.style / minimum width` | `18mm` | 5 | src/engine/options.js | verified |
| tikzset | `stage/.style / rounded corners` | `2pt` | 5 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |
| foreach-variable | `\stage` | Lint/green!50!black,Test/blue,Package/orange!80!black | 13 | 1 (15) | verified |
| foreach-variable | `\tone` | Lint/green!50!black,Test/blue,Package/orange!80!black | 13 | 1 (15) | verified |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| literal | `50` | 1 | 14 | src/engine/units.js | verified |
| literal | `80` | 1 | 14 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| option:node | `10` | 1 | 12 | src/engine/options.js | verified |
| option:tikzpicture | `14mm` | 1 | 11 | src/engine/options.js | verified |
| option:tikzpicture | `26mm` | 1 | 11 | src/engine/options.js | verified |
| option:tikzset | `18mm` | 1 | 6 | src/engine/options.js | verified |
| option:tikzset | `2pt` | 2 | 6 | src/engine/options.js | verified |
| option:tikzset | `7mm` | 1 | 6 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
