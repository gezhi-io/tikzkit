# Native MacTeX Fixture References

## Scope

This slice improves the shared visual-QA workflow, not a single renderer
feature. `render-example-fixtures.js --native-reference` now renders each
selected fixture through the local MacTeX engine as well as TikZKit and local
`tikztosvg`. The browser comparison page remains deliberately two-panel
(TikZKit and tikztosvg); the per-case artifact row links the native PNG, its
build log, and a four-panel review sheet.

## Local Reference Study

Read `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`:

- `/pgfplots/enlargelimits` delegates to the x/y/z variants (lines 2370-2381).
- `true` enables both the lower and upper limits (lines 6252-6259).
- The default relative expansion is 10 percent of the resolved span (around
  lines 6334-6339).

That behavior is directly relevant to the selected PGFPlots fixture because it
uses `axis x line=middle`, `axis y line=middle`, outside ticks, and
`enlargelimits=true`. It confirms that canvas and crop differences must be
evaluated separately from path geometry.

## Reference Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX engine: `/Library/TeX/texbin/pdflatex`
- PNG rasterizer: `/opt/homebrew/bin/pdftocairo`
- Case: `latex-examples-2d-x-square-with-circle`
- Artifact root:
  `outputs/qa-pgfplots-x-square-native/`
- Native PNG:
  `outputs/qa-pgfplots-x-square-native/mactex-png/latex-examples-2d-x-square-with-circle.png`
- tikztosvg SVG/PNG:
  `outputs/qa-pgfplots-x-square-native/tikztosvg-svg/latex-examples-2d-x-square-with-circle.svg`
  and
  `outputs/qa-pgfplots-x-square-native/tikztosvg-png/latex-examples-2d-x-square-with-circle.png`
- TikZKit SVG/PNG:
  `outputs/qa-pgfplots-x-square-native/tikzkit-svg/latex-examples-2d-x-square-with-circle.svg`
  and
  `outputs/qa-pgfplots-x-square-native/tikzkit-png/latex-examples-2d-x-square-with-circle.png`
- Four-panel sheet:
  `outputs/qa-pgfplots-x-square-native/diff/latex-examples-2d-x-square-with-circle-native-sheet.png`

The tikztosvg SVG uses a `194.67pt × 166.54pt` tight viewBox with glyph paths.
TikZKit emits `196.95pt × 168.8pt` and browser-owned font declarations. The
native PDF raster is `265 × 228` pixels at 96dpi, compared with `260 × 223`
for tikztosvg and `263 × 226` for TikZKit. The four-panel inspection shows the
parabola, ellipse, axes, and `$x`/`$y` labels in the same semantic positions;
the remaining red diff is mainly crop and raster-origin displacement. It is
not claimed as a visual renderer correction.

## Implementation

- `scripts/render-example-fixtures.js`
  - adds `--native-reference` and `--native-latex-engine`;
  - compiles the original source from its own directory, preserving relative
    CSV/image/input lookup;
  - rasterizes the resulting PDF at 96dpi into `mactex-png/` and retains a
    case log in `mactex-log/`.
- `scripts/diff-example-pngs.js`
  - writes a 2×2 `*-native-sheet.png` when the native artifact is available:
    MacTeX, tikztosvg, TikZKit, then the existing TikZKit/tikztosvg diff.
- `README.md`
  - documents the focused native-reference command and the artifact layout.

## Verification

```bash
node --test test/example-render-script.test.js test/example-diff-script.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-x-square-native \
  --only latex-examples-2d-x-square-with-circle \
  --native-reference \
  --strict-tikztosvg \
  --comparison-grid-mode svg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js --output outputs/qa-pgfplots-x-square-native
```

The focused script tests pass (52/52), the real case rendered all three PNG
references, and the two-panel page links its native artifact and four-panel
sheet. No TikZKit diagnostic was added for the case.

## Remaining Work

This does not erase the PGFPlots crop mismatch or make a raw mean-absolute
diff an acceptance condition. The next rendering slice should use this bundle
to resolve the middle-axis `enlargelimits` transform/bbox behavior with native
plot-frame measurements before changing range logic or stale exact-string
expectations.
