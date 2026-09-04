# arrows.spaced `spaced implies`

## Scope

This slice implements the single public legacy name `spaced implies`. It covers ordinary and double shafts, custom `double distance`, colored inner strokes, start/end/bidirectional tips, straight and orthogonal routes, and curved terminal tangents. No synthetic `spaced implies reversed` name is added because TeX Live declares no such public alias; placing the same tip at a path start supplies the reverse orientation.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`: `spaced implies` is declared with `\pgfarrowsdeclarecombine*{spaced implies}{spaced implies}{implies}{implies}{space}{space}`. The visible tip and invisible space component are composed with the starred line-end behavior.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: `implies` is an open, symmetric two-cubic path with round cap and join. Its unit is `0.25*pgflinewidth + 0.25*pgfinnerlinewidth`; its arrow stroke is `0.5*pgflinewidth - 0.5*pgfinnerlinewidth`. Backend, tip end, and height include half that arrow stroke.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `space` paints nothing, has backend zero, and extends `0.88pt + 0.3*pgflinewidth` past the visible tip.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: confirms the lowercase public name in the `arrows.spaced` library.

For a TikZ double shaft, the active PGF outer width is `2*line width + double distance`, while `pgfinnerlinewidth` is the requested inner distance. At `line width=1pt,double distance=.6pt`, this yields outer `2.6pt`, inner `.6pt`, implies unit `.8pt`, arrow stroke `1pt`, backend `-1.588pt`, tip end `2.148pt`, and an additional `1.66pt` invisible space.

## Third-party SVG reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. A focused probe and all three accepted fixtures were rendered with its `pdflatex` engine. The SVG represents a double shaft as separate outer and inner `<path>` elements. Each implication tip is another unfilled `<path>` with two cubic segments, `stroke-linecap="round"`, `stroke-linejoin="round"`, and an independently computed stroke width. Start tips use a 180-degree reflection transform; curved tips use the terminal tangent transform.

Artifacts:

- `outputs/qa/2026-09-04-arrows-spaced-implies/tikzkit-svg`
- `outputs/qa/2026-09-04-arrows-spaced-implies/tikztosvg-svg`
- `outputs/qa/2026-09-04-arrows-spaced-implies/mactex-png`
- `outputs/qa/2026-09-04-arrows-spaced-implies/diff`

## Visual result

Before this slice, `spaced implies` was not recognized as one arrow name, so the implication curve, its double-line-dependent size, and the required endpoint space were absent.

After the repair:

- The validation flow preserves the implication gap at six terminals across ordinary, colored-inner, start-only, orthogonal, and curved routes.
- The proposition diagram paints forward and bidirectional implications without tip/node collisions; both ends shorten independently.
- The feedback system keeps the custom outer/inner widths on horizontal, vertical, orthogonal, and curved physical-signal paths.

The MacTeX/tikztosvg/TikZKit/diff sheets were inspected directly. No arrows, inner strokes, labels, or nodes are missing. Tip direction, round joins, line width, colored layers, and curved tangent orientation agree with the references. Remaining visible residuals are global text rasterization and roughly one-pixel node or canvas bounds, not `spaced implies` geometry.

## Commands and parameters

Implemented and exercised in this slice: `\documentclass`, `\usepackage{tikz}`, `\usetikzlibrary{arrows,arrows.spaced,positioning}`, `\begin{tikzpicture}`, `\node`, `\draw`, named nodes, reusable styles, `right=of`, `below=of`, colors and color mixes, `line width`, `double`, `double=<color>`, `double distance`, `-{spaced implies}`, `{spaced implies}-`, `{spaced implies}-{spaced implies}`, `--`, `|-`, `to`, `bend right`, inline path nodes, `above`, `below`, `right`, and `sloped`. Every literal and option in the three fixtures is covered by an accepted strict semantic review.

Not implemented by this slice: spaced triangle/open-triangle families, hooks, circle/diamond/square families, brackets, left/right half arrows, and `spaced serif cm`.

## Verification

```sh
node --test test/arrows-spaced-implies.test.js test/arrows-spaced-common.test.js test/arrows-spaced-caps.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-arrows-spaced-implies --continue-on-external-failure --strict-tikztosvg --native-reference --native-latex-engine pdflatex --tikztosvg-engine pdflatex --math-renderer svg-text --only arrows-spaced-implies-flowchart --only arrows-spaced-implies-math --only arrows-spaced-implies-physics
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-arrows-spaced-implies
```

All three cases produced TikZKit SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG artifacts with zero TikZKit diagnostics. All three strict semantic audits passed.
