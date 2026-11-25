# Text-Effects Character Bounds

## Scope and Status

This follows the clipped spiral recorded in the
[text-path replacement audit](2026-11-07-text-path-replacement.md).
`decorations.text` has 18 active registry cases and remains **partial**.
The bounded change is character-node picture bounds, including rotated,
raised, repeated and scaled text, spaces, overlay exclusion, and the
supported circle replacements. It does not implement the full decoration
automaton or certify all text layout.

There is a visible improvement: outer spiral text, lowered/rotated characters
and enlarged fitted text are no longer cut off. Replacement circles no longer
inherit a digit's baseline offset. **Whole-image acceptance is not complete.**
Seven of eight browser canvas/overflow checks pass; the replacement-curve
canvas still differs by 0.234375 CSS px at 3x, above the fixed 0.2px threshold.
Four of eight JS/tikztosvg PNG pairs pass. All eight independent native-PDF
raster gates remain blocked. These failures are retained, not waived.

The full formal suite reports **3458 passed, 0 failed, 14 unchanged skips**
out of 3472 tests. No commit, push or npm release was performed in this step.

## Local Source Review

Paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Source | Rule used or remaining limitation |
| --- | --- |
| `tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex` | Text-effects pre/token/post states measure and paint ordinary TikZ nodes. Default characters are center-anchored; `text along path` changes to base anchor, transform shape and zero inner x separation, but retains inner y separation. Replacement code runs in a separate PGF scope, not in the original token's hbox. |
| `tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex` | Ordinary text-along-path characters use `pgfqboxsynced`. They must not receive the effects-node bounding-box rule. |
| `tex/generic/pgf/basiclayer/pgfcorescopes.code.tex` | `pgfqboxsynced` does not update the picture bounds; normal positioned text does. |
| `tex/generic/pgf/modules/pgfmoduleshapes.code.tex` | Rectangle node background includes the text height/depth and default `.3333em` inner separation. Outer separation is not part of the painted background rectangle. Empty space nodes still have a box. |
| `tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex` | Painted strokes extend the path bounds by half their line width. Invisible source geometry must not acquire fictitious stroke padding. |
| `tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex` | Ellipse construction uses cubic control coefficient `.55228475`; the protocol records control points in its bounds. A rotated replacement circle therefore has a larger control hull than its analytic radius. |
| `tex/generic/pgf/modules/pgfmoduledecorations.code.tex` | Native curve traversal advances in fixed-point increments and derives orientation from curve-time tangents. TikZKit's existing flattened-curve traversal remains an approximation; it was not replaced in this slice. |
| `doc/generic/pgf/pgfmanual-en-library-decorations.tex` | Character styles, counters, repeat text and the scaled spiral provide the real/manual controls. |

The registry source/document entry points were read locally. No tools, fonts
or libraries were downloaded. Native measurements use the installed MacTeX
fonts; browser output uses the existing MacTeX-derived font bundle.

## Implementation

- `src/renderers/svg/decorationText.js` now shares one placement routine
  between painting and bounds. Ordinary and repeated character paint no
  longer use duplicate loops. Space tokens retain their layout boxes even
  though they emit no glyph. All four node corners are transformed using the
  same baseline, scaling, raise and tangent as the visible text.
- Circle replacements have their own origin, stroke-inclusive advance, and
  native rotated cubic control-hull bounds. This removes the inherited
  approximately 3.222pt digit-baseline displacement in the real control.
- `src/renderers/svg/bounds.js` includes the original decoration geometry as
  an unpainted path and then the character-node backgrounds. It retains the
  existing clipping pipeline.
- `src/engine/evaluate.js` records effects-node semantics, default inner y
  separation and `overlay` in the decoration text IR. The overlay bit was
  previously missing, allowing invisible overlay geometry to enlarge output.
- `src/tikz/libraries/decorations.text.js` and the generated registry retain
  `partial`, reviewed local sources, implementation owners and these limits.

No source-case coordinates were hardcoded. The runtime changes are shared
between default browser output and exported SVG text.

## Command and Parameter Audit

| Family | Covered commands, parameters and values | Boundary |
| --- | --- | --- |
| Setup | `standalone[border=2pt]`, `tikz`, `decorations.text`, `tikzpicture`, `x=1cm`, `y=1cm` | Library loading is not a claim of complete compatibility. |
| Paths | `path`, `draw`, `--`, cubic `.. controls ..`, `arc`, `grid`, `rectangle`, `circle`, `foreach` | Existing geometry is reused; arbitrary custom decoration paths remain partial. |
| Activation | `decorate`, `postaction=decorate`, `postaction={decorate}`, `decoration`, `text effects along path`, ordinary `text along path`, `overlay` | Ordinary synchronized text intentionally retains its native non-expanding picture bounds. |
| Nodes | Default center anchor; `characters={text along path}`; `every character/.style={text along path}`; `.3333em` y padding; `scale=1.5`, `scale=2`; empty escaped spaces | Arbitrary character shapes, per-character anchors and inner-separation overrides, custom outer fonts and general math hboxes are not certified. |
| Placement | `raise=-3mm`, `raise=2pt`, ordinary `raise=5mm` negative control, `reverse path` | Exact curve arclength and tangent arithmetic remain partial. |
| Repetition | `repeat text`, `repeat text=1`, `group letters`, `reverse text`, `word separator=-`, `character count`, `character total`, `scale=0.5+\\m/\\n/2` | Supported repetition and fit behavior is preserved, not a new implementation of all state-machine hooks. |
| Fitting | `fit text to path`, `scale text to path`, `FIT TEXT` controls | Curved fitted text still has small glyph-placement differences. |
| Replacement | `replace characters=0/1 with`, `fill`, `draw`, `radius=2pt/3pt`, `line width=1pt`, purple/orange | Only the existing circle-replacement subset is covered, not arbitrary replacement TikZ code. |
| Paint and units | Gray help lines, dashed line, blue path, `ultra thin`, local CMR glyphs, pt/mm/cm/em, renderer units 30 and 96/2.54 | Glyph weight/rasterization and native-PDF thin-line appearance still differ. |

## Independent Measurements and Tests

`test/fixtures/native-decoration-text-bounds.tex` records `pgf@picminx`,
`pgf@picminy`, `pgf@picmaxx` and `pgf@picmaxy` directly from MacTeX, without
reading JS output. Twelve probes cover base/center anchors, scale/rotation,
negative raise, spaces, reversal, grouping, ordinary text, overlay and three
circle replacement variants. Tests retain a strict **0.001 TeX pt** tolerance.

`test/decoration-text-bounds.test.js` has those twelve regressions plus a
default/export and render-unit consistency test. The initial ten-probe run
failed nine tests. The fill/stroke replacement probes then failed before the
origin/width correction, and the diagonal circle probe failed before the
control-hull correction. All thirteen now pass.

`scripts/browser-decoration-bounds-metrics.js` measures actual Chrome DOM
canvas and painted bounds, including native filled replacement paths.
`test/browser-decoration-bounds-metrics.test.js` adds four tests that also
reject overflow, empty paint, mismatched dimensions and non-finite metrics.
Only the explicit space-only fixture allows empty paint. These are canvas
and clipping checks, not glyph-origin or whole-image parity checks.

The browser audit records failures and exits nonzero if a current canvas
gate fails. No existing assertion or numeric threshold was weakened.

## Visual Inspection

All eight final Chrome sheets and all eight native/JS/tikztosvg/diff sheets
were opened. Chrome renders default JS and exported SVG text at the same
physical scale as tikztosvg, waits for local fonts, and includes before and
diff panels. There are zero browser errors and zero case diagnostics.

| Case | Visible change and residual | Before / after canvas error at 3x |
| --- | --- | --- |
| `text-bounds-spiral` | Outer letters now fit on all sides rather than being clipped. Text remains slightly heavier, with small tangent/placement differences. | 67.125 / 0.046875px |
| `text-bounds-center` | The `Ag` box gains the correct vertical padding; the misplaced narrow canvas is corrected. | 59.578125 / 0px |
| `text-bounds-raised` | The complete lowered `Ag` becomes visible beneath the blue path instead of being cut off. | 59.90625 / 0px |
| `text-bounds-sloped` | The rotated A and descender fit inside the expanded canvas. | 27.1875 / 0px |
| `text-bounds-spaces` | Invisible space nodes now create the native top/bottom padding instead of a thin line-only crop. | 51.515625 / 0px |
| `text-bounds-group` | The first grouped word is no longer cropped at the left edge; grouping and reversal survive. Small word/tangent differences remain. | 15 / 0.09375px |
| `text-bounds-replacements` | Purple/orange circles move up to their own PGF origin. Native and JS both paint 24 circles. Slight curve-position and canvas-width differences remain. | 20.484375 / 0.234375px, failed |
| `text-bounds-fit-scale` | The large first F and final T are fully visible. Normal and spread-out controls remain; slight placement/weight differences persist. | 100.40625 / 0.140625px |

All final cases have zero measured painted overflow. Default and export
checks agree. The grouped case has six JS word objects versus twenty native
glyph uses; object count is not interpreted as a missing-glyph check.

The independent PDF raster also differs from tikztosvg itself in thin-line
appearance. Those differences are recorded, not used to excuse the blocked
native acceptance gates. The 7/8 canvas result does not override the 4/8
JS/reference raster result or certify full text-decoration compatibility.

## Reference Tool and SVG Analysis

`command -v tikztosvg` found **`/Library/TeX/texbin/tikztosvg`**, version 0.3.0.
References use `/Library/TeX/texbin/pdflatex` and SVG rasterization uses
`/opt/homebrew/bin/rsvg-convert`. Separate MacTeX PDFs are rasterized with
pdftocairo. The existing wrapper transformations remain in reference
provenance; no new reference-only coordinate adjustment was introduced.

The spiral reference has viewBox `0 0 97.672 97.396` and point-sized width and
height. It contains 141 outlined glyph uses, no SVG text or foreignObject,
and no arrow markers. Its gray cubic path uses `.09962` stroke width, butt
caps and miter joins. The principal transform is
`matrix(1,0,0,-1,63.608,54.372)`; glyph rotations are represented in outlined
geometry. The JS result uses local CMR text and per-character transforms,
which still differs in browser glyph weight.

The replacement reference uses 24 filled cubic circle paths with nonzero
fill rule, purple `rgb(75%,0%,25%)` and orange `rgb(100%,50%,0%)`, rather than
text or marker elements. Its canvas is `236.275 x 89.224` points; the JS
canvas is `236.218657 x 89.223679`. This residual is retained in the browser
gate rather than rounded away.

## Reproduction and Artifacts

Fixtures: `test/fixtures/text-effects-bounds/`. Four existing real/manual
sources are referenced by the manifest instead of copied.

Local artifacts:

- `outputs/qa/2026-11-07-text-effects-native/`: independent register log/PDF.
- `outputs/qa/2026-11-07-text-effects-bounds-before/`: baseline.
- `outputs/qa/2026-11-07-text-effects-bounds-after/`: intermediate node fix.
- `outputs/qa/2026-11-07-text-effects-bounds-final/`: final evidence.

The final directory contains `mactex-png/`, `tikztosvg-svg/`,
`tikztosvg-png/`, `tikzkit-svg/`, `tikzkit-png/`, `browser/`, `diff/`,
`browser-audit.html` and `browser-audit.json`. The HTML opens directly,
without a server. These generated artifacts are local, not npm contents.

```sh
/Library/TeX/texbin/pdflatex -interaction=nonstopmode -halt-on-error -output-directory=outputs/qa/2026-11-07-text-effects-native test/fixtures/native-decoration-text-bounds.tex
node --test test/decoration-text-bounds.test.js test/browser-decoration-bounds-metrics.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=/tmp/tikzkit-text-effects-bounds-tests.json test/*.test.js
node --experimental-vm-modules scripts/check-architecture.js
npm run gallery:audit
node scripts/build-extension-registry.js
node scripts/check-doc-links.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/text-effects-bounds --output outputs/qa/2026-11-07-text-effects-bounds-final --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node scripts/audit-module-regressions.js --fixtures test/fixtures/text-effects-bounds --output outputs/qa/2026-11-07-text-effects-bounds-final --before outputs/qa/2026-11-07-text-effects-bounds-before --browser-module /absolute/path/to/playwright/index.mjs
node scripts/diff-example-pngs.js --output outputs/qa/2026-11-07-text-effects-bounds-final --register
```

Formal suite: 3458 pass, 0 fail, 14 unchanged skip. Architecture: 489 modules,
zero errors, one existing `tikz/text.js -> frontend/latex-shell.js` debt.
Core gallery: 660/660 renders, zero diagnostics, not a 660-case visual
certification. Browser audit intentionally exits 1 for the retained
replacement-curve mismatch. Native-PDF raster acceptance remains blocked.

Next priorities are source-derived curve traversal/time tangents, decoration
glyph-outline parity, and general per-character font/box styles. They need
new native measurements, not tolerance changes. This step completes the
tested straight-path box rules and removes the visible clipping defects;
it does not complete the entire library.
