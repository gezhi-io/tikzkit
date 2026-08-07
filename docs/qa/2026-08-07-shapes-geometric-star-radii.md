# Shapes.Geometric Star Radii

## Scope

This pass implements the shared `star` geometry slice: `star points`,
`star point ratio`, `star point height`, `minimum width`, `minimum height`,
`minimum size`, and `star rotate`. It deliberately does not claim all star
anchors or all concave-shape border behavior.

The driver is the existing real core case
`test/fixtures/examples/arrows/shape-curved-terminal-padding.tex`. It combines
a labeled five-point star, `star point ratio=1.8`, `minimum size=1.8cm`, and
thick curves terminating on the star. This makes a star-size correction move
both painted vertices and ordinary path endpoints, rather than only changing
an isolated unit test.

## Local PGF Reading

Reviewed on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`, the `star` keys and `calculateradii` macro;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, star key descriptions and examples.

PGF first takes the larger content half-dimension, including the corresponding
inner separation. The inner radius is `sqrt(2)` times that value. The outer
radius is then inner radius times `star point ratio`, or inner radius plus
`star point height`. The largest minimum width, height, or size applies to the
outer diameter; when it enlarges a ratio star, the inner radius grows with the
same ratio, while point-height stars retain their absolute point height.
`star rotate` aliases `shape border rotate`, so it changes the initial 90-degree
outer point without rotating text.

## References And Visual Inspection

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg` and
`rsvg-convert` at `/opt/homebrew/bin/rsvg-convert`. The inspected after bundle
is `/private/tmp/tikzkit-qa-star-geometry-after-2026-08-07`:

- MacTeX PNG: `mactex-png/arrows-shape-curved-terminal-padding.png`;
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`;
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`;
- four-panel sheet: `diff/arrows-shape-curved-terminal-padding-native-sheet.png`.

I inspected the native, tikztosvg, TikZKit, and diff panels. The prior JS star
was visibly too large because the generic minimum box was expanded and then
multiplied by an arbitrary `1.35`. The new JS star has the native five-point
proportions and its incoming/outgoing thick arrows meet the smaller star at
the corresponding locations. The remaining visible differences are label
glyph rasterization and the wider TikZKit overall picture crop, not a missing
star or a detached arrow.

The tikztosvg SVG has an explicit ten-vertex star `path`, a flipped outer
matrix transform, `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and
ordinary filled arrowhead paths with `fill-rule="nonzero"`; it does not use
SVG marker elements. TikZKit now emits the same outer/inner alternating
geometry through its renderer-neutral star helper.

## Visible Improvement

For the driver, the TikZKit PNG changed from `333 x 282px` to `328 x 276px`;
the tikztosvg reference is `324 x 263px`. After small registration, the direct
TikZKit/tikztosvg changed-pixel ratio fell from `8.59%` to `5.98%`, and the
TikZKit/MacTeX mean absolute RGBA residual fell from `0.03593` to `0.01416`.
These values are supporting evidence only. The acceptance is based on the
visibly corrected star dimensions and connected curve endpoints in the
four-panel comparison.

## Implemented And Deferred

Implemented:

- `\node[star]`, `star points`, `star point ratio`, `star point height`,
  `minimum width`, `minimum height`, `minimum size`, `star rotate`, and
  `shape border rotate`;
- shared layout, border-clipping polygon, and SVG path vertices;
- thick terminal-arrow padding against the resulting star sides.

Deferred:

- PGF's exact outer-separation anchor radii and named `inner point n` /
  `outer point n` anchors;
- source-order semantics when both point-height and point-ratio keys occur in
  the same option list after arbitrary TeX expansion;
- arbitrary concave-shape miter rays, transforms combined with non-uniform
  node scaling, and text/bbox raster parity.

## Files And Verification

Changed implementation files:

- `src/tikz/libraries/shapes.geometric.js`;
- `src/engine/evaluate.js`;
- `src/renderers/svg/nodeShapes.js`;
- `test/interpreter.test.js`;
- `README.md` and the generated extension registry.

Passed commands:

```sh
node --check src/tikz/libraries/shapes.geometric.js
node --check src/engine/evaluate.js
node --check src/renderers/svg/nodeShapes.js
node --test --test-name-pattern='PGF star radius modes|trapezium cotangent|curved terminal arrows beyond|geometric and symbol nodes' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-star-geometry-after-2026-08-07 --only arrows-shape-curved-terminal-padding --native-reference --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-star-geometry-after-2026-08-07 --register --alignment-radius 3
npm run case:audit -- test/fixtures/examples/arrows/shape-curved-terminal-padding.tex --output docs/qa/2026-08-07-shapes-geometric-star-radii-audit.md --strict
```

This is a completed visual improvement for the defined star parameter family,
not full `shapes.geometric` compatibility. The companion semantic audit is
intentionally still `incomplete`: it inventories all seven commands, nineteen
option paths, and thirty-two numeric literals in the real driver, while this
pass verifies only the documented star-geometry subset named above.
