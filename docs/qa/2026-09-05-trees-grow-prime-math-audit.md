# Semantic Audit: math-expression.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 9 | 25 | 0 | 15 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/mergeTreeGrowthOptions/treeGrowthSpec/treeChildOffset/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions + src/tikz/commands/foreach.js:foreachIterationVariables | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 12, 13 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\cdot` | 1 | 29 | src/renderers/svg/mathNode.js | - | partial | verified |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 34, 35 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 1 | 20 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\sin` | 1 | 25 | src/renderers/svg/mathNode.js | - | partial | verified |
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
| node | `operator` | `true` | 20 | src/engine/options.js | verified |
| tikzpicture | `grow'` | `down` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style` | `{sibling distance=34mm}` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style / sibling distance` | `34mm` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 2/.style` | `{sibling distance=18mm}` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 2/.style / sibling distance` | `18mm` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 3/.style` | `{sibling distance=11mm}` | 13 | src/engine/options.js | verified |
| tikzpicture | `level 3/.style / sibling distance` | `11mm` | 13 | src/engine/options.js | verified |
| tikzpicture | `level distance` | `13mm` | 13 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style` | `{draw,thick}` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `every edge from parent/.style / thick` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `operand/.style` | `{draw,rounded corners=2pt,minimum width=10mm,minimum height=7mm,inner sep=1pt}` | 6 | src/engine/options.js | verified |
| tikzset | `operand/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `operand/.style / inner sep` | `1pt` | 6 | src/engine/options.js | verified |
| tikzset | `operand/.style / minimum height` | `7mm` | 6 | src/engine/options.js | verified |
| tikzset | `operand/.style / minimum width` | `10mm` | 6 | src/engine/options.js | verified |
| tikzset | `operand/.style / rounded corners` | `2pt` | 6 | src/engine/options.js | verified |
| tikzset | `operator/.style` | `{draw,circle,minimum size=8mm,inner sep=1pt,fill=purple!12}` | 6 | src/engine/options.js | verified |
| tikzset | `operator/.style / circle` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `operator/.style / draw` | `true` | 6 | src/engine/options.js | verified |
| tikzset | `operator/.style / fill` | `purple!12` | 6 | src/engine/options.js | verified |
| tikzset | `operator/.style / inner sep` | `1pt` | 6 | src/engine/options.js | verified |
| tikzset | `operator/.style / minimum size` | `8mm` | 6 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| literal | `2` | 2 | 30, 31 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | verified |
| option:tikzpicture | `1` | 1 | 16 | src/engine/options.js | verified |
| option:tikzpicture | `11mm` | 1 | 18 | src/engine/options.js | verified |
| option:tikzpicture | `13mm` | 1 | 15 | src/engine/options.js | verified |
| option:tikzpicture | `18mm` | 1 | 17 | src/engine/options.js | verified |
| option:tikzpicture | `2` | 1 | 17 | src/engine/options.js | verified |
| option:tikzpicture | `3` | 1 | 18 | src/engine/options.js | verified |
| option:tikzpicture | `34mm` | 1 | 16 | src/engine/options.js | verified |
| option:tikzset | `10mm` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `12` | 1 | 7 | src/engine/options.js | verified |
| option:tikzset | `1pt` | 2 | 7, 8 | src/engine/options.js | verified |
| option:tikzset | `2pt` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `7mm` | 1 | 8 | src/engine/options.js | verified |
| option:tikzset | `8mm` | 1 | 7 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
