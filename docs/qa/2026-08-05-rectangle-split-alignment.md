# `shapes.multipart` Horizontal Alignment QA

## Scope

This slice implements the horizontal `rectangle split part align` values
`center`, `top`, `bottom`, and `base`. It also preserves PGF's list rule: when
fewer values are supplied than node parts, the last value applies to all
remaining parts.

It deliberately does not add vertical rectangle splits, the vertical
`center`/`left`/`right` alignment family, or the `none` alignment value.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.multipart.code.tex`
  loads the PGF multipart shape implementation.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
  defines `rectangle split part align`, its final-value list extension, and
  the horizontal origin equations.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`
  supplies the real four-row `\Large w`, `x`, `\Huge y`, `\tiny z` alignment
  example used for this QA case.

For a horizontal split, PGF first records the maximum box height `H`, depth
`D`, and usable content height `M`. It positions each text-box origin at
`(d-h)/2` for `center`, `M/2-h` for `top`, `-M/2+d` for `bottom`, and
`(D-H)/2` for `base`. TikZKit now stores both the text origin used by named
part anchors and the visual text center used by the SVG renderer.

## Implemented Commands And Options

Implemented in this slice:

- `\node[rectangle split,rectangle split horizontal]`
- `rectangle split parts=<n>`
- `rectangle split part align=center|top|bottom|base`, including comma lists
  and final-value repetition
- `\nodepart{one}` through the supported numbered/name part selectors
- named bare part anchors such as `(node.two)` and `(node.three)` on the
  resulting TeX-box origins
- `\Large`, `\Huge`, and `\tiny` part text metrics used by the real example

The existing centered path remains covered by
`latex-examples/b-tree-2-small-2.tex`: its `rectangle split part align={center}`
still keeps the B-tree keys centered and its pointer anchors unchanged.

Still partial:

- vertical `rectangle split` geometry and `left`/`right` part alignment;
- `rectangle split part align=none`;
- every multipart style hook and all low-level PGF box allocation controls;
- exact TeX text metrics for arbitrary macro-expanded or multi-line part text.

## Visual Evidence

Source and generated artifacts are in the ignored directory
`outputs/qa-rectangle-split-align/`:

- MacTeX native PNG: `native/rectangle-split-align.png`
- TikZKit SVG/PNG: `tikzkit.svg`, `tikzkit.png`
- tikztosvg SVG/PNG: `tikztosvg.svg`, `tikztosvg.png`
- before-equivalent TikZKit PNG: `tikzkit-before-equivalent.png`
- native/JS/tikztosvg/diff sheet: `sheet.png`
- before/after sheet: `before-after.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. It accepts a TikZ
snippet rather than a complete document, so the equivalent input is
`tikztosvg-equivalent.tikz` and was rendered with:

```bash
tikztosvg -l shapes.multipart \
  -o outputs/qa-rectangle-split-align/tikztosvg.svg \
  outputs/qa-rectangle-split-align/tikztosvg-equivalent.tikz
```

Before the repair, all four rows had their four glyph boxes vertically
centered, so `top`, `bottom`, and `base` were visually ignored. Afterward:

- row one places `x` at the top and the larger `y` plus tiny `z` at the
  bottom;
- row two repeats `top` for its third and fourth parts;
- row three keeps every part centered;
- row four puts all text-box origins on one baseline, making the larger `y`
  extend farther below the small letters.

MacTeX, TikZKit, and tikztosvg show those four relationships. The remaining
visible differences are small font/canvas differences: the inspected native
PNG was resampled from 144 DPI to 96 DPI, TikZKit is `63.06pt × 132.82pt`, and
tikztosvg is `58.627pt × 129.029pt`. The raw JS/tikztosvg pixel diff is thus a
dimension mismatch and a diagnostic only, not acceptance evidence.

## SVG Reference Notes

tikztosvg emits a `58.627pt × 129.029pt` viewBox, clips every split row, uses
one stroked rectangular path with butt caps/miter joins, and places outlined
glyphs through `<use>` positions. In its last row all four glyph uses share
`y="120.477"`, directly showing the common baseline. TikZKit emits explicit
split-cell `<rect>` elements, separator `<path>` elements, and `<text>` groups
with `dominant-baseline="middle"`; the new per-part `translate(x,y)` values
preserve the same alignment semantics in browser SVG.

## Verification

```bash
node --test test/shapes-multipart-align.test.js test/shapes-multipart-ignore-empty.test.js
npm run extension-registry
```

The focused tests pass with no new diagnostics. `node --test test/interpreter.test.js`
still has 12 pre-existing failures in unrelated dirty-worktree work (coordinate
systems, arrow scaling, and color normalization); the existing multipart tests
inside that file all pass. The registry was regenerated locally and now lists
the alignment family for `shapes.multipart`; registry files are not staged
because they already include unrelated edits.
