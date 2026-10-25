# Mixed Paragraphs, Polar Legends and Chronology

Follow-up: [polar precision and chronology browser checks](2026-10-25-polar-timeline.md)
supersede the blocked-browser and remaining tick status below. This document
retains the earlier measurements as historical evidence.

## Scope and Status

This follows the three visual gaps left by the scoped-font repair, starting
with mixed prose, inline math, the parallel symbol and line breaking. It is
not a claim of complete TeX, polar axes or Beamer support.

- The supported mixed-paragraph slice now follows native glyphs, math spacing
  and line breaks. Actual browser default-JS and SVG-text comparisons were
  inspected against local tikztosvg during this run.
- The half-plane polar legend now has the native sample waves, black labels,
  measured cells and outside placement. Its focused browser comparison is
  close; the whole figure still fails the existing tick-position gate.
- Chronology now has native tick rules, event boxes, whole-picture scaling,
  CMSS fonts and a guarded Metropolis page layout. The final native PNG/SVG
  panels were inspected, but final browser acceptance is **not complete**.

Later browser launches failed: independent Chromium could not launch under
the current permissions, two approval requests timed out, and the in-app
browser rejected the local file URL. No alternative transport was used to
bypass that rejection. Fresh interactive-browser verification of chronology
and the new CMSS optical-size control still requires restored browser access.
Unit-test success and exported PNGs do not close this requirement.

No commit, push, npm login, version change or publication was performed.

## Local Implementation References

All TeX paths below are under `/usr/local/texlive/2025/texmf-dist/`.

| Files read | Implemented behavior |
| --- | --- |
| `tex/latex/base/fontmath.ltx`, CMSY/CMBSY TFM and PFB files | Slot 107 is the double bar. `\Vert`/`\|`, `\mathbin{\|}` and `\parallel` retain their ordinary, binary and relation spacing instead of borrowing a browser Unicode glyph. |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, node hboxes and paragraph construction | Text width, surrounding-font glue, actual math-list boxes and legal breaks are shared by measurement and paint. Inline math color changes must not recolor the surrounding paragraph. |
| `tex/latex/base/ot1cmss.fd`, local CMSS TFM/PFB files | CMSS8/9/10/12/17 optical designs and CMSSBX10 substitution are selected before scaling. Sans-serif prose does not implicitly change math alphabets. |
| `tikzlibrarydatavisualization.code.tex:630-657,1670-1825,1934-2010,2047-2117` | Outside line legends are matrices of small plots. Sample positions use em/ex, label cells use struts, and outside gaps refer to the actual visualization bounds. |
| `tex/latex/chronology/chronology.sty` | The first major tick is strictly after the start year; minor ticks are annual. Optional fifth argument is the unscaled width in brackets. The package measures its complete picture before resizing text, pens and arrows together. |
| `tex/latex/graphics/graphics.sty`, `Gscale@div` | Integer scaled-point division produces the resize ratio; ideal floating-point division causes measurable position drift. |
| `beamerbaseframe.sty`, `beamerbaseframesize.sty`, `beamerbaseframecomponents.sty`, Metropolis font/outer/color themes | The supported centered 10pt 4:3 frame uses native title/foot/body dimensions, CMSS, theme colors and the title progress rule. Other page settings are diagnosed, not silently certified. |
| `tex/latex/standalone/standalone.cls`, local `tikztosvg` script | Automatic cropping of chronology's inner TikZ picture conflicts with its surrounding savebox. The reference adapter captures the completed native box without leaking wrapper node separation or whitespace into it. |

No font was downloaded. Six new WOFF faces and the repaired CMSY/CMBSY glyph
maps were generated from installed MacTeX files. The consumer-package check
loads all **93 font faces** with zero diagnostics.
Paragraph glue also uses the selected sans optical/bold font, not CMR/CMBX:
the independent `A B $x$ C` probe measures 57.85059pt at 17.28pt CMSS and
38.4099pt at 10pt CMSS bold. The formerly wrong 57.25061pt result is covered
by a regression observed failing before the repair.

## Commands and Parameters Checked

| Slice | Implemented and tested | Remaining boundary |
| --- | --- | --- |
| Mixed paragraph | `node`, `text width=6cm`, `inner sep=1ex`, rounded background, inline `$...$`, `\color`, `\mathbin`, `\|`, `\parallel`, `\Vert`, `\,`, Greek symbols, binary/relation glue and break penalties | Arbitrary nested TeX environments, unsupported macros and full paragraph shaping are not certified. |
| Font selection | `\sffamily`, `\textsf`, grouped declarations, standard sizes from tiny to Huge, bold sans substitution, mixed serif/sans restoration | Other NFSS families, slanted/italic CMSS and arbitrary document font configurations remain partial. |
| Polar legend | `scientific polar axes=clean`, smooth line visualizers, label-in-legend text, line colors/styles, ordinary outside below/above/right cells and native text-right spacing | Only the half-plane below-legend slice was visually checked here. Custom sample coordinates, matrix layouts, full-circle variants and arbitrary font contexts remain partial. Tick-origin residuals are listed below. |
| Chronology | `chronology`, `[step]`, start/end year, requested width, optional `[unscaled width]`, point/span `\event`, `\decimaldate`, rotated event labels, small text, annual/major ticks and `|->` | Custom chronology styles, `eventspan`, `eventpoint`, multiple frames, other Beamer themes/aspect ratios/font sizes and arbitrary document layout are not covered. |
| Metropolis page | One centered 10pt 4:3 frame, title, default colors, optional `progressbar=frametitle`, page number and vertically packed chronology boxes | Final browser check is blocked. This is a guarded package adapter, not a general Beamer implementation. |

Shared mixed symbolic arrow parsing now recognizes `|->`, `<-|` and `|-|`
using the existing legacy bar and active arrow-tip geometry.

## Visual Evidence

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg` (0.3.0).
References use local `pdflatex` and `rsvg-convert`; independent native PNGs
come from MacTeX PDFs through `pdftocairo`.

The final seven-case set is in
`outputs/qa/2026-10-25-visual-followups-final/`:

- `tikzkit-svg/`, `tikzkit-png/`: actual JS output, not a reference-image substitute.
- `tikztosvg-svg/`, `tikztosvg-png/`: six genuine tikztosvg references and one
  explicitly marked `native-latex` full-page Beamer reference.
- `mactex-png/`: seven independent MacTeX renders.
- `tikztosvg-input/`, `tikztosvg-log/`: reproducible reference input and the
  Beamer wrapper failure. Beamer's `usetheme` cannot run in standalone.
- `diff/`, `diff-png/`: native/third-party/JS panels and differences.
- `browser-live.html`: a prepared two-panel interactive check. Preparing this
  page does **not** mean its final browser measurements have run.

The chronology reference wrapper uses standalone's saved original TikZ
environment to build chronology's native savebox before placing it in a
zero-separation node. No event coordinates are recomputed by JS for this
reference. The transformation is recorded in the render provenance. Full-page
Beamer remains a separate MacTeX fallback, never relabelled as tikztosvg.
PDF-to-SVG fallback preserves original physical page size; otherwise Poppler
can silently scale and center a fractional-point page.

Actual browser captures from earlier in this same run are retained in:

- `outputs/qa/2026-10-25-visual-followups-after/browser-audit.html` and `browser/`.
- `outputs/qa/2026-10-25-polar-legend-final/browser-audit.html` and `browser/`.

Each contains default JS, local tikztosvg, exported SVG-text and diff panels.
The final paragraph/polar SVG roots and paint content after defs were checked
unchanged against these captured versions. New unused font definitions do not
constitute a fresh browser run; chronology is not covered by those captures.

| Case | Observed change and remaining difference |
| --- | --- |
| `remaining-html-spacing` | Double bar now uses CMSY rather than a fallback glyph. The break after the binary symbol and following line's leading glue match native. All 34 browser glyph origins agree within 0.0194px at 3x. |
| `angles-parallel-paragraph` | Colored explanation now has the native three lines, intact parallel bars and consistent baselines. Its 60 paragraph origins agree within 0.020px. The full 70-glyph figure still has up to 4.272px error from pre-existing angle-label geometry; the full figure is not accepted. |
| `colored-parallel-paragraph` | Isolated control preserves the three rows: `When we assume that AB and CD` / `are parallel, i.e., AB || CD, then alpha = gamma` / `and beta = delta.` Colors remain scoped. This control has fresh native/export panels, but no new final browser capture. |
| `remaining-polar-half-plane` | Legend samples are native miniature smooth plots, label text is black, and both cells share the correct baseline/spacing below the data box. The 12 legend origins agree within 0.015px at 3x. Across all 69 glyphs, the largest error is 0.171px in ticks, outside the existing 0.09px gate. |
| `cmss-optical-sizes` | Native optical CMSS designs replace approximate sans metrics across nine sizes and bold. Native hboxes pass; PNG panels visibly retain the intended widths/baselines. Final browser font-loading and origin acceptance remains pending. |
| `remaining-chronology-title` | Removes the spurious initial 1800 label, restores annual/major ticks, event placement, the start bar and arrow, and native title/body/footer proportions. Local PNG panels are much closer. Final browser verification and small stroke/raster differences remain open. |
| `chronology-core` | Independent standalone control checks the optional 12cm base width resized to 9cm, three event labels and an interval. Native and JS layout are close, but the interval stroke/raster comparison is still different; it is not accepted as pixel-identical. |

The native SVGs contain path-based glyphs with physical transforms and `<use>`
origins. JS uses explicit SVG glyph positions with packaged MacTeX fonts, not
browser paragraph wrapping. Legend sample path geometry, bar/arrow paths,
line caps/joins, transformed pen widths, viewBox size and font choices were
inspected. No foreignObject is needed for the repaired mixed paragraph.

The final PNG comparison still reports **3 differing JS/reference pairs**:
the full angles diagram, half-plane polar figure and chronology control.
Native PDF rasterization also fails the stricter pixel gate across the set.
These differences were not hidden by changed thresholds or fitted rescaling.
Close glyph origins do not certify identical ink pixels.

## Verification and Files

The final non-server collection has **3108 passed, 0 failed, 14 unchanged
skips** (3122 tests). Six tests in `test/web-server.test.js` were excluded from
that rerun after the full run failed with `listen EPERM` on 127.0.0.1. They
remain blocked, not passed or newly skipped. No test assertion was weakened
to waive a remaining visual discrepancy.

Existing font-serialization expectations were updated to inspect actual CMSS
families after native support was added. Former negative tests retain an
unsupported italic/slanted case, with positive sans controls added. Font widths,
chronology bounds and polar legend placement use independent MacTeX values,
not values guessed from the JS output. A missing documentation-link failure
during the intermediate run was resolved by adding this report.

Key changes are in `src/tex/{mathBox,mathFonts,textBox,paragraphBox,paragraphBreaking}.js`,
`src/tikz/textMetrics.js`, `src/tikz/libraries/datavisualizationLegend.js`,
`src/extensions/chronologyLayout.js`, `src/frontend/latex-shell.js`,
`src/engine/options.js`, the native font builder/generated assets, package/library
metadata, and the reference adapter. Focused tests and independent TeX probes
are in `test/{mixed-paragraph-native,cmss-native-text,chronology-layout}.test.js`,
`test/datavis-polar-tick-layout.test.js` and `test/fixtures/visual-followups/`.

Commands used:

```sh
node --test test/mixed-paragraph-native.test.js test/cmss-native-text.test.js test/chronology-layout.test.js test/datavis-polar-tick-layout.test.js test/example-render-script.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/visual-followups --output outputs/qa/2026-10-25-visual-followups-final --native-reference --tikztosvg-engine pdflatex --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-25-visual-followups-final --register
node scripts/prepare-browser-comparison.js --fixtures test/fixtures/visual-followups --output outputs/qa/2026-10-25-visual-followups-final
node scripts/check-font-package.js
node --experimental-vm-modules scripts/check-architecture.js
git diff --check
```

Architecture checks pass with the existing nested-axis text fallback debt.
All seven JS examples have zero diagnostics. The next acceptance step is the
blocked browser check, followed by PGF fixed-point polar tick residuals and
chronology interval paint comparison. Do not mark all three visual tasks done.
