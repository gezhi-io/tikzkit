# Semantic Audit: flowchart.tex

Status: **accepted**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 8 | 16 | 0 | 10 | 0 | 0 | 0 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js + src/renderers/svg/fontFamilies.js + src/renderers/svg/textEngine.js + src/renderers/svg/segmentedText.js + src/frontend/parser.js:parseParabolaSegment + src/tikz/pathOperations/parabola.js:pgfParabolaCommands + src/engine/evaluate.js:resolveParabolaBend | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | yes |
| tikz-library | `trees` | partial / src/frontend/parser.js:parseNodeTreeChild/parseNodeTreeForeach/parseTreeEdgeFromParent + src/engine/evaluate.js:createNodeTreeChildren/expandTreeChildForeach/mergeTreeGrowthOptions/treeGrowthSpec/treeChildOffset/treeGrowthParentPoint/treeEdgeEndpoints/treeEveryChildNodeOptions/treeEdgeRoute/addTreeEdge + src/tikz/libraries/trees.js:parseGrowViaThreePoints/threePointChildOffset/parseEdgeFromParentPathTemplate + src/tikz/commands/foreach.js:foreachIterationVariables | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex | yes |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 4, 5 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\end` | 2 | 18, 19 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\node` | 1 | 15 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\tikzchildnode` | 1 | 12 | src/tikz/libraries/trees.js:parseEdgeFromParentPathTemplate + src/engine/evaluate.js:treeEdgeRoute | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\tikzparentnode` | 1 | 12 | src/tikz/libraries/trees.js:parseEdgeFromParentPathTemplate + src/engine/evaluate.js:treeEdgeRoute | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\usetikzlibrary` | 1 | 3 | src/tikz/libraries/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 4 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 5 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| tikzpicture | `edge from parent path` | `{<br>    (\tikzparentnode.south) .. controls +(0,-6mm) and +(0,6mm) .. (\tikzchildnode.north)<br>  }` | 5 | src/tikz/libraries/trees.js:parseEdgeFromParentPathTemplate + src/engine/evaluate.js:treeEdgeRoute/addTreeEdge | verified |
| tikzpicture | `edge from parent path / (\tikzparentnode.south) .. controls +(0,-6mm) and +(0,6mm) .. (\tikzchildnode.north)` | `true` | 5 | src/tikz/libraries/trees.js:parseEdgeFromParentPathTemplate + src/engine/evaluate.js:treeEdgeRoute/addTreeEdge | verified |
| tikzpicture | `edge from parent/.style` | `{draw,thick,-stealth}` | 5 | src/engine/options.js:withImplicitStyleOption + src/engine/evaluate.js:addTreeEdge | verified |
| tikzpicture | `edge from parent/.style / -stealth` | `true` | 5 | src/engine/options.js:withImplicitStyleOption + src/engine/evaluate.js:addTreeEdge | verified |
| tikzpicture | `edge from parent/.style / draw` | `true` | 5 | src/engine/options.js:withImplicitStyleOption + src/engine/evaluate.js:addTreeEdge | verified |
| tikzpicture | `edge from parent/.style / thick` | `true` | 5 | src/engine/options.js:withImplicitStyleOption + src/engine/evaluate.js:addTreeEdge | verified |
| tikzpicture | `every node/.style` | `{draw,rounded corners=2pt,minimum width=17mm,minimum height=7mm,fill=blue!8}` | 5 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / draw` | `true` | 5 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / fill` | `blue!8` | 5 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / minimum height` | `7mm` | 5 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / minimum width` | `17mm` | 5 | src/engine/options.js | verified |
| tikzpicture | `every node/.style / rounded corners` | `2pt` | 5 | src/engine/options.js | verified |
| tikzpicture | `grow` | `down` | 5 | src/engine/options.js | verified |
| tikzpicture | `level distance` | `18mm` | 5 | src/engine/options.js | verified |
| tikzpicture | `sibling distance` | `34mm` | 5 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| option:tikzpicture | `-6mm` | 1 | 12 | src/engine/options.js | verified |
| option:tikzpicture | `0` | 2 | 12 | src/engine/options.js | verified |
| option:tikzpicture | `17mm` | 1 | 9 | src/engine/options.js | verified |
| option:tikzpicture | `18mm` | 1 | 7 | src/engine/options.js | verified |
| option:tikzpicture | `2pt` | 1 | 9 | src/engine/options.js | verified |
| option:tikzpicture | `34mm` | 1 | 8 | src/engine/options.js | verified |
| option:tikzpicture | `6mm` | 1 | 12 | src/engine/options.js | verified |
| option:tikzpicture | `7mm` | 1 | 9 | src/engine/options.js | verified |
| option:tikzpicture | `8` | 1 | 9 | src/engine/options.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

All semantic items are reviewed and backed by evidence.
