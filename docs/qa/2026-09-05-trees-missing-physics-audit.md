# Semantic Audit: missing-physics.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 8 | 13 | 0 | 8 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild + src/engine/evaluate.js:createNodeTreeChildren/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 6, 7 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 2 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 19, 20 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\gamma` | 1 | 14 | src/renderers/svg/mathNode.js | - | partial | verified |
| `\node` | 1 | 13 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\rangle` | 4 | 13, 14, 15, 18 | src/renderers/svg/mathNode.js | - | partial | verified |
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
| child | `missing` | `true` | 15 | src/frontend/parser.js:parseNodeTreeChild + src/engine/evaluate.js:createNodeTreeChildren | verified |
| documentclass | `border` | `2pt` | 2 | src/engine/options.js | verified |
| node | `fill` | `orange!25` | 13 | src/engine/options.js | verified |
| tikzpicture | `every node/.style` | `{draw,rectangle,rounded corners=2pt,minimum width=16mm,minimum height=8mm,fill=orange!10}` | 7 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / draw` | `true` | 7 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / fill` | `orange!10` | 7 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / minimum height` | `8mm` | 7 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / minimum width` | `16mm` | 7 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / rectangle` | `true` | 7 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / rounded corners` | `2pt` | 7 | src/engine/options.js | verified |
| tikzpicture | `grow` | `down` | 7 | src/engine/options.js | verified |
| tikzpicture | `level distance` | `15mm` | 7 | src/engine/options.js | verified |
| tikzpicture | `sibling distance` | `20mm` | 7 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| option:documentclass | `2pt` | 1 | 2 | src/engine/options.js | verified |
| option:node | `25` | 1 | 13 | src/engine/options.js | verified |
| option:tikzpicture | `10` | 1 | 11 | src/engine/options.js | verified |
| option:tikzpicture | `15mm` | 1 | 9 | src/engine/options.js | verified |
| option:tikzpicture | `16mm` | 1 | 11 | src/engine/options.js | verified |
| option:tikzpicture | `20mm` | 1 | 10 | src/engine/options.js | verified |
| option:tikzpicture | `2pt` | 1 | 11 | src/engine/options.js | verified |
| option:tikzpicture | `8mm` | 1 | 11 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.

