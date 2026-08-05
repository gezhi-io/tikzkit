# PGFPlots 3D Axis Bounds And Scaled Tick Labels

## Scope

This slice fixes one shared PGFPlots 3D layout rule: an explicit-width,
perspective 3D axis must not reserve vertical space twice for a scaled z tick
label such as `10^10`.

The real drivers are:

- `test/fixtures/examples/latex-examples/3d-cmos-loss-diagram.tex`;
- `test/fixtures/examples/latex-examples/3d-gradient-cos.tex`.

The boundary is deliberately narrow. It changes no surface sampling, colour
mapping, grid construction, quiver geometry, arrow rendering, or 3D
projection formula. Although both drivers load `patchplots`, their actual
`patch` commands are commented out, so this does **not** claim `patchplots`
compatibility.

## Local MacTeX Study

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`:

- the `every 3d description` defaults (around lines 912-918) place x/y labels
  through `ticklabel cs:0.5` and `anchor=near ticklabel`;
- the 3D tick-label edge selection algorithm (around lines 8387-8516) chooses
  an outside projected-box edge from the current view and label position;
- the standard description/tick layout is based on the real text node, not a
  second synthetic copy of its extent.

The implementation therefore keeps the actual SVG text multiplier in bounds
calculation and removes only TikZKit's redundant 3D `top` reserve.

## Third-Party Reference And Artifacts

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`.

The complete, inspected artifacts are kept under `/private/tmp`:

- before: `/private/tmp/tikzkit-qa-pgfplots-3d-axis-current/`;
- after: `/private/tmp/tikzkit-qa-pgfplots-3d-axis-after/`.

Each root contains `mactex-png/`, `tikzkit-svg/`, `tikzkit-png/`,
`tikztosvg-svg/`, `tikztosvg-png/`, and `diff/`. Inspected sheets include:

- `diff/latex-examples-3d-cmos-loss-diagram-native-sheet.png`;
- `diff/latex-examples-3d-gradient-cos-native-sheet.png`;
- the matching `diff-png/` panels.

`tikztosvg` represents the diagram with outlined glyph paths under a global
Y-flip transform. TikZKit emits SVG `text` nodes with browser font metrics.
Their raw SVG path data and viewBox arithmetic cannot be byte-identical, so
the acceptance check is the visible projected frame, grid, labels, surface,
and clipping rather than a source-string comparison.

## Visual Result

### `3d-cmos-loss-diagram`

Before the correction, TikZKit's canvas was **587x484px** while tikztosvg was
**587x464px**. The actual surface, logarithmic y ticks, projected 3D box,
axis labels, and `10^10` multiplier were already present, but a visibly empty
top band made the JavaScript output too tall.

After the correction, TikZKit is **587x472px**. The drawn content is
577x465px, versus tikztosvg 578x460px and native MacTeX 579x460px. The
surface, grid, `P_v`, `f`, `V_dd`, ticks, and multiplier remain visible; the
top gutter is gone. Pixel-diff changed ratio fell from **0.3328** to
**0.2545** and mean absolute difference from **0.0311** to **0.0237**.

### `3d-gradient-cos`

This control case remains visually intact: the orange surface, blue quiver
arrows, projected grid, box, ticks, and labels stay in the same positions.
Its 540x442px TikZKit canvas versus tikztosvg's 532x443px was unchanged,
which confirms the focused fix did not perturb an unscaled-z 3D driver.

Residual differences are expected browser-versus-TeX text metrics, mesh-line
anti-aliasing, and a small per-view projection/bounds calibration gap. No
element is missing or newly displaced in either inspected panel.

## Implementation

- `src/pgfplots/geometry.js`: `axisContainerMargin` now leaves the 3D top
  margin at zero because the scale multiplier already contributes a measured
  SVG paint bound.
- `test/pgfplots-seams.test.js`: updates the calibrated 3D margin assertions
  and adds a regression for a scaled z tick label.
- `src/packages/pgfplots.js`: records the shared implementation entry and
  its reviewed, partial compatibility boundary for the extension registry.

## Verification

```bash
node --test --test-name-pattern='3d log axes discard zero samples|explicit perspective 3D axes|scaled 3D z ticks|perspective 3D geometry' test/pgfplots-seams.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplots-3d-axis-after \
  --only latex-examples-3d-cmos-loss-diagram,latex-examples-3d-gradient-cos \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pgfplots-3d-axis-after
npm run extension-registry
```

The focused regression passes 4/4. Rendering produced all three reference
families for both drivers with no missing artifact. The final gallery audit
passes: `fixture-core 266/266 rendered, 0 diagnostics`.

## Remaining Work

- Calibrate the remaining 5px CMOS drawn-content height difference for the
  affected perspective view without adding case-specific constants.
- Audit more `view={azimuth}{elevation}` combinations against the native
  projected tick-label-edge selection algorithm.
- Implement `pgfplotslibrary patchplots` only after selecting a real driver
  with active `patch` statements; it remains unsupported.
