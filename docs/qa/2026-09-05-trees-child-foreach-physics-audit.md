# Semantic Audit: child-foreach-physics.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 11 | 17 | 3 | 10 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions + src/tikz/commands/foreach.js:foreachIterationVariables | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 10, 11 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\channel` | 2 | 20, 21 | source declaration | - | source-local | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 23, 24 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\gamma` | 1 | 21 | src/renderers/svg/mathNode.js | - | partial | verified |
| `\node` | 1 | 17 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\state` | 3 | 18, 19, 21 | source declaration | - | source-local | verified |
| `\tikzset` | 1 | 5 | src/engine/options.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\tone` | 2 | 18, 19 | source declaration | - | source-local | verified |
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
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| node | `state` | `true` | 17 | src/engine/options.js | verified |
| tikzpicture | `grow` | `down` | 11 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style` | `{sibling distance=32mm}` | 11 | src/engine/options.js | verified |
| tikzpicture | `level 1/.style / sibling distance` | `32mm` | 11 | src/engine/options.js | verified |
| tikzpicture | `level 2/.style` | `{sibling distance=13mm}` | 11 | src/engine/options.js | verified |
| tikzpicture | `level 2/.style / sibling distance` | `13mm` | 11 | src/engine/options.js | verified |
| tikzpicture | `level distance` | `13mm` | 11 | src/engine/options.js | verified |
| tikzset | `channel/.style` | `{draw,rounded corners=2pt,inner sep=2pt}` | 5 | src/engine/options.js | verified |
| tikzset | `channel/.style / draw` | `true` | 5 | src/engine/options.js | verified |
| tikzset | `channel/.style / inner sep` | `2pt` | 5 | src/engine/options.js | verified |
| tikzset | `channel/.style / rounded corners` | `2pt` | 5 | src/engine/options.js | verified |
| tikzset | `state/.style` | `{draw,circle,minimum size=8mm,inner sep=1pt}` | 5 | src/engine/options.js | verified |
| tikzset | `state/.style / circle` | `true` | 5 | src/engine/options.js | verified |
| tikzset | `state/.style / draw` | `true` | 5 | src/engine/options.js | verified |
| tikzset | `state/.style / inner sep` | `1pt` | 5 | src/engine/options.js | verified |
| tikzset | `state/.style / minimum size` | `8mm` | 5 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |
| foreach-variable | `\state` | e/red,b/blue | 18 | 2 (19, 21) | verified |
| foreach-variable | `\tone` | e/red,b/blue | 18 | 1 (19) | verified |
| foreach-variable | `\channel` | 1,2 | 20 | 1 (21) | verified |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| channel | `1` | 1 | 20 | src/engine/units.js | verified |
| channel | `2` | 1 | 20 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| option:tikzpicture | `1` | 1 | 14 | src/engine/options.js | verified |
| option:tikzpicture | `13mm` | 2 | 13, 15 | src/engine/options.js | verified |
| option:tikzpicture | `2` | 1 | 15 | src/engine/options.js | verified |
| option:tikzpicture | `32mm` | 1 | 14 | src/engine/options.js | verified |
| option:tikzset | `1pt` | 1 | 6 | src/engine/options.js | verified |
| option:tikzset | `2pt` | 2 | 7 | src/engine/options.js | verified |
| option:tikzset | `8mm` | 1 | 6 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
