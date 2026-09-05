# CircuitikZ waveform source dimensions

## Scope

- Library: `circuitikz` (registry status remains `partial`; 23 registered gallery cases after this slice).
- Slice: independent square and triangle voltage sources only.
- Accepted commands and aliases: `sqV`, `vsourcesquare`, `square voltage source`, `tV`, `vsourcetri`, and `triangle voltage source`.
- Accepted settings: `bipoles/vsourcesquare/width|height`, `bipoles/vsourcetri/width|height`, `sources/scale`, `sources/fill`, and local `fill`.
- State boundary: document-scope `\ctikzset` initializes each picture, an in-picture `\ctikzset` overrides later components, and an in-picture override does not leak into the next picture.

This was selected because the package is high-frequency and partial, and every non-square setting was visibly ignored: the browser renderer always drew a fixed circle. The slice does not claim the wider source catalog or component-label spacing.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`, lines 1928-1943, defines independent `.60` width and height defaults.
- The same file, lines 2409-2455, declares each body through `\pgfcircdeclarebipolescaled{sources}`, paints an ellipse with separate `res@left` and `res@up`, halves the normal radius, and draws the square or triangle waveform as an open path.
- The same file, lines 3855-3872, defines the six public aliases covered here. There are no controlled square/triangle aliases in the installed CircuitikZ 1.8.3 source.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirc.defines.tex`, lines 694-798, computes half-width and half-height as `key * class scale * Rlen / 2`; `Rlen` is 1.4 cm for these fixtures.
- The same file, lines 473-490 and 1054-1064, shows that explicit fill wins over the `sources/fill` class default and that only the outer body is filled.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`, lines 1676-1702 and 3024-3025, documents source-class fill and the square/triangle public names.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`
- Before, from commit `b2893bc4` with the exact current fixture sources: `outputs/qa/2026-09-05-circuitikz-waveform-dimensions-before-v2/`
- After: `outputs/qa/2026-09-05-circuitikz-waveform-dimensions-after/`
- The after directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, diff PNG, and two comparison sheets for each fixture.

The tikztosvg SVGs use transformed elliptical paths for the source body with nonzero fill, butt caps, and miter joins. Their waveform paths are separate `fill="none"` paths. TikZKit now emits the same body/wave layering and rotates the along/normal radii with the circuit path instead of relying on an axis-aligned circle.

## Visual review

- `algorithm`: before, all three wide square sources were fixed circles and ignored the cyan source fill. After, they are wide, shallow, cyan-filled ellipses with open square waves and lead gaps matching the body width. The remaining mismatch is mostly label-arrow placement and text bounds.
- `math`: before, the tall square source and wide triangle source were both circles. After, the square source is tall and narrow, the triangle source is wide and shallow, both compose with `sources/scale=1.15`, and their interior waves use the normal radius. Residual differences are text/label placement.
- `physics`: before, both vertical sources were unfilled circles. After, the pulse source is tall and the ramp source is shorter and wider, both use the orange class fill, and the vertical leads stop at the native along radius. The source geometry is visibly aligned; component labels remain a separate CircuitikZ compatibility issue.

As an auxiliary signal, TikZKit-versus-tikztosvg changed-pixel ratios moved from 12.54% to 11.37% (`algorithm`), 11.47% to 8.67% (`math`), and 15.03% to 2.90% (`physics`). Acceptance is based on the inspected panels above, not these numbers alone.

## Implementation and tests

- `src/frontend/parser.js`: collects document-scope `\ctikzset` state while excluding earlier picture bodies.
- `src/engine/evaluate.js`: resolves source dimensions/fill, splits leads at the configured width, emits rotated elliptical bodies, and keeps open waveforms unfilled.
- `test/circuitikz-waveform-source-dimensions.test.js`: seven focused assertions covering dimensions, scale, rotation, fill isolation, global/local scope, aliases, and three domain fixtures.
- `test/fixtures/examples/circuitikz/waveform-source-dimensions/`: algorithm, mathematics, and physics fixtures.

Commands:

```sh
node --test test/circuitikz-waveform-source-dimensions.test.js
node --test test/circuitikz*.test.js
npm run extension-registry
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-circuitikz-waveform-dimensions-after --only circuitikz-waveform-dimensions-algorithm --only circuitikz-waveform-dimensions-math --only circuitikz-waveform-dimensions-physics --native-reference --strict-tikztosvg --continue-on-external-failure --quiet-progress
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-circuitikz-waveform-dimensions-after
```

Focused result: 7/7 pass. CircuitikZ family result: 40 pass, 0 fail, 2 skipped because the optional `work/circuitikz` corpus is absent. All three real fixtures have zero TikZKit diagnostics; tikztosvg and MacTeX both rendered 3/3 without external failures.

Full regression result: 2446 total, 2303 pass, 129 known failures, and 14 skipped. The previous baseline was 2439 total, 2296 pass, 129 failures, and 14 skipped, so this slice adds seven passing tests without increasing failures or skips.

## Remaining work

- CircuitikZ component labels, especially `l_=` on vertical paths, still have missing or inaccurate placement in the physics panel.
- Other independent-source width/height keys and controlled-source custom dimensions remain outside this slice.
- Source anchors and arbitrary custom source shapes are still partial.
