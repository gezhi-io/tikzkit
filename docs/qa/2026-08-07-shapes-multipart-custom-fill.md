# `shapes.multipart`: Custom Fill Toggle QA

## Scope

This slice implements the PGF `rectangle split uses custom fill` switch for
vertical record-style nodes. It covers these shared semantics only:

- `rectangle split part fill={...}` enables per-part fills;
- a later `rectangle split uses custom fill=false` disables those part fills;
- with custom fills disabled, the ordinary node `fill=<color>` paints one
  background beneath the separators;
- normal rectangle splits without a part-fill list use the same ordinary node
  background rule.

The visual driver is
`test/fixtures/examples/workbench/rectangle-split-custom-fill.tex`. It makes
the state change visible with three realistic record boxes: a colored header /
payload / checksum box, the same box explicitly restored to yellow as one
background, and a plain gray record box. Its `two east` anchors also verify
that the paint change does not move part geometry.

## Local MacTeX Reading

Reviewed locally on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`

The source declares the actual boolean key as
`rectangle split uses custom fill`. The part-fill key stores its color list and
sets that boolean true. The `behindbackgroundpath` handler consults the boolean
before constructing any part rectangles; when false, ordinary TikZ node
background painting remains responsible for the fill. This explains why the
renderer must not infer custom fill solely from the presence of a color list.

The manual documents the intent of this switch and requires callers to avoid a
background `fill` only while custom part fills are active. The source spelling
is used for compatibility.

## Third-Party SVG Reference

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`, with
`/opt/homebrew/bin/rsvg-convert` used for PNG output. Artifacts are in:

- before: `/private/tmp/tikzkit-qa-rectangle-split-custom-fill-before-2026-08-07/`
- after: `/private/tmp/tikzkit-qa-rectangle-split-custom-fill-after-2026-08-07/`

Each directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, local MacTeX PNG,
1cm-grid variants, registered diffs, and comparison sheets. `tikztosvg` uses
filled path geometry plus glyph `<use>` instances, while TikZKit emits named
background/part `<rect>` elements and browser text. The relevant semantic
comparison is the paint ordering: both references retain per-cell color only
for the first record and a single yellow or gray background for the latter
two.

## Visual Change

Inspected before and after native sheets:

- before: `diff/pgf-rectangle-split-custom-fill-native-sheet.png`
- after: `diff/pgf-rectangle-split-custom-fill-native-sheet.png`

Before, TikZKit painted the fallback record red/green/blue despite its explicit
`uses custom fill=false`; it also left the plain `fill=gray!15` record white.
MacTeX and tikztosvg painted those records uniformly yellow and gray.

After, the colored record remains split red/green/blue, while the fallback and
plain record panels visibly use one yellow and one gray background beneath the
same separators. The colored anchor arrows stay attached to the second-part
east anchors. TikZKit/MacTeX changed pixels fell from `0.5020` to `0.2120` and
mean absolute RGBA fell from `0.07793` to `0.05453`; the remaining difference
is chiefly text rasterization and a 5px by 4px canvas-size gap rather than
missing or wrongly colored shapes.

## Implementation And Verification

Changed:

- `src/engine/evaluate.js`: preserves the source-order custom-fill boolean in
  the rectangle-split scene item.
- `src/renderers/svg/rectangleSplitNodes.js`: paints per-part rectangles only
  while custom fill is enabled, otherwise emits the regular node background
  before separators and border.
- `test/shapes-multipart-custom-fill.test.js`: regression for color-list
  enablement, explicit disablement, normal background fill, and SVG structure.
- `test/shapes-multipart-draw-splits.test.js`: updates the renderer assertion
  to PGF's non-custom background structure.
- `test/fixtures/examples/workbench/rectangle-split-custom-fill.tex`: visual
  regression driver and manifest case.

Verified with:

```bash
node --test test/shapes-multipart-custom-fill.test.js \
  test/shapes-multipart-draw-splits.test.js \
  test/shapes-multipart-vertical.test.js \
  test/shapes-multipart-horizontal-minimums.test.js \
  test/shapes-multipart-empty-metrics.test.js \
  test/shapes-multipart-align.test.js \
  test/shapes-multipart-ignore-empty.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only pgf-rectangle-split-custom-fill \
  --output /private/tmp/tikzkit-qa-rectangle-split-custom-fill-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-rectangle-split-custom-fill-after-2026-08-07 \
  --register --alignment-radius 3
```

## Remaining Limits

`shapes.multipart` remains partial. The renderer still does not model rounded
corner clipping for individual custom-fill regions, repeated low-level
`rectangle split every empty part` rule accumulation, arbitrary multipart
shapes, or exact TeX box metrics for all rich content. A useful next slice is
rounded-corner custom fills or `circle split` paint ordering, selected only
after another MacTeX/tikztosvg visual baseline.
