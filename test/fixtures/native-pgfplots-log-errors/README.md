# PGFPlots: logarithmic 2D error bars

[Final contact sheet: original PDF, tikztosvg/librsvg, frozen Chrome baseline, final Chrome editor, and unregistered difference](../../../docs/qa/assets/native-pgfplots-log-errors.png)

**Final result:** 22 measured points, 60 nonzero stems, 64 caps, no unassigned
colored segments, and zero diagnostics. The frozen baseline is
`b84f7b4f8986d7a616415e101148bf8290392074` (renderer `0e7abb2daeb7`);
the final working-tree renderer fingerprint is `42d266da6845`. All 3,051
feature comparisons passed at **0.02 mm**. A separate repeat-screenshot byte
check failed; the exact difference is recorded below.

| Fixture | Points / stems / caps | Discriminating observation |
|---|---:|---|
| [manual-log-relative](manual-log-relative.tex) | 7 / 24 / 28 | The complete picture at lines 198-215 of `pgfplots.reference.errorbars.tex` in the installed `pgfplots.doc.src.tar.bz2`, byte-checked against the archive. Fixed 50% x errors; explicit relative y errors from the table. Each of the first two points has two horizontal zero-error caps under its opaque marker. These four caps are distinguishable as vector strokes, not as separate pixels. |
| [semilogy-asymmetric](semilogy-asymmetric.tex) | 3 / 8 / 8 | At the blue point the signed x arms measure +6.999 / -3.500 mm on a linear axis; y measures +10.000 / -5.000 mm on a log axis. Red has only positive arms; green only negative arms. |
| [loglog-mixed-bases](loglog-mixed-bases.tex) | 2 / 8 / 8 | Base 2 x, base 10 y. An absolute x error of 6 produces +7.535 / -18.667 mm at x=8 and +2.314 / -2.796 mm at x=32. The 50% y arms stay about +2.054 / -3.513 mm at both points. This checks endpoint projection, not base-label formatting. |
| [nonpositive-lower](nonpositive-lower.tex) | 6 / 8 / 8 | Absolute and relative modes each try zero, negative and positive lower x endpoints. Four invalid lower arms disappear; all six positive partners and the two valid lower arms remain. No substitute cap appears at the frame. |
| [semilogy-invalid-centers](semilogy-invalid-centers.tex) | 4 / 12 / 12 | With `unbounded coords=jump`, (100,0) and (20000,-1) contribute neither errors nor x limits. The baseline joins 1-2-3-4 and squeezes the four marks into 0.00829 mm horizontally. Final: 1-2 and 3-4 only, spanning 48.00000 mm (PDF: 47.99921 mm). |

## Physical results

Maximum error of any nonzero arm endpoint coordinate, in mm. **Plot** is
relative to the measured frame's lower-left corner; **page** uses the actual
upper-left page origin. There is no fitting, centering, crop registration or
resizing to match. The sheet reduces every 384 dpi capture by the same 4:1.

| Fixture | Original PDF: plot / page | Converter: plot / page |
|---|---:|---:|
| Manual table | 0.00228 / 0.00100 | 0.00247 / 0.00141 |
| Semilogy asymmetric | 0.00140 / 0.00070 | 0.00141 / 0.00000 |
| Log-log mixed bases | 0.00119 / 0.00155 | 0.00141 / 0.00141 |
| Nonpositive lower | 0.00218 / 0.00162 | 0.00282 / 0.00141 |
| Invalid centers | 0.00220 / 0.00158 | 0.00282 / 0.00142 |

| Maximum across all five figures and JS routes (mm) | vs original PDF | vs converter |
|---|---:|---:|
| Signed arm length | 0.00167 | 0.00247 |
| Absolute cap-center coordinate | 0.00247 | 0.00283 |
| Cap length | 0.00137 | 0.00141 |
| Tick position along its edge | 0.00297 | 0.00247 |
| Frame origin / page width or height | 0.00212 / 0.00166 | 0.00282 / 0.00166 |

All **182** manual tick strokes match: bottom and top each have 5 major and
43 minor ticks; left and right each have 4 major and 39 minor ticks. The five
x labels are powers 1 through 5 of ten; the four y labels are powers 2
through 5. Chrome actually loaded `TikZKitCMR10` and `TikZKitCMR7` for the
bases and exponents. The PDF embeds CMR10 and CMR7; maximum label origin
error is 0.00104 mm, em-size error 0.00002 mm and exponent-rise error
0.00013 mm. Converter labels are outlines, not a third source of font names.

The 3,051 rows comprise 2,043 JS-to-native comparisons (three routes, two
references) and 1,008 native cross-checks, not independent plots. The audit
matches actual painted markers, directed stems, cap centers/orientations,
widths, colors, line topology, frame and page. It also samples the ink at
384 dpi. Both the live DOM and the fresh Download SVG are preserved. The
packaged `bin/tikz2svg.js --strict --math-renderer svg-text` was run on all
five sources and produced **byte-identical files to Download**. The fixture
export differs only in its font stylesheet on the manual (local font URLs vs
embedded WOFFs); the other four exports are byte-identical too.

## Residuals

- **24/25 native byte checks matched.** All five original PDF page streams,
  PDF PNGs, converter SVGs and librsvg PNGs were unchanged. On the same
  mixed-base converter SVG, repeat Chrome screenshots differed on 60 pixels,
  all at x=717, y=158..239, by at most **1/255** per channel. Coordinates
  are top-left, 384 dpi. The strict combined audit therefore exits **1**;
  no geometry, paint, font or tick feature failed.
- The live editor and standalone SVG are not pixel-identical render surfaces.
  On the invalid-center plot's right-edge cap, the strongest blue is at x=857
  in the live editor, PDF and librsvg, versus x=855 in standalone Chrome
  (download, fixture export and converter). The raw 7x3 pixel samples and
  the narrower 3x3 result are retained. Both halves of the bottom caps were
  tested: inside the frame is inked; outside is clipped. On the final manual
  the downloaded and fixture-export Chrome PNGs differ on 69 pixels, all
  inside the plot, by at most 15/255; none are label pixels.
- The PDF and Cairo need not retain identical collinear path vertices. The
  audit checks that the manual's line actually visits all seven markers in
  order. It checks the two separate links on the jump control explicitly.

## Replay

Run from the repository with installed project dependencies, local Chrome,
Playwright, MacTeX, Poppler, librsvg and Python (PyMuPDF, NumPy, Pillow).
The recorded runs used Chrome 158.0.8127.37, TeX Live 2025, tikztosvg 0.3.0,
pdftocairo 26.09.0 and rsvg-convert 2.63.0. Set `PLAYWRIGHT_INDEX_MJS` to
the absolute path of the installed Playwright `index.mjs`.

```sh
ROOT="$(git rev-parse --show-toplevel)"
F="$ROOT/test/fixtures/native-pgfplots-log-errors"
OUT="$ROOT/outputs/qa/2026-11-25-pgfplots-log-errors"
mkdir -p "$OUT"
R="$(mktemp -d "$OUT/replay.XXXXXX")"
export PATH="/Library/TeX/texbin:$PATH"
mkdir "$R/parent" "$R/candidate"
git -C "$ROOT" archive b84f7b4f bin src web scripts package.json package-lock.json | tar -x -C "$R/parent"
rsync -a "$ROOT/node_modules" "$R/parent/"
rsync -a "$ROOT"/{bin,src,web,scripts,node_modules,package.json,package-lock.json} "$R/candidate/"
capture() {
  node "$1/scripts/render-example-fixtures.js" --fixtures "$F/catalog" --output "$2" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid || return 1
  TIKZKIT_QA_RERENDER=1 node "$ROOT/test/fixtures/native-positioning-targets/capture.mjs" \
    "$1" "$2" "${PLAYWRIGHT_INDEX_MJS:?set installed Playwright index.mjs}" "$3"
}
capture "$R/parent" "$R/before" b84f7b4f8986d7a616415e101148bf8290392074
python3 -B "$F/log_audit.py" "$R/before"
capture "$R/candidate" "$R/after" candidate
python3 -B "$F/log_audit.py" "$R/after" --before "$R/before"
python3 -B "$F/gallery.py" "$R/after" --before "$R/before"
python3 -B "$F/log_audit.py" "$R/after" --before "$R/before" --require-all
```

The shared harness selects the unchanged source, clicks **Render**, waits for
the old SVG to detach, then clicks **Download SVG** in real Chrome. The PDF
is compiled from the original standalone file. Only the local tikztosvg
wrapper/border is adapted; Chrome and librsvg rasterize the same converter
SVG. The log audit reuses the linear fixture's physical measurement code.

Recorded directories under `outputs/qa/2026-11-25-pgfplots-log-errors/`:
`before` and `before-five` are the frozen parent; `intermediate`
(`75edf664cbc8`) restores the first four cases' stems but misses the manual
page endpoints by 4.51566 mm and draws 79 ticks; `invalid-centers`
(`caad44f484b6`) fixes the endpoints and jump but still draws 100 manual
ticks; `final` contains the five figures above. Each stage retains its
captures; fresh replays use a new directory.

In `final/`, `gallery.png` is the tracked sheet; `all-routes.png` also shows
the downloaded and fixture-export routes. `capture/ui/` contains the actual
workbench. See `case-summary.csv`, `signed-arms.csv`, `inventory.csv`,
`features.csv`, `pages.csv`, `residuals.csv`, `raster-samples.csv`,
`reference-locks.csv` and `cli.csv` for individual measurements and hashes.
