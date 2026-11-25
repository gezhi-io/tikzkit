# PGFPlots statistics: boxplots

[Physical comparison sheet](../../../docs/qa/assets/native-pgfplots-boxplots.png).
The two public gallery files are the only maintained copies of the manual
pictures. The QA catalog references them directly. Their complete picture
bodies are checked byte-for-byte against lines 116-144 and 638-647 of
Christian Feuersanger's PGFPlots manual source, `pgfplots.libs.statistics.tex`,
in the installed `pgfplots.doc.src.tar.bz2`. Only the standalone wrapper,
statistics library, 7 cm manual width and `compat=1.18` are outside the excerpts.

| Input | Original pdfLaTeX result |
|---|---|
| [Prepared manual](../examples/pgfplots/boxplot-manual-prepared.tex) | Horizontal lanes 1/2/3; blue: 40, 34, 56; red: no outliers; brown: 35, 55. Three bodies, six caps, three medians. |
| [Raw manual](../examples/pgfplots/boxplot-manual-samples.tex) | Twelve observations including repetitions. Whiskers 1/10, quartiles 3.5/9, median 7.5. No ordinary connecting line or outliers. |
| [Vertical mixed](vertical-mixed.tex) | Lanes 1/2/5, widths 6.4 mm, caps 3.2 mm. Lane 2 has no median. The raw lane has quartiles 5/8, median 6, whiskers 4/9 and outliers 0/15. The magenta three-vertex line remains separate. Body/whisker/median pens: 0.8/0.6/1.4 TeX pt. |
| [1.11](compat-111.tex) / [1.12](compat-112.tex) | Same eight unsorted observations; only the compatibility declaration changes. Legacy: Q1/median/Q3 = 2/4/6, whiskers -3/11.75. R7: 2.75/4.5/6.25, whiskers 2/7; both tails are now outliers. |
| [Ordinals and widths](ordinals/ordinals-width.tex) | Prepared lanes 1/2/5, raw lanes 1/2. Neither kind consumes the other's counter; the regular line consumes neither. Only 1 is labeled by `ytick=data`: one left and one right stroke. Sizes 4/9/16/36 produce bodies 2/3.5/5/8 mm and caps 1.6/2.8/4/6.4 mm with explicit size bounds 4/36 and minimum fraction 0.25. |

## Recorded comparison

- **Before:** archived `2325922a9a9c338e8d3a52885c014eac8de11259`, renderer
  `f584bd58f1e8`. No box bodies, caps or medians on any JS route, despite zero
  diagnostics. The raw manual is a 98.339 mm tall page of connected samples;
  the original PDF is 17.189 mm tall.
- **Frozen converter bug:** its preamble loads statistics, sets compatibility,
  then passes `-l pgfplots.statistics`, loading the library again. The raw manual
  becomes 2/7/9 instead of 3.5/7.5/9. On the 1.12 probe, removing **only** that
  flag restores the two native outliers; adding it reproduces the frozen SVG
  byte-for-byte. Both actual converter versions are on the sheet. The original
  PDF is the authority; the corrected converter is not substituted into the baseline.
- **Final capture:** renderer SHA-256
  `a72289b93d7ec62cd9446c7820ca4fe583e6111c6b05ae29f49dea110c35bd29`.
  The five catalog figures are in `final/`; the sixth is in `final-ordinals/`,
  both under `outputs/qa/2026-11-25-pgfplots-boxplots/`. The permanent sheet
  is an exact copy of `final/gallery.png`. Per route: 14 bodies, 28 stems,
  28 caps, 13 medians, 12 outliers, four ordinary line segments, no extras.
  All six strict packaged CLI files equal the actual browser Downloads byte
  for byte. All six original PDF page streams and 384 dpi PDF PNGs match the
  frozen run. The converter SVG changed in four cases; the prepared manual
  and 1.11 control stayed byte-identical.
- **Largest absolute page-coordinate errors**, JS versus original PDF:
  body/median 0.00212 mm, cap 0.00155 mm, outlier outline 0.00160 mm, ordinary
  line 0.00213 mm, tick 0.00212 mm. Page dimension: 0.00250 mm. No alignment.
  Max plotted coordinate difference versus the corrected converter: 0.00282 mm.
- **Visible residuals:** on the vertical body, Poppler paints `#c2ecfc`; editor
  and converter paint `#c2ebfb`. Each has 38,320 solid fill pixels; reopened
  Chrome Download has 38,465. MuPDF reports a different RGB conversion of the
  PDF fill (`#bce6fb`), not missing paint. The prepared brown outline is
  `#734d26` in the JS SVG and `#734c26` in the converter. On the raw manual
  Chrome loads the embedded CMR10/CMMI10 faces. Local librsvg uses Helvetica /
  Helvetica-Oblique for the **same CLI SVG**; compare the last two columns.
  Against the interim run, the only changed probe raster was the raw manual's
  fixture-export screenshot: four pixels changed by 1/255 on an identical SVG.
  No workbench, Download or packaged CLI raster changed. Counts/geometry
  passing is not a claim of font or pixel identity.

The [installed-native test](../../pgfplots-boxplot-native.test.js) measures
actual PGF paths and mark centers at 0.025 TeX pt. Its width controls use
automatic size bounds 1/4/9: the default caps scale with each body, an explicit
0.8 cap stays fixed, and a half-body-width expression follows the resized body.
Two equal sample sizes use the minimum target, not full width: **4 mm body,
3.2 mm cap** at 20 mm per unit. All 17 cases pass on the corrected working tree
(18 Node tests including the parent), including per-row positions and the mixed
width reset. The sheet labels its own renderer separately.

## Reproduce

Use local pdfLaTeX, tikztosvg, Poppler, librsvg, Chrome, Playwright's Node
entry and Python with Pillow, NumPy and PyMuPDF. Set `TREE` to the renderer
tree with installed project dependencies, `PLAYWRIGHT_INDEX_MJS` to the
installed Playwright entry and `REV` to the snapshot label. Use a fresh
ignored stage; never overwrite the before run.

~~~sh
F="$PWD/test/fixtures/native-pgfplots-boxplots"
Q="$PWD/outputs/qa/2026-11-25-pgfplots-boxplots"
R="$(mktemp -d "$Q/replay.XXXXXX")"
for catalog in catalog ordinals; do
  S="$R/$catalog"
  node "$TREE/scripts/render-example-fixtures.js" --fixtures "$F/$catalog" --output "$S" \
    --strict-tikztosvg --native-reference --native-latex-engine pdflatex \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid || exit 1
  TIKZKIT_QA_RERENDER=1 node "$F/../native-positioning-targets/capture.mjs" \
    "$TREE" "$S" "$PLAYWRIGHT_INDEX_MJS" "$REV" || exit 1
done
python3 -B "$F/evidence.py" "$R/catalog" "$R/ordinals" --require-geometry
python3 -B "$F/gallery.py" "$R/catalog" "$R/ordinals" \
  --before "$Q/before" "$Q/before-ordinals" -o "$R/gallery.png"
TIKZKIT_TEST_PDFLATEX=1 node --test test/pgfplots-boxplot-native.test.js
~~~

Omit `--require-geometry` for the known-red baseline. The gate compares each
physical endpoint, tick and page/frame boundary within 0.02 mm and pen within
0.002 mm. Actual colors, sample counts and signed residuals are retained in
`geometry.json`, even when a count differs and no pairing is possible.
`capture/ui/` is the ordinary workbench; `capture/live/` is that same rendered
SVG at its declared size. `capture/pdf/` is the unmodified source's own page.
`capture/download/` and `capture/cli/` are independent files, not copies.
The sheet uniformly reduces every page 4:1, preserving even the oversized
baseline pages. Under `Q`, `reference-order-check/` contains the single-flag
A/B, `width-check/` the equal-size PDF, and `incomplete-native-check/` a
discarded control that native TeX rejected, not a comparison reference.
