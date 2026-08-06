# Mindmap Concept-Color Connections QA (2026-08-06)

## Scope

This focused slice implements the documented `mindmap` path form used by the
PGF manual's Computer Science example:

```tex
\path[mindmap,concept color=black,text=white]
  node[concept] {Computer Science}
  [clockwise from=0]
  child[concept color=green!50!black] { ... };
```

It covers one visual family only: `\path ... node ... child` lowering,
concept-color inheritance, filled color-transition connection bars, root/level
circle sizing, nested `clockwise from`, and `text width` paragraph breaking in
concept circles. It does not claim complete mindmap support.

## Local MacTeX Study

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarymindmap.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-mindmaps.tex`

The source defines the root/level circle dimensions and uses
`circle connection bar switch color` for each parent/child link. That link is
a broad filled shape whose color shading transitions from the parent concept
color to the child concept color; it is not a thin tree edge. The manual
example also places a child generation using its local `clockwise from` value,
then gives descendants their own orientation.

## Command And Option Audit

| Source surface | Status in this slice |
| --- | --- |
| `\usetikzlibrary{mindmap}` | registered as partial, with local source and manual reviewed |
| `\path[mindmap] node ... child ...` | implemented and lowered to the normal node/tree IR |
| `concept`, `concept color`, root/level styles | implemented for the documented circle hierarchy |
| `clockwise from`, `sibling angle`, `grow cyclic` | implemented for the relevant child generation |
| `text width` in a concept circle | implemented as a centered paragraph constraint |
| TeX `\-` discretionary break | implemented when it is required by the measured width |
| `circle connection bar switch color` | visually approximated as a closed cubic SVG path with a parent-to-child linear gradient |
| annotations, extra concepts, arbitrary custom connection paths | not implemented in this slice |

## Visual Procedure

The real fixture is
`test/fixtures/examples/mindmap/concept-color-connections.tex`, copied from
the local TeX Live mindmap manual. Artifacts are under
`/private/tmp/tikzkit-qa-mindmap-connections-final-2026-08-06`:

```bash
npm run examples:render -- --fixtures test/fixtures/examples \
  --only mindmap-concept-color-connections \
  --output /private/tmp/tikzkit-qa-mindmap-connections-final-2026-08-06 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-mindmap-connections-final-2026-08-06 \
  --register --alignment-radius 3
```

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The generated files are:

- JS SVG/PNG: `tikzkit-svg/mindmap-concept-color-connections.svg` and
  `tikzkit-png/mindmap-concept-color-connections.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/mindmap-concept-color-connections.svg` and
  `tikztosvg-png/mindmap-concept-color-connections.png`.
- Native MacTeX PNG and four-way visual sheet:
  `mactex-png/mindmap-concept-color-connections.png` and
  `diff/mindmap-concept-color-connections-native-sheet.png`.

All three renderers completed without an external failure. The tikztosvg SVG
uses transformed `userSpaceOnUse` linear gradients and closed filled paths for
the connection bars. TikZKit now follows the same output model with user-space
parent-to-child gradients, closed paths, butt/miter circle outlines, and
centered SVG text.

Before this change, the JS result was empty because `\path ... node ... child`
was not parsed as a tree. After it, all 11 circle nodes and 10 connection bars
are visible: `practical` has its four green descendants in the native
directions, `applied` has its two blue descendants, and the red/orange root
branches retain their inherited color transitions. The inspected JS panel now
breaks `data structures`, `software engineering`, and the manually marked
`pro-`/`gramming languages` exactly as semantic paragraphs rather than showing
a literal backslash or inserting unrelated automatic hyphens.

The current JS crop is `556x456px`; tikztosvg is `552x451px`. The registered
JS-to-MacTeX comparison has 0.0579 changed pixels and mean absolute RGBA
0.0153. These figures are supporting evidence only: visually, no concept node
or branch is missing. The remaining visible difference is the exact organic
curve of PGF's connection bar and its small crop reserve, so this library
remains `partial` rather than pixel-identical.

## Regression

```bash
node --test test/mindmap-connections.test.js test/text-package-macros.test.js
```

All 15 focused tests pass. The regression set asserts color inheritance on
filled closed bars, one-generation nested `clockwise from`, and discretionary
hyphen behavior while retaining the existing centered text-width wrapping
coverage.

## Next Step

Derive the connection-bar cubic controls directly from the local PGF path
construction, then reduce the remaining crop and curve residual without
changing the documented tree-placement semantics verified here.
