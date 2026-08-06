# `amsmath` / `mathtools` Node Formula QA

## Scope

This slice fixes the **interactive browser** rendering path for dense
`amsmath` formulas embedded in TikZ nodes. The real driver is
`test/fixtures/examples/latex-examples/kalman-filter.tex`, especially the
`align*` blocks for Prediction and Innovation:

```tex
\begin{align*}
  \mathbf{x}_{k+1}^{(P)} &= A \mathbf{x}_k + B {\color{orange} a_k}\\
  P_{k+1}^{(P)} &= A P_k A^\tran + C_k^{(r_s)}
\end{align*}
```

The boundary is deliberately limited to browser preview selection and the
shared pure-SVG script fallback. It does not claim full `amsmath` or
`mathtools` compatibility: tags, `intertext`, `split`, `gathered`,
`multline`, arbitrary macro expansion, and TeX's complete box/glue algorithm
remain partial.

## Local MacTeX Study

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/mathtools/mathtools.sty`.

`amsmath.sty` constructs `align` through `\start@align` and
`\align@preamble`; the display rows use its opened-up `\jot` spacing.
`mathtools.sty` first loads `keyval`, `calc`, and `mhsetup`, then extends and
forwards `amsmath`; it does not introduce a separate TikZ node layout model.
This means the shared renderer must preserve row baseline spacing and real TeX
glyph advances rather than use character counts for paired scripts.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its output was
rasterized with `/opt/homebrew/bin/rsvg-convert`. Local MacTeX provided the
native PNG.

- Baseline: `/private/tmp/tikzkit-qa-kalman-before-2026-08-06/`;
- after calibrated fallback metrics:
  `/private/tmp/tikzkit-qa-kalman-after-script-metrics-2026-08-06/`.

Both contain the required TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, and
comparison sheets. Inspected panels include:

- `diff/latex-examples-kalman-filter-sheet.png`;
- `diff/latex-examples-kalman-filter-native-sheet.png`.

The tikztosvg SVG preserves TeX's compact superscript/subscript clusters and
uses a tight picture viewBox; it has no SVG marker issue in this case. MacTeX
and tikztosvg agree on the routing, block geometry, labels, and the dense
formula layout. In contrast, the previous workbench forced `svg-text`, whose
character-count script rewind visibly crowded later formula atoms.

## Visual Result

The workbench now asks the renderer for scoped browser math by default. A
real browser inspection at `http://127.0.0.1:5174/#latex-examples-kalman-filter`
reported four `foreignObject` math carriers, five `tikzkit-math-scope`
wrappers, zero legacy external math class names, and zero diagnostics.
The Prediction and Innovation formulas visibly keep both scripts, fractions,
parentheses, colors, and aligned equal signs instead of falling back to the
crowded SVG-text layout.

The static SVG fallback also now measures the actual Computer Modern advance
for the paired-script rewind. This is a smaller but shared correction for
raster-reference artifacts. It improves the cursor used between scripts and
the following atom, but it is not presented as a replacement for TeX's full
layout engine.

## Implementation And Verification

- `web/workbench.js`: makes scoped browser math the interactive default;
  callers may still explicitly select `svg-text` for comparison tooling.
- `src/renderers/svg/mathScriptFallback.js`: replaces the paired-script
  character-count rewind with the calibrated local Computer Modern measure.
- `test/web-workbench.test.js`: asserts the workbench emits a browser math
  carrier and TikZKit-owned math scope without a legacy visible class name.
- `test/renderer.test.js`: covers the larger calibrated rewind required by
  `\mathbf{x}_{k+1}^{(P)}`.
- `src/packages/{amsmath,mathtools}.js` and generated registry: record the
  inspected sources and remaining partial boundary.

```bash
npm test -- --test-name-pattern='workbench|paired script cluster|script-cluster widths|amsmath' \
  test/web-workbench.test.js test/renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-kalman-after-script-metrics-2026-08-06 \
  --only latex-examples-kalman-filter --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-kalman-after-script-metrics-2026-08-06 \
  --only latex-examples-kalman-filter
npm run extension-registry
```

Focused regression tests pass and the inspected browser case reports no
diagnostics. The visual acceptance here is the interactive node formula:
scripts and alignment are present and legible while external page formulas
remain isolated.

The broader `test/renderer.test.js` run still has eight pre-existing strict
assertion failures in unrelated fallback snapshots (simple scripts, old rich
paragraph wrapping, and one exact circular-node viewBox). The focused
`amsmath`/workbench tests pass; those unrelated failures are not folded into
this formula-preview acceptance claim.

## Next Slice

Keep the pure-SVG fallback as a comparison-only path and separately add exact
TeX-like layout for the remaining display environments. The next small slice
should be `pmatrix`/`bmatrix` row-and-column spacing, using an actual matrix
fixture and the corresponding local `amsmath` source behavior.
