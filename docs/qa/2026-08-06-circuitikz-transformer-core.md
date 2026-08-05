# circuitikz transformer-core styling visual QA (2026-08-06)

## Scope

Implement one documented `circuitikz` feature family only: the
`transformer core/.cd` style directory for a `transformer core` node. The
accepted keys are `relative thickness`, `color`, and `dash` with the manual's
`default`, `none`, and zero-phase `{on}{off}` pair semantics. This does not
claim generic transformer support, adjustable coil geometry, terminal anchors,
or the rest of the quadpole catalogue.

Driver source:
`test/fixtures/examples/circuitikz/transformer-core-customization.tex`.

## Local MacTeX Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircquadpoles.tex`,
  lines 20-32: the initial transformer-core dimensions, `relative thickness`,
  `color`, and `dash` keys are declared independently of the generic
  quadpole geometry.
- The same file, lines 291-329: Circuitikz multiplies the cute-choke line
  thickness by `relative thickness`, then applies the core color/dash subset
  before stroking two vertical core paths.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 5949-5968 and 6100-6124: `color=default` inherits the component,
  `dash=default` preserves its dash setting, `dash=none` means solid, and
  other values are `\\pgfsetdash` on/off pairs. The real manual example is
  the fixture used here.

The implementation stores this as component semantics, not screen-space
coordinates: `normalizeCtikzSetOptions` understands the style directory,
`circuitikzTransformerCoreSettings` computes the shared node data, and the SVG
renderer applies it only to the core paths.

## Three-way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX used local `pdflatex`.

Artifacts are intentionally ignored by Git:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-core-2026-08-06/tikzkit-svg/circuitikz-transformer-core-customization.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-core-2026-08-06/tikztosvg-svg/circuitikz-transformer-core-customization.svg`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-core-2026-08-06/mactex-png/circuitikz-transformer-core-customization.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-core-2026-08-06/diff/circuitikz-transformer-core-customization-sheet.png`
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-circuitikz-transformer-core-2026-08-06/diff/circuitikz-transformer-core-customization-native-sheet.png`

The tikztosvg SVG has two black core paths for `A` and two red paths for `B`.
The latter have a doubled stroke width and an explicit dash sequence. TikZKit
now emits the same structure for the `B` core: `stroke=red`, a `2x` core
stroke, and `stroke-dasharray` converted from `4pt 2pt` to SVG units.

## Visual Review

Viewed the TikZKit grid panel, tikztosvg grid panel, native three-way sheet,
and registered pixel diff.

Before this change, the right transformer core was indistinguishable from the
left: black, solid, and normal thickness. After it:

- the left `A` core remains the default black, normal-width pair;
- the right `B` core is visibly red, twice as thick, and has the requested
  long-short dash cadence;
- `dash=none` has a regression test that removes an earlier core dash setting
  instead of treating `none` as another form of inheritance.

The remaining visual difference is not hidden by the accepted style slice:
TikZKit's transformer coil/lead geometry still differs slightly from the
native and tikztosvg paths. Against tikztosvg, the registered comparison has
`0.2029` changed-pixel ratio and `0.0626` mean absolute RGBA difference after
a three-pixel vertical registration. The inspected panels show that this
residual is in the body geometry, not the red dashed core styling.

## Verification

```bash
node --test test/circuitikz-transformer-core.test.js \
  test/circuitikz-batteries.test.js \
  test/circuitikz-controlled-sources.test.js \
  test/circuitikz-controlled-sinusoidal-sources.test.js \
  test/circuitikz-sinusoidal-sources.test.js \
  test/circuitikz-voltage-polarity.test.js \
  test/circuitikz-waveform-symbol-rotation.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-transformer-core-2026-08-06 \
  --only circuitikz-transformer-core-customization --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-circuitikz-transformer-core-2026-08-06 \
  --register --alignment-radius 3
```

Focused tests pass with no diagnostics. The registry remains `partial`, now
records the reviewed local source and this accepted core-styling slice.
