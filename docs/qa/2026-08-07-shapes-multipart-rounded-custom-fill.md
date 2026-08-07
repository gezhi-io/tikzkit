# QA: shapes.multipart rounded custom fill

## Scope

This slice implements the outer-corner geometry of `rectangle split part fill`
when a rectangle split node has `rounded corners`. It covers both vertical and
`rectangle split horizontal` layouts. The boundary is intentionally narrow:
the change only controls the backgrounds of rectangle-split parts and the
ordinary rectangle-split background fill.

## Local PGF Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`, custom-fill `behindbackgroundpath` around lines 1039-1189.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`.

PGF paints each part independently in `behindbackgroundpath`. At an internal
part boundary it temporarily calls `\pgfsetcornersarced{\pgfpointorigin}`,
so the join remains square; only corners which touch the outer node boundary
inherit the configured rounded-corner radius. The normal `backgroundpath`
then paints the outer border and separators.

## Third-Party SVG Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`. Both references and native MacTeX
completed successfully for the fixture
`pgf-rectangle-split-rounded-custom-fill`.

Artifacts:

- Before: `/private/tmp/tikzkit-qa-rectangle-split-rounded-custom-fill-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-rectangle-split-rounded-custom-fill-after-2026-08-07/`
- Fixture: `test/fixtures/examples/workbench/rectangle-split-rounded-custom-fill.tex`

The `tikztosvg` SVG uses three distinct fill paths for each split node. Its
outer paths follow the rounded node boundary while the middle path is a plain
rectangle; the SVG also retains separate straight separator paths and a
rounded outer border.

## Visual Result

Before the change, TikZKit emitted one full rectangular `<rect>` for every
custom-filled part. At a rounded outer corner, the color could extend into the
corner outside the border curve. After the change, TikZKit emits one SVG path
per custom-filled part: the first/last vertical parts own the top/bottom
outer arcs, the first/last horizontal parts own the left/right outer arcs,
and every internal edge stays square.

The rendered JS, tikztosvg, MacTeX, and diff panels were inspected. The
visible rounded color boundary is now shared by the two reference panels and
TikZKit. The remaining difference is small text rasterization and a 5px/4px
canvas dimension difference, not an incorrectly colored rounded corner.

Registered MacTeX comparison changed from `3086` changed pixels and
`0.03676` mean absolute RGBA to `2923` and `0.03571`. Registered tikztosvg
comparison changed from `3153` / `0.02957` to `2988` / `0.02836`.

## Implementation And Verification

Changed:

- `src/renderers/svg/rectangleSplitNodes.js`
- `src/tikz/libraries/shapes.multipart.js`
- `test/shapes-multipart-rounded-custom-fill.test.js`
- `test/fixtures/examples/workbench/rectangle-split-rounded-custom-fill.tex`
- `test/fixtures/examples/manifest.json`

Commands:

```bash
node --test test/shapes-multipart-rounded-custom-fill.test.js \
  test/shapes-multipart-custom-fill.test.js \
  test/shapes-multipart-draw-splits.test.js \
  test/shapes-multipart-horizontal-minimums.test.js \
  test/shapes-multipart-vertical.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only pgf-rectangle-split-rounded-custom-fill \
  --output /private/tmp/tikzkit-qa-rectangle-split-rounded-custom-fill-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-rectangle-split-rounded-custom-fill-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused tests pass and the fixture has no diagnostics.

## Remaining Limits

This does not implement arbitrary multipart shapes, repeated empty-part key
accumulation, or full TeX node metric parity. SVG text rasterization and
reference crop dimensions remain separate calibration work.
