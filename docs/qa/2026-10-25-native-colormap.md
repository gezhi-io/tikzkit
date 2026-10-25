# Native PGFPlots Colormaps

## Scope and Status

This slice implements numeric `rgb`, `rgb255`, `gray` and `cmyk` colormap stops,
physical and implicit stop positions, and PGF's fixed-point mapped-color lookup.
It was chosen because numeric maps silently fell back to the unrelated `hot`
palette, while the existing explicit-meta browser color check failed by one
byte. PGFPlots remains **partial**, not fully implemented or pixel-identical.

No npm login, publication, version change or remote push was attempted.

## Local Implementation References

Files are under `/usr/local/texlive/2025/texmf-dist/`:

- `tex/generic/pgfplots/util/pgfplotscolormap.code.tex`: map creation, implicit
  spacing and nonuniform positions; lines 2094-2240 transform metadata into
  `[0,1000]`, choose the interval and interpolate its components. Uniform maps
  store an inverse interval in a TeX dimension. A two-stop inverse interval
  of `0.001` is therefore not an exact JavaScript decimal.
- `tex/generic/pgfplots/util/pgfplotscolor.code.tex`: numeric component parsing,
  first-stop color-space selection, RGB255 scaling by `0.003921568`, and
  lines 587-637 implementing two weighted dimension additions. CMYK components
  must survive interpolation before conversion to display RGB.
- `tex/generic/pgf/libraries/pgflibraryfpu.code.tex`: finite multiplication and
  division normalize mantissas before restoring their decimal exponents.
- `tex/generic/pgf/math/pgfmathfunctions.basic.code.tex`: fixed-point multiply
  and divide used during interval lookup.
- The registry identifies the installed entry point
  `tex/latex/pgfplots/pgfplots.sty` and manual
  `doc/latex/pgfplots/pgfplots.pdf`; implementation decisions above come from
  the installed source rather than fitted colors.

`test/fixtures/pgfplots-native-colormap/metrics.ltx` independently prints native
channel values. For example, white-to-blue at the midpoint of `[0,1000]` is
`(0.49646,0.49646,1)`, not `(0.5,0.5,1)`. Its unit-range hot, narrow-metadata,
CMYK and real quadratic-surface probes also explain the updated test values.
Existing geometry, facet-count, clipping and label assertions were retained.

## Commands and Options Covered

| Feature | This slice |
| --- | --- |
| `\usepackage{pgfplots}`, `\pgfplotsset`, `tikzpicture`, `axis`, `\addplot3` | Existing parsing and rendering retained |
| `colormap={name}{...}`, `colormap name=name` | Shared parser and lookup |
| `color(...)=(named color or mix)` | Retains existing named-color handling |
| `rgb`, `rgb255`, `gray`, `cmyk` numeric stops | Added typed component preservation |
| Stop positions in `cm`, `mm`, `pt`, `bp`, `in` | Common physical coordinates; bare dimensions are points |
| Omitted stop positions | Starts at zero; defaults to 1cm spacing, then the smallest preceding interval |
| Nonuniform positions | Local interval lookup instead of evenly spaced interpolation |
| `surf`, `shader=flat`, `shader=flat corner`, built-in `hot` and `viridis` | Existing surfaces consume the same source-derived color lookup |
| `point meta min`, `point meta max`, implicit/logarithmic z metadata | Retain existing survey semantics; mapped colors use native arithmetic |
| `width`, `height`, `view`, domain/samples, ticks/grid/labels, `colorbar style` | Regression controls, not newly claimed general support |

## Visual Evidence

`command -v tikztosvg` resolved to `/Library/TeX/texbin/tikztosvg`. References
were generated locally with `pdflatex`; the fixture runner converts their SVGs
to PNG with `rsvg-convert` and separately generates native MacTeX PNGs. There
was no network installation and no substitution of reference SVG for JS output.

Artifacts:

- Before: `outputs/qa/2026-10-25-native-colormap-before/`.
- After: `outputs/qa/2026-10-25-native-colormap-after/`.
- Seven 3D controls: `outputs/qa/2026-10-25-native-colormap-3d-controls/`.
- Each output has `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
  `tikztosvg-png/`, `mactex-png/`, and actual Chrome captures under `browser/`.
- `browser-audit.html` shows default browser JS, local tikztosvg, SVG-text and
  available before captures; sheets and diffs are adjacent. Browser JSON keeps
  geometry, font readiness, computed paint and diagnostics separately.

The native SVGs use closed linear face paths with fractional percentage fills,
separate facet strokes, coordinate transforms and glyph paths in definitions.
They do not use browser text layout or `foreignObject` for these labels. JS
keeps its actual browser font rendering; the audit compares measured glyph
origins, frame dimensions and every requested surface face, not just pixels.

| Case | Observed change |
| --- | --- |
| RGB255 heightmap | Incorrect default rainbow replaced by the requested muted blue/yellow/red surface; all 64 facet colors match native computed RGB |
| Nonuniform RGB plane | Missing green transition restored at the specified knot, with the longer green-to-red interval preserved; two channels retain a one-byte difference |
| Implicit gray stops | Incorrect colored plane becomes the native black/gray/white plane |
| CMYK stops | Incorrect hot palette becomes the native cyan-to-black plane, including its display color conversion |
| Explicit metadata | The pre-existing strict color gate changes from failing to passing without altering its expected color or tolerance |
| Real `3d-function-2` quadratic surface | Mesh, axes, labels and orange colorbar remain visually aligned; first-face color follows the independently compiled native SVG rather than ideal float interpolation |

Native PNGs and browser sheets/diffs were inspected, including RGB, gray,
nonuniform, CMYK, explicit-meta, quadratic, clipped and logarithmic controls.
No missing faces or newly displaced axis labels were seen. Thin edge/text
residuals remain in the diff, as do the recorded subpixel geometry differences.
This is not a claim of pixel identity.

All six color cases pass the unchanged 0.35px browser geometry gate with zero
diagnostics. The five facet-color controls cover **89 faces**, all within the
one-byte color limit and at most 0.116px in matched face position/size. RGB,
gray, CMYK and explicit-meta colors match exactly in computed browser RGB;
the nonuniform map has the two one-byte differences noted above. This corrects
an earlier intermediate observation that all 89 colors were exact.

The seven existing surface-survey controls also pass their original geometry
gates, including CMOS logarithmic labels, clipping and both hypersurfaces. The
quadratic case is a geometry and visual control, not part of the 89-face gate.

## Verification

```sh
node --test test/pgfplots-native-colormap.test.js test/browser-surface-paint-metrics.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/pgfplots-native-colormap --output outputs/qa/2026-10-25-native-colormap-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/audit-module-regressions.js --fixtures test/fixtures/pgfplots-native-colormap --output outputs/qa/2026-10-25-native-colormap-after --before outputs/qa/2026-10-25-native-colormap-before --tick-grid-metrics --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-25-native-colormap-after/test-explicit.json test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
git diff --check
```

The focused color/surface/patch/real-case collection passes all **283 tests**.
Architecture validation reports 485 modules and no errors (one unchanged
documented legacy dependency); documentation links and whitespace checks pass.
The explicit full test collection reports **3047 passed, 24 failed, 14 skipped**
out of 3085 tests. The failed names are the same as the preceding 24-failure
checkpoint; eight tests were added. The initial new semantic tests failed
before the implementation. Existing color expectations were corrected only
where independent TeX probes contradicted ideal float values or byte-only SVG
serialization assumptions. No tolerance was relaxed.

Bare `node --test` additionally discovers three argument-driven browser probes
under `test/fixtures/`. That pre-existing runner issue is separate from the
explicit unit collection and remains open at this checkpoint.

## Remaining Work

- Two one-byte nonuniform display differences; no claim of complete FPU parity.
- Explicit mesh-spacing declarations, old-compat uniform resampling of
  nonuniform maps, map-of-map declarations and arbitrary position expressions.
- Forced color spaces, HSB/Lab and general CMYK faceted-stroke mixing.
- Interpolated shading and colorbar gradients are not pixel-certified.
- The face gate checks bounded linear polygon fixtures, not general occlusion,
  arbitrary curved paint, custom clip semantics or every library feature.
- The 24 existing unit failures and the manual-probe discovery problem remain.

Next: keep failures separated into real semantic defects, independently
verified stale expectations and test-runner problems; preserve the browser
controls when repairing the remaining node/chain/text behavior.
