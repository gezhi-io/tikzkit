# `shapes.multipart` Vertical Rectangle Split QA

## Scope

This focused slice implements the default vertical `rectangle split` layout:
rows are stacked from top to bottom, and `rectangle split part align` accepts
`center`, `left`, and `right`. A shorter alignment list repeats its final value
for all remaining parts. Horizontal layout and its `top`/`bottom`/`base`
alignment remain covered by the companion QA record.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.multipart.code.tex`
  loads the TikZ layer for the library.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
  defines the vertical part stack, common part width, final-value list rule,
  and the `left`/`center`/`right` text-box origin equations.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`
  provides the three-node real example used here.

PGF gives every vertical cell the widest part's width, then places each text
box at the common left edge, right edge, or center. It stacks individual
height/depth boxes instead of forcing one row height. TikZKit now stores both
the text-box origin for bare part anchors and the visual center for SVG text.

## Implemented Commands And Options

- `\usetikzlibrary{shapes.multipart}`
- `\node[rectangle split]` without `rectangle split horizontal`
- `rectangle split parts=<n>` and `\nodepart{one}` through the supported names
- `rectangle split part align=center|left|right`, comma lists, and final-value
  repetition
- vertical common-width cells, horizontal separator strokes, per-part fills
- bare and cardinal part anchors such as `(node.two)`, `(node.four east)`, and
  `(node.three split)` for this layout

Still partial: `rectangle split part align=none`, exotic low-level box hooks,
arbitrary macro-expanded/multiline part metrics, and multipart shapes beyond
the implemented rectangle/circle slices.

## Visual Evidence

Artifacts live in the ignored directory `outputs/qa-rectangle-split-vertical/`:

- MacTeX: `native/rectangle-split-align.png`
- TikZKit: `tikzkit/rectangle-split-align.svg` and `.png`
- tikztosvg: `tikztosvg/rectangle-split-align.svg` and `.png`
- four-panel inspection sheet: `diff/sheet.png`
- before/after/reference sheet: `diff/before-after-tikztosvg.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and generated the
reference from `tikztosvg-equivalent.tikz` with
`tikztosvg -l shapes.multipart`. The converter returned a cleanup error after
successfully writing the SVG, so PNG conversion was run as a separate command.

Before this change, TikZKit emitted one short, ordinary node containing the
literal `\nodepart` fragments. Afterward it emits three four-row rectangle
splits. In the first, `2` is left aligned and `4` right aligned; in the second,
the final `left` value repeats for rows three and four; in the third, all rows
are centered. MacTeX native, tikztosvg, and TikZKit show the same relationships.

The inspected tikztosvg SVG has a `117.479pt x 55.526pt` viewBox. It converts
glyphs to paths, clips each node, and uses a compound stroked rectangle with
three horizontal subpaths (`butt` caps, `miter` joins). TikZKit uses per-cell
`<rect>` fills plus horizontal separator `<path>` elements and an outer stroke;
those structures differ, while the visible geometry is now equivalent.

## Verification

```bash
node --test test/shapes-multipart-vertical.test.js \
  test/shapes-multipart-align.test.js \
  test/shapes-multipart-ignore-empty.test.js
npm run extension-registry
```

The focused tests pass and the real QA source has no TikZKit diagnostics.
