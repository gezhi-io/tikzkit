# `shapes.multipart`: Horizontal B-tree Split Nodes

## Scope

This QA slice covers the horizontal `rectangle split` layout used by real
B-tree nodes: per-part width accumulation, bare `nodepart` anchors, centered
text, custom fills, and pointer start positions. It deliberately excludes
circle split and other multipart shapes.

## Local PGF Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`

The TikZ library forwards rectangle-split keys to the PGF shape. The PGF shape
measures each part box independently. For a horizontal split, each subsequent
bare part anchor advances by the previous box width plus two `inner xsep`
values and one line width. The manual also specifies that horizontal splits
honor minimum height but ignore minimum width.

MacTeX anchor instrumentation for the 13-part node measured a `192.42pt`
outer-anchor span. Successive `5` to empty and empty to `-3` anchors advanced
by `12.716pt` and `13.271pt`, respectively.

## Change

`rectangleSplitLayout` now bypasses browser font measurement only while sizing
typewriter split parts. It uses the existing fixed cmtt10 advance model, while
the SVG text renderer continues to draw the normal scoped typewriter font.
This removes the previous approximately `0.833` per-glyph layout measurement
and prevents the error from compounding across many parts.

## Visual Evidence

Artifacts are in the ignored local directory:

`outputs/qa-shapes-multipart-btree-2026-08-05/`

- MacTeX PNG: `mactex-png/`
- TikZKit SVG/PNG and 1cm-grid variants: `tikzkit-svg/`, `tikzkit-png/`,
  `tikzkit-grid-svg/`, `tikzkit-grid-png/`
- tikztosvg SVG/PNG and 1cm-grid variants: `tikztosvg-svg/`,
  `tikztosvg-png/`, `tikztosvg-grid-svg/`, `tikztosvg-grid-png/`
- four-panel sheets and diffs: `diff/`, `diff-png/`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Before the change, `latex-examples-b-tree-node` was `261px` wide against the
`278px` tikztosvg reference; after the change it is `277px` wide. Its changed
pixel ratio fell from `44.17%` to `39.76%`. `latex-examples-b-tree-2-small-2`
now matches the `384px` reference width instead of rendering at `379px`; its
changed-pixel ratio fell from `19.97%` to `18.38%`.

The remaining differences are mostly glyph hinting, outer-label baseline
placement, and the native-vs-SVG rasterization boundary. The split boxes,
empty-child centers, numerical fields, and vertical pointer starts now retain
their relative PGF positions.

## Tests

```bash
node --test --test-name-pattern='horizontal split accumulation|wide horizontal rectangle split|optically centers rectangle split text' test/interpreter.test.js
node --test test/shapes-multipart-align.test.js test/shapes-multipart-vertical.test.js test/shapes-multipart-ignore-empty.test.js
```

The first command covers the 13-part real width and the PGF anchor increments.
The second retains the existing horizontal/vertical alignment and ignored-empty
part behavior.

## Remaining Boundaries

This is not a claim of full `shapes.multipart` compatibility. Circle split,
other multipart shapes, and exact TeX glyph outlines remain partial.
