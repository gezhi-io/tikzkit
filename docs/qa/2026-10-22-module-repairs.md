# Module Repairs and Remaining Failures

## Scope

This batch repairs color semantics and SVG math-fallback dispatch, separates
color evaluation from general option parsing, and makes failing tests easier
to inspect. It does not claim that the full suite or all math layouts pass.

| Full suite | Before | After |
| --- | ---: | ---: |
| Tests | 2763 | 2774 |
| Passed | 2607 | 2644 |
| Failed | 142 | 116 |
| Skipped | 14 | 14 |

The 26 resolved original failures comprise three math-dispatch failures,
18 outdated color expectations, and five obsolete native-math serialization
expectations. The 11 new tests pass. No skip was added and no new failing test
name appeared. One of the 116 failures is a parent reporting its failed
subtests; the remaining 115 are individual failures.

## Implementation

- [colors.js](../../src/engine/colors.js) owns color names, natural color models,
  mixing and DeviceCMYK conversion. Existing exports through `options.js`
  remain compatible. `darkgray` and `lightgray` now use native gray .25/.75,
  and supported case-sensitive DVIPS names preserve their CMYK channels until
  after mixing. Unknown names cannot resolve inherited Object properties.
- [mathUprightFallback.js](../../src/renderers/svg/mathUprightFallback.js)
  declines formulas without an alphabet command. It no longer intercepts
  unrelated operators and accents merely because they have scripts.
- [textLineContent.js](../../src/renderers/svg/textLineContent.js) dispatches
  operator limits before generic alphabet/script handling, including sums
  whose limits contain upright text.
- [mathNode.js](../../src/renderers/svg/mathNode.js) restores the existing hat
  handler's precedence over generic script serialization.
- [module-test-reporter.js](../../scripts/module-test-reporter.js) groups
  failures by test file and retains assertion names, source locations and
  runner counts. It removes oversized SVG/font payloads from the summary,
  without changing the test runner's exit status.

Comments describe the color-model ordering and math-handler ownership, not
just what each statement does. xcolor is recorded as partial: complete
option-selected palettes, target-model selection and color series are not
implemented by this batch.

## Local Source Review

All paths below are under `/usr/local/texlive/2025/texmf-dist/`:

- `tex/latex/xcolor/xcolor.sty`: natural RGB/CMYK/gray models, .25/.75 gray
  names and interpolation before output conversion.
- `tex/latex/graphics/color.sty`: default CMYK definitions.
- `tex/latex/graphics/dvipsnam.def`: the original CMYK values for `Blue`,
  `Green`, `Red`, `WildStrawberry`, `Sepia` and `LimeGreen`.
- `tex/latex/base/fontmath.ltx`: `sum` is a large-symbol math operator;
  `hat` is a math accent, not a generic combining character.

The native hbox probe for `e^{-x/2}\sin x` reports `45.3507pt`. Native math
tests check actual font families, optical sizes, baseline positions and
widths instead of requiring the old `<tspan>` serialization.

## Visual Verification

The four permanent [module fixtures](../../test/fixtures/module-regressions/manifest.json)
have MacTeX PNG, TikZKit SVG/PNG, local tikztosvg SVG/PNG, browser screenshots
and comparison sheets. Local tikztosvg was found at
`/Library/TeX/texbin/tikztosvg`; the reference engine was pdflatex. No network
font or library installation was used.

Artifacts are generated locally, not committed binaries:

```text
outputs/qa/2026-10-22-modules-before/
outputs/qa/2026-10-22-modules-final/
  browser-audit.html
  browser-audit.json
  test-summary.json
  browser/*-sheet.png
  mactex-png/
  tikzkit-svg/
  tikzkit-png/
  tikztosvg-svg/
  tikztosvg-png/
  native-probes/math-native-contracts.log
```

Both default JS rendering and explicit SVG-text output were painted in Chrome
with the existing local MacTeX fonts. All four cases have zero diagnostics,
zero failed fonts and zero browser page errors.

- **Gray and DVIPS mixes:** dark/light gray now have the native intensities.
  `Green!100` no longer unexpectedly becomes bright RGB green; `Blue!50!white`
  keeps the native muted purple. These changes are visible in the before/after
  sheet and agree with the local reference.
- **Natural-model palette:** yellow, cyan and their mixes match the native
  palette. The changed tests previously expected RGB/CSS mixing even though
  the existing conversion followed the CMYK reference.
- **Inline fallback dispatch:** the summation lower limit is compact again,
  and the existing hat geometry is reachable. The SVG-text sum size and
  accent outline are still approximate. Default rich-text rendering also
  retains visible weight/spacing differences from native TeX. These are
  not accepted as visually equivalent.
- **Native math contracts:** six native-supported formulas contain 33 glyphs.
  Their browser origins match 33 reference glyphs with a maximum error of
  `0.01515px` at 3x CSS zoom, below the `0.09px` gate. Raster edge differences
  remain; this is not a claim of pixel-identical rendering.

## Reproduce

Run from the repository root with MacTeX, local tikztosvg, rsvg-convert and
an existing local Playwright/Chrome installation:

```sh
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/module-regressions \
  --output outputs/qa/module-regressions \
  --native-reference --strict-tikztosvg \
  --tikztosvg-engine pdflatex --math-renderer svg-text

node scripts/audit-module-regressions.js \
  --output outputs/qa/module-regressions \
  --browser-module /absolute/path/to/playwright/index.mjs

npm run --silent test:summary > outputs/qa/module-regressions/test-summary.json
npm run check:architecture
npm run docs:links
```

`test:summary` currently exits nonzero because unresolved failures remain.
Some full-suite tests bind local loopback ports; a sandbox denying those ports
adds environmental failures and is not comparable with this baseline.
The final restricted rerun, after the reporter's diagnostic-total fallback
was added, reports 2638 passes, 122 failures and 14 skips. Its six additional
failures are all `web-server.test.js` cases with `listen EPERM` on 127.0.0.1;
the other failure names are unchanged. That separate result is preserved in
`test-summary-sandboxed.json`. An unrestricted repeat could not start because
the automatic permission review timed out, so it does not replace the earlier
completed unrestricted result above.

Focused regression command (18 passing tests):

```sh
node --test test/module-test-reporter.test.js test/color-semantics.test.js \
  test/math-fallback-dispatch.test.js test/options.test.js
```

## Remaining Work

The failure inventory is a triage list, not evidence that every failure is a
renderer bug. Old serialization assertions must be distinguished from actual
geometry, typography and parsing differences before changing either code or
expectations.

| Test module | Individual failures |
| --- | ---: |
| pgfplots-seams | 37 |
| line-segments-new30 | 15 |
| extensions | 13 |
| interpreter | 9 |
| petarv-compat | 8 |
| case-by-case-acceptance | 7 |
| renderer | 7 |
| pgfplots-docsrc | 6 |
| parser | 2 |
| tikzquads | 2 |
| Nine other modules | 9 |

Next priorities are source-derived operator/accent layout, text wrapping and
font bounds, PGFPlots axis/tick geometry, then shape anchors and clipping.
Each slice needs its own minimal regression and native/browser comparison.
The existing architecture check passes with no new dependency cycle; the
pre-existing `tikz/text.js` to `frontend/latex-shell.js` cycle remains.
