# Brace Polyline Remaining-Distance QA (updated 2026-08-06)

## Scope

- Library: `decorations.pathreplacing`.
- Accepted slice: `brace` on a polyline with `mirror`, `raise`, `amplitude`,
  and `aspect`.
- Boundary: PGF measures the complete remaining decorated subpath, then draws
  the replacement brace in the initial input-tangent frame. This is not a
  promise of exact behavior for arbitrary non-linear source paths or the other
  path-replacing decoration families.

Driver: `test/fixtures/examples/decorations/brace-polyline-continuity.tex`.

```tex
\draw[thick,decorate,
  decoration={brace,mirror,raise=4pt,amplitude=8pt,aspect=.32}]
  (0,0) -- (3,0) -- (3,2);
```

## Local MacTeX Review

Reviewed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`, lines 140-185: `brace` declares `width=+\pgfdecoratedremainingdistance` and builds the two curls with the `.15`, `.5`, `.7`, `amplitude`, and `aspect` coefficients.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`, around the decoration invocation: `\pgfdecoratedremainingdistance` starts as the remaining distance to the end of the entire decorated path, while the current coordinate transform remains the current input-segment frame.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex`: loads the TikZ key layer for the same PGF declaration.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`: documents the brace's endpoint rule and `amplitude`/`aspect` meanings.

The important correction to the previous QA conclusion is that `next state=final`
prevents a second brace state, but it does not reduce `\pgfdecoratedremainingdistance`
to the first source segment. For the driver above, the source length is `3cm +
2cm`, so native PGF builds a `5cm`-wide brace along the initial horizontal
tangent, even though the source path turns upward after `3cm`.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native rendering used local `pdflatex`.

Ignored before/after bundles:

- `/private/tmp/tikzkit-qa-brace-corpus-current-2026-08-06/`
- `/private/tmp/tikzkit-qa-brace-corpus-after-2026-08-06/`

Each contains TikZKit SVG/PNG, tikztosvg SVG/PNG when available, MacTeX PNG
when available, 1cm-grid variants, and comparison sheets for all seven actual
brace drivers in the fixture corpus. The tikztosvg brace SVG confirms the
source geometry: its gray source path turns at `3cm`, while the black brace
path's horizontal endpoint spans the full `5cm` traversal length.

## Visual Review

Before the correction, TikZKit used only the first `3cm` source segment. Its
polyline driver canvas was `117x94px`; tikztosvg was `191x94px`, and the
rightmost brace curl was visibly absent. After the correction, both are
`191x94px`; the registered comparison is accepted as `same`, with only
`2/17954` changed pixels (`0.011%`) from raster antialiasing.

All six drivers with a tikztosvg SVG were inspected: the center-line, two
coordinate-system, IEEE-754, and line-reflection braces retained their
mirror/raise/curl structure. `cache-4-way-associative` produces a TikZKit SVG
but its local tikztosvg/xelatex reference fails with `Missing \endgroup
inserted` at the source's inline `\tikzmark` table cell; it is recorded as a
missing third-party reference, not accepted as a visual match. Five of the
seven sources produced a MacTeX PNG; the visual acceptance target for this
slice is the dedicated polyline driver where all three backends rendered.

## Change And Verification

- `src/engine/evaluate.js`: groups a decorated subpath, flattens it only to
  obtain its total traversal length and initial tangent, then creates one brace
  in that initial frame.
- `test/brace-path-segmentation.test.js`: verifies that `(0,0)--(3,0)--(3,2)`
  ends at `x=5` on the raised baseline rather than at the first-segment end.
- `src/tikz/libraries/decorations.pathreplacing.js`: records the source review
  and verified boundary for the generated extension registry.

```bash
node --test test/brace-path-segmentation.test.js
node --test --test-name-pattern='brace decoration' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \\
  --output /private/tmp/tikzkit-qa-brace-corpus-after-2026-08-06 \\
  --only decorations-brace-polyline-continuity \\
  --only latex-examples-cache-4-way-associative \\
  --only latex-examples-center-line \\
  --only latex-examples-coordinate-system-2 \\
  --only latex-examples-coordinate-system-3 \\
  --only latex-examples-ieee-754-float \\
  --only latex-examples-line-reflection \\
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-brace-corpus-after-2026-08-06 \\
  --register
```

The focused tests pass, the dedicated real case has a visible geometric
improvement, and it emitted no TikZKit diagnostics.
