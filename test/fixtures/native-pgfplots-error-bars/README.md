# PGFPlots linear 2D error bars

[Proof sheet: original PDF, converter, parent, final editor and raster difference](../../../docs/qa/assets/native-pgfplots-error-bars.png)

Five standalone sources, each rendered unchanged by pdfLaTeX and entered into
the Chrome workbench. [Symmetric](manual-symmetric.tex) and
[asymmetric](manual-asymmetric.tex) are the complete `tikzpicture` blocks at
lines 54-67 and 313-326 of `pgfplots.reference.errorbars.tex` inside the installed
`pgfplots.doc.src.tar.bz2`. The pictures are byte-checked against the archive;
their wrapper uses the manual's 7 cm width and compatibility 1.18.

| Control | What distinguishes a correct render |
|---|---|
| [Fixed scatter](fixed-scatter.tex) | Blue asymmetric x/y errors, red fixed/relative errors with 0.28117 mm stems and 0.14058 mm cap pens, green uncapped y-minus stem. |
| [Autoscale](auto-extents.tex) | Errors set the four limits (x = 1..8, y = 1..6). Endpoints touch the frame. `clip=false` also tests the *absolute* page box. |
| [Grouped table](grouped-table.tex) | Two inline `y error plus`/`minus` tables, four shifted 5 mm bars, eight endpoints. `draw=blue`/`red` colors the shaft; all eight caps are black. |

**What is measured.** The shared harness clicks Render, checks the previous SVG
detached and the source did not change, then clicks Download SVG. The audit
compares live DOM and download element-by-element. It measures both plus the CLI
export against (1) original-source pdfLaTeX and (2) actual MacTeX `tikztosvg`.
Only the converter's standalone wrapper/border is adapted. Chrome and librsvg
rasterize that same converter SVG; they are not different vector references.

`physical.py` pairs stems to actual marker centers or bar tops, then pairs caps
to endpoints. Grouped black cap strokes are separated from the large frame
before matching. It checks counts, signed lengths, cap axis/length, stroke
paint and width, bar shifts, frame, all ticks and original page coordinates.
The **0.02 mm** limit is applied before rounding; colors, orientations, stroke
endings/dashes and counts must match. Geometry is checked against both
references; numeric tick labels are decoded against the PDF (converter glyphs
are outlines). At 384 dpi the audit samples actual paint. The asymmetric zero
cap is underneath an opaque data mark: its vector direction, not its pixels,
is observable. No resizing to match, registration or fitted transformation.
These sources use solid opaque strokes; they are not visual coverage of
nondefault dashes/opacity, custom error marks, log axes or 3D projections.

**Recorded runs.** Under `outputs/qa/2026-11-25-pgfplots-error-bars/`:

| Stage | Observation |
|---|---|
| `before-five` | Archived parent `941f46a4`, renderer `9305d900`. Zero of 37 nonzero error stems, 30 instead of 15 scatter markers, four bars without errors. No diagnostics. |
| `five-d93ba7b0` | 884/1010 physical comparisons. Covered zero cap vertical instead of horizontal; eight table caps colored instead of black; autoscale page too small. |
| `final-59bf81df` (intermediate) | 938/1010. The two manuals, fixed scatter and grouped table pass. Autoscale plot-relative endpoint error 0.00193 mm vs PDF, 0.00141 mm vs converter; absolute errors 1.10193/1.10243 mm. Page is 2.20073 mm narrower and 2.20304 mm shorter than the PDF. |
| `final-03881a6c` | **1010/1010 physical comparisons**, zero diagnostics, no tick-label failures. All 37 nonzero stems, all 37 caps (including the covered horizontal one), 34 ticks and four grouped bars accounted for. |

**Final numbers.** Maximum endpoint coordinate differences in mm, plot-relative /
absolute page coordinates. No `clip=false` correction was applied by the audit.

| Case | vs original PDF | vs real converter |
|---|---:|---:|
| Manual symmetric | 0.00175 / 0.00091 | 0.00247 / 0.00141 |
| Manual asymmetric | 0.00282 / 0.00146 | 0.00106 / 0.00141 |
| Fixed scatter | 0.00111 / 0.00111 | 0.00141 / 0.00141 |
| Autoscale | 0.00157 / 0.00157 | 0.00141 / 0.00141 |
| Grouped table | 0.00134 / 0.00177 | 0.00141 / 0.00141 |

The autoscale page is 59.74867 x 38.74867 mm in Chrome and 59.74715 x
38.74947 mm in the original PDF. Largest tick-position errors: 0.00254 mm vs
PDF and 0.00247 mm vs converter. Largest cap-length errors: 0.00102 and
0.00141 mm; measured pen-width differences round to zero at 0.00001 mm. The
four table bars shift by about +/-2.8515 mm; shift errors are at most 0.00054
and 0.00106 mm. Their eight black caps are about 1.406 mm wide.

The 1010 rows are 606 comparisons of three JS routes vs two native references
and 404 reference cross-checks, not 1010 independent samples. **23/25 native
byte checks pass.** All five PDF page streams, PDF PNGs, converter SVGs and
librsvg PNGs are unchanged. Only Chrome's repeat screenshots of the identical
converter SVGs differ: one pixel at (874,114) by the last blue data point in
the symmetric manual went from RGB (0,0,255) to (64,64,255); 34 gray pixels at
x=10 on the fixed scatter's left border differ by 1/255. Coordinates are
top-left, at 384 dpi. `--require-all` exits **1** on these two hash changes;
neither is a failed renderer measurement. The original images are retained.
Download and CLI are byte-identical for the three controls. The two manual
SVGs differ only in their font stylesheet (embedded font vs local font URL).

**Replay.** From the repository, with its installed dependencies, local Chrome,
MacTeX (`pdflatex`, `tikztosvg`, `kpsewhich`), Poppler, librsvg and Python
(`pymupdf`, NumPy, Pillow). Set `PLAYWRIGHT_INDEX_MJS` to your installed
Playwright `index.mjs`. Choose a **new** directory to preserve earlier evidence:

```sh
ROOT="$(git rev-parse --show-toplevel)"
F="$ROOT/test/fixtures/native-pgfplots-error-bars"
OUT="$ROOT/outputs/qa/2026-11-25-pgfplots-error-bars"
mkdir -p "$OUT"
R="$(mktemp -d "$OUT/replay.XXXXXX")"
export PATH="/Library/TeX/texbin:$PATH"
mkdir "$R/parent" "$R/candidate"
git -C "$ROOT" archive 941f46a4 src web scripts package.json package-lock.json | tar -x -C "$R/parent"
rsync -a "$ROOT/node_modules" "$R/parent/"
rsync -a "$ROOT"/{src,web,scripts,node_modules,package.json,package-lock.json} "$R/candidate/"
capture() {
  node "$1/scripts/render-example-fixtures.js" --fixtures "$F/catalog" --output "$2" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid || return 1
  TIKZKIT_QA_RERENDER=1 node "$ROOT/test/fixtures/native-positioning-targets/capture.mjs" \
    "$1" "$2" "${PLAYWRIGHT_INDEX_MJS:?set installed Playwright index.mjs}" "$3"
}
capture "$R/parent" "$R/before" 941f46a4
python3 -B "$F/physical.py" "$R/before"
capture "$R/candidate" "$R/after" candidate
python3 -B "$F/physical.py" "$R/after" --before "$R/before" --require-all
python3 -B "$F/gallery.py" "$R/after" --before "$R/before"
```

`gallery.png` compares original / converter / parent / editor / difference.
`all-routes.png` also shows download and CLI. `capture/ui/` is the actual editor;
`capture/` retains raw SVGs, PDFs and intrinsic screenshots. `case-summary.csv`
separates plot-relative and absolute errors against each oracle; `residuals.csv`,
`features.csv`, `pages.csv`, `tick-labels.csv` and `reference-locks.csv` retain
the individual observations, including failures. The 384 dpi overlays in
`overlays/` use the original page origins even when the pages differ.
