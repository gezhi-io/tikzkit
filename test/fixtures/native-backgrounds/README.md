# End-of-picture backgrounds

[Compare all seven pictures](../../../docs/qa/assets/2026-11-25-native-backgrounds.png).

Seven one-page originals from TeX Live 2025's
`doc/generic/pgf/pgfmanual-en-library-backgrounds.tex`, copyright 2019
by Till Tantau (LaTeX Project Public License and/or GNU Free Documentation
License; see `doc/generic/pgf/licenses/LICENSE`). The [manifest](manifest.json)
gives the inclusive manual lines. Each document body, including any preceding
`\tikzset`, is byte-identical to those lines. The standalone class crops each
TikZ picture with a 2 pt border. No explicit background scopes are tested.

## Replay

From the repository root, set `TREE` to an immutable renderer tree with the
project dependencies, `REV` to its identifying label, `STAGE` to a **new**
directory, and `PW` to the local `playwright/index.mjs` that can launch Chrome.
The measurement step uses Python with PyMuPDF, NumPy and Pillow.

```sh
F=test/fixtures/native-backgrounds
command -v tikztosvg rsvg-convert pdflatex pdftocairo
node "$TREE/scripts/render-example-fixtures.js" --fixtures "$F" --output "$STAGE" \
  --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
  --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
TIKZKIT_QA_RERENDER=1 node test/fixtures/native-positioning-targets/capture.mjs \
  "$TREE" "$STAGE" "$PW" "$REV"
python3 -B "$F/compare.py" "$STAGE"
```

MacTeX compiles the whole original file. Local `tikztosvg` receives the
gallery's separately saved converter input (classical arrow default and the
standalone border). Chrome clicks **Render** and **Download SVG**; the saved
download is reopened in Chrome. The original PDF uses Poppler; the native
converter SVG and a separate strict CLI export are also rasterized with
librsvg. Raw UI screenshots, SVGs and PDFs live in the stage's `capture/`.

The frozen runtime in `output/tree-42c68381` is from Git commit `42c68381`.
The ready working-tree snapshot in `output/tree-c25dbd70a225` is named by its
renderer fingerprint, not a commit. To rebuild the sheet from their saved captures:

```sh
BEFORE="$F/output/before-42c68381"
AFTER="$F/output/after-c25dbd70a225"
python3 -B "$F/compare.py" "$BEFORE" "$AFTER" docs/qa/assets/2026-11-25-native-backgrounds.png
```

`metrics.json` records the page size, pens and line endpoints in mm, sampled
colors, download/CLI hash equality, diagnostics and pixel differences.
Differences are measured at 384 dpi from each page's top-left origin, padding
only the right and bottom with white. The `changedOver16` count means a change
greater than 16 in any 8-bit RGB channel, not an exact pixel-match claim.

Chrome 158.0.8127.37: PDF vs live fell from 317,474 to 29,201 pixels above
that threshold. Every picture improved. The final page sizes differ from the
PDF by at most 0.00022 mm on either axis; default/red grids have 4/8 segments,
and the styled top pen measures 1.51324 mm in the PDF vs 1.51322 mm in the SVG.
All 7 downloads match strict CLI bytes, with zero editor/export diagnostics
or browser errors. At 384 dpi the final CLI via librsvg has no pixels over
the threshold vs PDF, but neither the rasterizers nor all their pixels are identical.

After the separate hook edit, Chrome and the strict CLI returned the same
seven download hashes on renderer `24a68f0ca1d3`. The three public gallery
links (blue rounded, framed + gridded, four sides) also returned their matching
downloads with zero diagnostics. See `$AFTER/equivalent-24a68f0ca1d3/routes.json`
and `public-routes.json` beside it. To repeat the seven-link check against
the current working tree:

```sh
TIKZKIT_QA_COMPARE_TREE=. node test/fixtures/native-pgfplots-histograms/replay.mjs routes "$AFTER" "$PW"
```
