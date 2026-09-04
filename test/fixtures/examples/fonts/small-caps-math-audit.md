# Semantic Audit: small-caps-math.tex

Status: **blocked**

## Summary

| Packages | Libraries | Commands | Options | Declarations | Numbers | Expressions | Todos | Blockers |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 9 | 4 | 0 | 10 | 0 | 4 | 2 |

## Local Dependencies

| Kind | Name | JS status/owner | Local MacTeX source | Reviewed |
| --- | --- | --- | --- | --- |
| package | `tikz` | builtin / src/frontend/parser.js + src/engine/evaluate.js:interpretPathStatement/transformCanvasTransform/resolvedTextFontSpec/resolveAutoInlineNodePoint/autoInlineNodeAnchor/autoInlineNodeUsesOppositeAnchor/resolveSlopedInlineNodePoint/inlineNodePathTangent/flushOrthogonalInlinePathNodes/arcTimerPointAt/arcTimerTangentAt/arcTimerAngleAt/buildArc + src/tex/fontSpec.js + src/tikz/textMetrics.js + src/renderers/svg/textLayout.js + src/renderers/svg/richText.js + src/renderers/svg/renderSvg.js | /usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty | no |

## Commands

| Command | Count | Lines | Owner | Local MacTeX source | Status | Review |
| --- | ---: | --- | --- | --- | --- | --- |
| `\begin` | 2 | 3, 4 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\documentclass` | 1 | 1 | src/frontend/latex-shell.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\draw` | 1 | 5 | src/tikz/commands/draw.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\end` | 2 | 9, 10 | src/frontend/parser.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |
| `\large` | 1 | 6 | src/tex/fontSpec.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/size10.clo | partial | verified |
| `\node` | 3 | 6, 7, 8 | src/tikz/commands/node.js | /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex | partial | verified |
| `\scshape` | 1 | 6 | - | - | unmapped | verified |
| `\textsc` | 1 | 7 | - | - | unmapped | verified |
| `\usepackage` | 1 | 2 | src/packages/declarations.js | /usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx | stable | verified |

## Environments

| Environment | Count | Lines | Owner | Status | Review |
| --- | ---: | --- | --- | --- | --- |
| `document` | 1 | 3 | src/frontend/latex-shell.js | stable | verified |
| `tikzpicture` | 1 | 4 | src/frontend/parser.js | stable | verified |

## Option Tree

| Context | Parameter path | Values | Lines | Owner | Review |
| --- | --- | --- | --- | --- | --- |
| documentclass | `border` | `2pt` | 1 | src/engine/options.js | verified |
| draw | `thick` | `true` | 5 | src/engine/options.js | verified |
| node | `anchor` | `south`<br>`north` | 6, 7, 8 | src/engine/options.js | verified |
| node | `font` | `\large\scshape` | 6 | src/engine/options.js | verified |

## Variables And Definitions

| Kind | Name | Value/domain | Line | References | Review |
| --- | --- | --- | ---: | --- | --- |

## Numeric Semantics

| Context | Literal | Count | Lines | Owner | Review |
| --- | --- | ---: | --- | --- | --- |
| draw | `0` | 3 | 5 | src/engine/units.js | verified |
| draw | `1.2` | 1 | 5 | src/engine/units.js | verified |
| draw | `2.1` | 1 | 5 | src/engine/units.js | verified |
| draw | `4` | 1 | 5 | src/engine/units.js | verified |
| node | `-0.25` | 1 | 7 | src/engine/units.js | verified |
| node | `-0.75` | 1 | 8 | src/engine/units.js | verified |
| node | `2` | 5 | 7, 8 | src/engine/units.js | verified |
| option:documentclass | `2pt` | 1 | 1 | src/engine/options.js | verified |
| scshape | `2` | 1 | 6 | src/engine/units.js | verified |
| scshape | `2.35` | 1 | 6 | src/engine/units.js | verified |

## Plot Expressions

| Line | Expression | Owner | Review |
| ---: | --- | --- | --- |

## Acceptance Gate

### Blockers

- command:\scshape: no implementation owner
- command:\textsc: no implementation owner

### Required Reviews

- dependency:package:tikz: local source not reviewed
- command:\draw: local source not reviewed
- command:\large: local source not reviewed
- command:\node: local source not reviewed
