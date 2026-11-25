# Fixed CircuitikZ passive labels: physical visual replay

The three `manual-*.tex` inputs retain the complete printed drawings, including
`\def\DIR` and the unbraced `in \DIR`. The measurement script byte-checks
them against lines 8870-8876, 8879-8885 and 8888-8894 of the installed
TeX Live 2025 `circuitikzmanual.tex`. Only standalone document wrappers were
added. `literal-rotate.tex` replaces only the loop list, not the raw examples.
`mixed-passives.tex` exercises both label sides, reverse paths, math subscripts,
two heavier pens, and a horizontal control with no terminal circles.

From the repo root, use local Chrome, Playwright, MacTeX including the actual
tikztosvg, Poppler, librsvg, and Python with PyMuPDF, NumPy, Pillow, SciPy and
OpenCV. The existing capture harness is used unchanged. Work in new directories.

```sh
F=test/fixtures/native-circuitikz-label-orientation
P=test/fixtures/native-positioning-targets
OUT="outputs/qa/2026-11-25-circuitikz-label-orientation/replay-$(date +%Y%m%d-%H%M%S)"
PW="${PLAYWRIGHT_INDEX_MJS:?Set the absolute path to playwright/index.mjs}"
export PATH="/Library/TeX/texbin:$PATH"
mkdir -p "$OUT/parent" "$OUT/candidate"
git archive 0833e9a6 src web scripts package.json package-lock.json | tar -x -C "$OUT/parent"
rsync -a node_modules "$OUT/parent/"  # dependencies for the parent lock
rsync -a src web scripts package.json package-lock.json node_modules "$OUT/candidate/"
capture() {
  node "$1/scripts/render-example-fixtures.js" --fixtures "$F/catalog" --output "$2" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid &&
  node "$P/capture.mjs" "$1" "$2" "$PW" "$3"
}
capture "$OUT/parent" "$OUT/before" parent-0833e9a6
python3 -B "$F/orient.py" "$OUT/before"
python3 -B "$F/sheet.py" "$OUT/before"
capture "$OUT/candidate" "$OUT/after" candidate
python3 -B "$F/orient.py" "$OUT/after" --parent "$OUT/before" --require labels
python3 -B "$F/orient.py" "$OUT/after" --parent "$OUT/before" --require all
python3 -B "$F/sheet.py" "$OUT/before" "$OUT/after"
python3 -B "$F/sheet.py" "$OUT/before" "$OUT/after" --routes
python3 -B "$F/overlay.py" "$OUT/after"
```

The two references are the PDF of the byte-identical input and the real
converter SVG. Chrome and librsvg each paint that SVG independently; they
are not two additional vector oracles. `capture/ui` retains the normal
workbench. `capture/live`, `capture/download`, and the CLI SVG preserve the
three JS routes, even when the parent is blank. Native reference PNG/SVG
fingerprints are compared across captures; no references are replaced.

**Reading measurements.** `glyphs.csv` records first-glyph origins on the page
(mm, right/down), angles (degrees, counterclockwise positive), tangent/normal
offsets from the physical component midpoint, and the final glyph or subscript
relative to the hub/red fiducial. No fitting. PDF and JS use emitted glyph
baselines; native SVG uses placed glyph origins. Its lone zero reuses the
identical glyph in `180`; mixed labels use the subscript drop of the upright
R5 in that same SVG. The 384 dpi paint check uses original, unrotated-in-post
word masks to locate actual dark screenshot pixels near each output's own
baseline. It rejects missing or differently oriented visible text.

`label-residuals.csv` compares 37 labels across the three JS routes to both
native references (222 rows), plus 148 native checks. Limits: 0.02 mm local
vector position, 0.12 degrees, 0.20 mm visible ink. Absolute first-glyph page
differences (`baseX`, `baseY`, no registration) are recorded in every row.
`localFail` and `absoluteFail` distinguish the two checks; `fail` is their union.
`panels.csv` and `page-residuals.csv` report
unregistered page, origin, east terminal diameter (centerline and outer ink)
and margins outside all eight open terminals. `--require labels` rejects any
diagnostics, missing labels, native fingerprint changes, mixed-page errors or
unexplained spoke-margin errors. `--require all` also gates both absolute
first-glyph coordinates and raw spoke page, origin and terminal dimensions
at 0.02 mm. Limits are checked before rounding for CSV display.

`overlay.png` compares the actual 384 dpi JS captures to the real converter
SVG rasterized by librsvg. Pixel (0,0) is unchanged: the only operation before
comparison is white padding at the right and bottom. Gray is common ink,
magenta excess reference ink, green excess compared ink, with antialiasing
retained. The last column compares the **same converter SVG** painted by
Chrome vs librsvg. The sheet includes absolute-page detail crops; `overlays/`
contains the unscaled full-page comparisons. `overlay-pixels.csv` includes
raw changed RGB pixels and counts of exclusive dark pixels (128 threshold).
Whole-image pixel identity is not a label acceptance criterion.

**Frozen parent.** Commit `0833e9a6`, renderer `1ffd8f5e`: all three raw
examples emitted a malformed-foreach diagnostic and blank 11.40584 mm square
pages instead of eight labels on 52.66619 mm native pages. The literal control
rendered eight horizontal labels; native rotate turns six, up to 90 degrees.
Its north label missed the native normal position by 5.28047 mm vs PDF.
The literal page was 0.28024 mm wider and taller; east terminal outer diameter
was 1.53935 mm in JS, 1.26040 mm in PDF, and 1.25960 mm in the converter SVG.
The mixed native glyphs ran at 27, 53, 0, 52 and 0 degrees; JS drew all at 0.
The parent passed 148/370 label comparisons, all from the reference routes.

**Final capture.** The [before/after gallery](../../../docs/qa/assets/native-circuitikz-label-orientation.png)
is from frozen main-workspace renderer `dc7af423f981e9e60b6b9391568800a95f56da1d584018729485503e3f6bc75e`,
Chrome 158.0.8127.37. For each fixture the operator clicked Render, verified
that the previous live SVG was detached and the editor source still matched,
then captured the new SVG and clicked Download SVG. The click checks, raw
captures and overlay are retained in
`outputs/qa/2026-11-25-circuitikz-label-orientation/final-dc7af423/`
(`editor-capture.mjs` and `capture.json` record the explicit rerender).
All 24 verbatim manual spokes render without diagnostics. The strict run
passed 370/370 label rows, including absolute baselines, and 50/50 page and
terminal rows. All ten native reference PNGs and five converter SVGs matched
the parent byte-for-byte. The native librsvg route is a raster cross-check of
the same converter SVG, not a third independent vector reference.

| Across all JS routes | vs original PDF | vs actual tikztosvg |
|---|---:|---:|
| Maximum absolute first-glyph coordinate error | 0.00085 mm | 0.00085 mm |
| Maximum baseline angle error | 0.00065 deg | 0.00824 deg |
| Maximum visible label-ink center coordinate error | 0.06597 mm | 0.09922 mm |
| Spoke page side: 52.66623 mm in Chrome | 52.66619 mm | 52.66619 mm |
| East terminal outer ink: 1.25960 mm in Chrome | 1.26040 mm | 1.25960 mm |

On the earlier label-only capture, all 48 JS-vs-reference literal-list
comparisons passed locally and failed **both** absolute coordinates
(0.13952-0.14042 mm displacement). This verifies the absolute gate detects the
previous page shift. On the final rotate raster, live Chrome vs librsvg had
22,294 shared dark pixels, 283 converter-only and 1,095 live-only. Even the
unchanged converter SVG painted by Chrome vs librsvg had 252 converter-only
and 1,545 Chrome-only dark pixels.

Against the preceding `cfee0540` capture, `previous-cfee0540-bytes.csv`
verifies all 15 JS SVGs, their 15 diagram PNGs, the five converter SVGs and
all 15 native rasters are byte-identical. All five measurement CSVs, including
the overlay pixel counts, are also unchanged. The five full UI screenshots
differ only in the top toolbar following the explicit click; no drawing pixel
changed. Rebuilt PDFs have new timestamps but identical decompressed page
streams and rendered pixels. No previous capture is used as final evidence.
