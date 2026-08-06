# `shapes.multipart`: Empty-Part Height And Depth QA

## Scope

This focused slice corrects the TeX box metrics for empty cells in a horizontal
`rectangle split`. It covers one explicit setting for each of these keys:

- `rectangle split empty part width=<length>`
- `rectangle split empty part height=<length>`
- `rectangle split empty part depth=<length>`
- `rectangle split part align={base,center,top}`
- bare part anchors such as `(parts.two)` and `(parts.three)`

The driver is
`test/fixtures/examples/workbench/rectangle-split-empty-metrics.tex`. It is a
minimal real-PGF-manual case, rather than a hard-coded adaptation of a gallery
image: an empty middle part has `width=2pt`, `height=3ex`, and `depth=2ex`,
then exposes its nodepart anchors through red and blue arrows.

## Local MacTeX Reading

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`

The key definitions append `\\vrule`s to the empty part box. Consequently,
successive width rules are adjacent and accumulate horizontally. Height and
depth rules have zero width; TeX's hbox keeps the maximum height and maximum
depth across them. The documented defaults are `1ex` height, `0ex` depth, and
`1ex` width. The horizontal layout then uses the per-part height/depth for its
`center`, `top`, `bottom`, and `base` origins.

Before this change TikZKit correctly accumulated width, but also added heights
and discarded depth. In the real driver it produced an empty cell of `23.89pt`
instead of the native `28.19pt` (`3ex + 2ex + 2*inner ysep`), so its box and
anchors were visibly too short.

## Implementation

`src/engine/evaluate.js:rectangleSplitLayout` now preserves the separate
empty-box dimensions:

- width: default and explicit rules accumulate, as in PGF;
- height: `max(1ex, explicit height)`;
- depth: `max(0ex, explicit depth)`;
- total cell height: `height + depth + 2*inner ysep`;
- baseline and anchor geometry use the retained height/depth pair.

This is shared layout behavior. No source-case coordinates, SVG offsets, or
special B-tree values were added.

Not implemented in this slice:

- repeated applications of the same empty-part key, whose additional rule
  sequence must be retained by the option parser;
- `rectangle split every empty part`, `rectangle split draw splits`, and other
  low-level multipart hooks;
- circle split and the remaining multipart shape families;
- exact native glyph outlines and arbitrary TeX macro text metrics.

## Visual Evidence

Artifacts are ignored but retained locally:

- before: `outputs/qa-multipart-empty-metrics-before-2026-08-06/`
- after: `outputs/qa-multipart-empty-metrics-after-2026-08-06/`

Each directory contains MacTeX native PNG, TikZKit JS SVG/PNG, tikztosvg
SVG/PNG, 1cm-grid SVG/PNG variants, and comparison/diff sheets. The inspected
after sheets are:

- `diff/pgf-rectangle-split-empty-metrics-sheet.png` (TikZKit/tikztosvg/diff)
- `diff/pgf-rectangle-split-empty-metrics-native-sheet.png` (TikZKit/MacTeX,
  tikztosvg/MacTeX, diff)

Before, the TikZKit node rectangle was visibly about six raster pixels shorter
than the third-party/native node, and both exposed anchor arrows started from
the compressed vertical range. After, the TikZKit panel is 68px high against
the 69px tikztosvg reference: the outer rectangle, vertical separators, empty
cell, and red/blue nodepart-arrow origins occupy the same vertical band.

The registered TikZKit-to-tikztosvg mean absolute RGBA residual fell from
`0.0788` to `0.0473`; this is supporting evidence only. The meaningful change
is that the native `3ex` height plus `2ex` depth is now represented as a real
5ex TeX box instead of a 4ex-height/zero-depth approximation.

## tikztosvg SVG Reference

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; the fixture
pipeline generated its SVG and used `rsvg-convert` for PNG.

The reference SVG is `42.07pt x 51.23pt` with a `0 0 42.07 51.23` viewBox. It
uses one clipped stroked rectangle, two vertical separator segments, path-based
glyph `<use>` elements, butt caps/miter joins on the box, and round joins on
the arrow tips. TikZKit's `41.67pt x 50.94pt` SVG keeps browser `<text>` for
selectable text, separate cell `<rect>`s, separator `<path>`s, and explicit
arrow paths. The remaining roughly one-pixel boundary and glyph-raster
difference is therefore renderer/text-outline behavior, not an unmodelled
rectangle-split coordinate.

## Verification

```bash
node --test test/shapes-multipart-empty-metrics.test.js test/shapes-multipart-ignore-empty.test.js
node --test --test-name-pattern='lays out horizontal rectangle split node parts and named anchors|uses rectangle split text origins for unequal IEEE-754 fields|matches PGF horizontal split accumulation, separators, and global typewriter font|uses cmtt10 advances for a wide horizontal rectangle split|optically centers rectangle split text inside each part|renders rectangle split part fills with TikZ xcolor named colors|maps ordinal nodepart selectors and minimum size in horizontal rectangle splits' test/interpreter.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json --only pgf-rectangle-split-empty-metrics --native-reference --comparison-grid-mode svg --strict-tikztosvg --output outputs/qa-multipart-empty-metrics-after-2026-08-06
npm run examples:diff -- --output outputs/qa-multipart-empty-metrics-after-2026-08-06 --register --alignment-radius 3
npm run gallery:audit
npm run extension-registry
```

Focused multipart tests pass. `gallery:audit` reports `275/275 rendered, 0
diagnostics`. A standalone full `test/interpreter.test.js` run still has
pre-existing failures outside this slice (colour normalization, coordinate
systems, and a circuitikz case); the filtered multipart assertions all pass.

## Acceptance

Accepted for the documented empty-part width/height/depth family. The
`shapes.multipart` registry entry remains `partial` because the unimplemented
hooks and multipart shapes above are real PGF surface area, not cosmetic gaps.
