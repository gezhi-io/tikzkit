# `brunnian` Trefoil Native-Reference QA (2026-08-07)

## Scope

This pass fixes one shared external-reference capability: a fixture resource
declared under a TeX package name must be available under that name inside the
temporary native MacTeX work directory. The driver is the real
`latex-examples-knot-trefoil` corpus case, which loads a local
`brunnian.sty` and uses only its `knot crossing` node shape.

This is not a claim that the complete Brunnian package is implemented. The
boundary is the trefoil's circle-derived crossing node and its scaled compass
anchors, plus reliable construction of the MacTeX reference needed to inspect
that behavior.

## Local Source Study

`kpsewhich brunnian.sty` has no global MacTeX result. The source is supplied
with the fixture at
`test/fixtures/examples/latex-examples/resources/knot-trefoil/brunnian.sty`.

Read locally:

- lines 72-75: `knot`, `thin knot`, `thick knot`, and `string` style defaults;
- lines 743-810: `knot crossing` inherits `circle`'s saved anchors, border,
  and ordinary compass anchors, then defines 2/3/4/8/16/32-scaled compass
  anchors by multiplying the inherited coordinate.

The trefoil does not call the broader `\\brunnian` macro family. It creates
crossing nodes with `knot crossing`, `transform shape`, `inner sep=1.5pt`, and
anchor names such as `16 south east`.

## Three-Way References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The inspected artifacts are outside Git:

- MacTeX PNG: `/private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07/mactex-png/latex-examples-knot-trefoil.png`;
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07/tikzkit-svg/latex-examples-knot-trefoil.svg` and `/private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07/tikzkit-png/latex-examples-knot-trefoil.png`;
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07/tikztosvg-svg/latex-examples-knot-trefoil.svg` and `/private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07/tikztosvg-png/latex-examples-knot-trefoil.png`;
- four-panel comparison sheet: `/private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07/diff/latex-examples-knot-trefoil-native-sheet.png`.

Before the change, native MacTeX failed with `File 'brunnian.sty' not found`,
so the native panel did not exist. The resource was copied only to its fixture
storage path, while `\\usepackage{brunnian}` searches its declared package name.
The materializer now preserves the source-path copy and creates a second alias
at the declared resource name.

The tikztosvg SVG is one red path under a vertical TeX-to-SVG transform, with
six cubic `C` segments and a `1.99255` stroke width. TikZKit emits the same
single trefoil path with six cubic curves. The inspected sheet now has all
three renderers: matching red trefoil loops, matching tight bounds, and the
same 2pt-class stroke. The residual diff is edge antialiasing/rasterization,
not a missing loop, node, anchor, or layer.

## Changes And Verification

- `scripts/render-example-fixtures.js`: materializes a native-reference
  resource under both its declared name and its preserved source path.
- `test/fixtures/examples/manifest.json`: assigns `brunnian.sty` only to the
  trefoil case.
- `src/packages/brunnian.js`: records the verified subset and source review.
- `src/packages/index.js`: registers that dedicated package declaration.
- `test/example-render-script.test.js` and `test/example-fixtures.test.js`:
  protect the aliasing and resource ownership behavior.

```bash
node --test --test-name-pattern='(knot-trefoil declares|native MacTeX references materialize)' \
  test/example-fixtures.test.js test/example-render-script.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only latex-examples-knot-trefoil \
  --output /private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 60000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-brunnian-trefoil-after-2026-08-07 \
  --register --alignment-radius 3
npm run extension-registry
```

The focused tests pass. The rendered case reports no TikZKit diagnostics and
produces all three SVG/PNG references plus the native comparison sheet.

## Remaining Work

The current `brunnian` status is intentionally `partial`: its high-level knot
construction macros, foreground/background layer choreography, and over/under
crossing semantics still need separate real-case visual drivers. A future
slice should target one of those macro families rather than broadening this
resource-materialization fix.
