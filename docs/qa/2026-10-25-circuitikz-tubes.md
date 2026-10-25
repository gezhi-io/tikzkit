# Native Circuitikz Tube Geometry

## Scope and Status

This pass covers the standard diode, triode, tetrode and pentode tube family.
Circuitikz is still partial. The real case-1041 triode amplifier exposed a
wrong circular enclosure, vertical grid, right-side cathode and incorrect
component stroke width. The shared geometry is now source-derived; the complete
amplifier is **not visually complete** because other components and annotations
still differ.

Three focused browser fixtures pass fixed-physical-scale stroke checks against
local tikztosvg in default and SVG-text modes. Four cases have MacTeX, tikztosvg,
JS and browser artifacts. The full suite changes from 25 to 24 failures with no
newly failing names. No npm login, publication, version change or remote push
was attempted. Changes are saved as a local checkpoint only.

## Local Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

- `tex/latex/circuitikz/circuitikz.sty`: the installed Circuitikz 1.8.3 loader
  delegates drawing to TikZ and the generic component declarations.
- `tex/generic/circuitikz/pgfcirctripoles.tex`, lines 8355-8387: tube dimensions,
  electrode settings and one-shot filament/cathode flags.
- The same file, lines 8552-8647: six border pieces, their traversal order and
  the `0`/`1`/`2` absent/solid/dashed states. The default dash is a physical
  `2pt`/`2pt` pair, not a multiple of component line width.
- Lines 8648-8704: actual circular capsule ends, anode width/distance, the left
  cathode terminal, rounded cathode corners and short right-hand leg.
- Lines 8708-8890: tube-class scale times Rlen, saved half-dimensions, filament
  geometry, body bounds and class-relative stroke width.
- Lines 8890-9050: the standard grid levels and grid anchors. Electrode geometry
  is saved with the shape, but grid shift/separation are read at anchor lookup.
  A node-local grid separation therefore does not survive outside its group;
  later `\ctikzset` values can move a grid anchor without repainting the node.
- `tex/generic/circuitikz/pgfcirc.defines.tex`, lines 533-547: tube thickness
  multiplies the current TikZ line width and falls back to `tripoles/thickness`
  when the tube-class value is `none`.

The implementation retains these native distinctions instead of applying a
visual offset to the amplifier or its named coordinates.

## Commands and Parameters

The fixtures use `\usepackage{circuitikz}`, `\ctikzset`, `\begin{circuitikz}`,
`\node`, `\draw`, `\coordinate`, named terminals, relative coordinates,
`to[...]`, standard colors and math labels. The amplifier additionally exercises
existing `R`, `C`, `sV`, `V`, `short`, `open`, labels, terminal dots and `calc`.
Those surrounding component families are controls, not newly completed here.

The bounded tube implementation covers:

- `diodetube`, `triode`, `tetrode`, `pentode` and their shared capsule outline.
- `tubes/scale`, `width`, `height`, `tube radius`, `anode distance`, `anode width`,
  `grid protrusion`, `grid dashes`, `grid separation`, `grid shift`,
  `cathode distance`, `cathode width`, `cathode corners`, `cathode right extend`,
  `filament distance` and `filament angle` under the `tubes/` directory.
- Tube fill and thickness, the legacy tripole-thickness fallback, local
  `filament`, `nocathode`, `fullcathode`, and six-piece `partial borders` with
  `partial border dash`. The custom dash fixture uses `{{3pt}{1pt}}`.
- Saved anode/cathode/filament/body anchors and live grid/control/screen/
  suppressor lookup. Semantic tests independently check left cathodes and the
  tetrode's half-separation grid levels.

Browser controls cover default and unequal dimensions, class scale/thickness,
local electrode settings, partial borders, local filament/cathode flags and
live key changes. They do not certify every combination of the listed options.
Global one-shot tube flags, custom tube definitions, arbitrary transforms,
nondefault Rlen, numeric-angle border anchors and arbitrary text anchors remain
outside this acceptance scope.

## Implementation

- `src/extensions/circuitikz/tubes.js` owns renderer-neutral outline, electrode,
  terminal and bounds geometry. Capsule ends and cathode corners use PGF cubic
  quarter circles; grids use the native explicit segment lengths.
- `src/engine/evaluate.js` resolves settings and native class thickness, shares
  geometry across all four tube types and distinguishes saved dimensions from
  live grid anchors. It no longer caches a stale grid key as a permanent point.
- `src/renderers/svg/circuitikzNodes.js` renders the shared geometry, including
  physical partial-border dashes. `bounds.js` uses that same geometry.
- `scripts/browser-tube-metrics.js` compares actual browser stroke geometry and
  styles. `audit-circuitikz-tubes.js` runs the three tube controls.
- Focused semantic and metric tests supplement the existing amplifier test.
  Package metadata and the Circuitikz registry row remain marked partial.

## Native and Browser Evidence

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg`, version 0.3.0.
References use local `pdflatex`; SVGs are rasterized with `rsvg-convert`, and
MacTeX PDF-to-PNG output is generated separately. No installation was needed.

Native SVG inspection confirms cubic capsule paths, explicit grid segments,
butt caps, miter joins, y-reversing transforms and a default component stroke of
approximately 0.797bp (0.8 TeX pt). Default partial dashes are approximately
1.99255bp each; custom 3pt/1pt dashes become 2.98883bp/0.99628bp. Geometry does
not use arrow markers or foreignObject; native text uses outline glyphs with
`use`. JS keeps browser-rendered SVG, not a reference-image substitution.

Artifacts are local and ignored by Git:

- Before: `outputs/qa/2026-10-25-circuitikz-tubes-before/`
- After: `outputs/qa/2026-10-25-circuitikz-tubes-after/`
- Actual browser comparison: `outputs/qa/2026-10-25-circuitikz-tubes-after/browser-audit.html`
- Stroke measurements: `outputs/qa/2026-10-25-circuitikz-tubes-after/tube-stroke-metrics.json`
- 3D controls: `outputs/qa/2026-10-25-circuitikz-tubes-3d-controls/`

Each final fixture has `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
`tikztosvg-png/`, `mactex-png/` and browser sheets/diffs. All four final MacTeX
images and browser sheets were inspected. The filament fixture was added while
investigating live anchor semantics, so it has no before capture.

| Case | Visible change | Maximum sampled stroke error at 3x |
| --- | --- | --- |
| Tube catalog | Correct capsule ends, horizontal triode grid, left cathode, grid spans and tetrode anchors | 0.0788px |
| Tube settings | Unequal dimensions and scale, native electrode spacing, partial dashes and live grid-anchor leads | 0.0786px |
| Tube filaments | Local V-shaped filaments, absent/full cathodes, custom dash lengths and post-node grid-key lookup | 0.0775px |
| Triode amplifier | Correct tube body, horizontal grid and left cathode connection | Whole-diagram acceptance not passed |

The stroke gate samples all stroked paths in both directions at intervals no
larger than 0.08 CSS px and uses a 0.12px acceptance limit. A single translation
from independent red terminal leads aligns the captures at fixed 3x physical
scale; no scale fitting or per-component offsets are applied. Native and JS
subpath grouping may differ. Color, cap, join, stroke width and dash lengths
must agree; there are zero unmatched samples and zero style errors. This gate
does not certify fill colors, text, layering or pixel identity.

The amplifier still has visibly different capacitor plate sizes, input-voltage
arrow direction, source internals and annotation placement. MacTeX and
tikztosvg agree on those residuals. Its improved tube is not a claim of complete
Circuitikz or whole-case fidelity. All four JS cases have zero diagnostics and
the browser audit records no errors.

Seven 3D controls retain their existing 0.35px geometry acceptance for ticks,
grids, glyph origins, projected frames and canvas bounds in both JS modes.
Hypersurface, clipped and unclipped browser sheets were inspected again. The
combined audit intentionally still fails its existing explicit-metadata color
gate: JS `[128,128,255]`, native `[127,127,255]`. No threshold was relaxed.

## Reproduction and Tests

```sh
node --test test/circuitikz-tubes.test.js test/browser-tube-metrics.test.js test/circuitikz-transformer-core.test.js
node --test --test-reporter=./scripts/module-test-reporter.js \
  --test-reporter-destination=outputs/qa/2026-10-25-circuitikz-tubes-after/test-final.json \
  test/*.test.js
npm run check:architecture
npm run docs:links
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/circuitikz-tubes \
  --output outputs/qa/2026-10-25-circuitikz-tubes-after \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js \
  --fixtures test/fixtures/circuitikz-tubes \
  --output outputs/qa/2026-10-25-circuitikz-tubes-after \
  --before outputs/qa/2026-10-25-circuitikz-tubes-before \
  --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/audit-circuitikz-tubes.js \
  --output outputs/qa/2026-10-25-circuitikz-tubes-after \
  --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
```

Focused tests: 13/13 pass. Full suite: 3077 tests, 3039 pass, 24 fail, 14 skip,
no cancellations. Baseline: 3068 tests, 3029 pass, 25 fail, 14 skip.
The resolved failure is `renders circuitikz triode amplifier components used by
case 1041`: its old count incorrectly classified the already-distinct sinusoidal
source as a DC source. The test now asserts one of each and the native left
cathode. The failure-count reduction includes that classifier correction; the
separate source-derived tests and browser evidence prove the production geometry
change, not a weakened assertion alone.

## Remaining Work

Keep the 24 remaining full-suite failures separate from visual completion.
The amplifier's capacitor/source/annotation residuals deserve a separate bounded
component pass. For the active 3D scope, retain the strict color failure and
investigate native colormap quantization rather than changing its expectation.
Chronology, monospace tree-edge clipping and signal-node bounds remain candidate
real-graphic failures for the next local-source-driven pass.
