# PGFPlots numeric histograms

[Physical comparison sheet](../../../docs/qa/assets/native-pgfplots-histograms.png).
Rows are complete figures; columns use the same page origin and scale. The
last column retains the entire 226.661 mm frozen control, including overflow.

| Open in the workbench | Source / what distinguishes it |
| --- | --- |
| `/#hist-manual-intervals` | Statistics manual 1024-1037: 12 samples; three filled bins of 3, 2, 7, interval captions, vertical grid and outward x ticks. |
| `/#hist-manual-const` (public) | Manual 1274-1287: five constant-step segments and four dots at 1, 4, 7, 10. |
| `/#hist-manual-cumulative-x` (public) | Manual 1179-1193: literal `file {plotdata/pgfplots.randn.dat}`, ten filled cumulative bars, no dots, four half-open interval labels. |
| `/#hist-manual-sharp` | Manual 1310-1324: two diagonals and three dots at 1, 4, 7 with `intervals=false`. |
| `/#hist-four-bin-modes` | Six x values, different y values, four quarter-width bins. Count 2/0/1/3; density 4/3, 0, 2/3, 2; cumulative 2/2/3/6; CDF 1/3, 1/3, 1/2, 1. Includes both range endpoints and an empty bin. |

The four manual pictures are byte-for-byte excerpts of `pgfplots.libs.statistics.tex`
in the installed `pgfplots.doc.src.tar.bz2`; the standalone wrappers use
`compat=1.18`. [Public step](../examples/pgfplots/hist-manual-const.tex),
[public cumulative](../examples/pgfplots/hist-manual-cumulative-x.tex) and
[original data](../examples/pgfplots/plotdata/pgfplots.randn.dat) are the
canonical files. The 8,000-row archive member is 136,000 bytes, SHA-256
`a3ec53b6c02c38e42319a13b32324b8670a0ceb7e89b543a9b713a91603550f4`.

## Findings

- Frozen `ca5b3ae698e02b2980e4a5e4e480c62775774eba`; renderer `f9e4ba47b1b553e13e26b41b79e44345a832900e398dfe062b26927991ce44d7`.
  The workbench received the correct file but showed empty cumulative axes with zero diagnostics. Step and sharp both became three rectangular outlines. The interval-label page was 2.965 mm too short, and the four-bin control was 161.015 mm too wide.
- Final capture `outputs/qa/2026-11-25-pgfplots-histograms/final-comma/`, renderer `5980c62a7a89d98cb1a32fdb1209f28997deb2eaf6bb7b0b99a5312f7897ed03` (`mathBox.js`: `94b4c89e5f83`).
  All five diagrams have the original counts, paint operations and pen widths. The four-bin control is back to 65.647 mm (PDF: 65.646). Step and sharp have the right ticks and no extra closing mark. MacTeX and local tikztosvg rendered 5/5, with zero TeX warnings or browser diagnostics. In all five cases the canonical-source strict CLI SVG equals the actual workbench Download byte for byte.
  A subsequent worktree fingerprint `d55d273d45a156bcb5ad19af32873c2a85b5f09b76dafed863bc31ef7848a9a3` produced the same five SVGs again from both fresh Chrome deep links and the strict CLI (`final-comma/equivalent-d55d273d45a1/`).
- The original **MacTeX PDF** of the cumulative case gives 11, **154**, 811, 2491, 4841, 6828, 7733, 7957, 7996, 8000 from its bar tops. The converter and renderer agree to the nearest observation. Straight binary64 binning gives **155** at the second bar: archive row 2153 is just 0.00000064 below the mathematical bin edge. No observations were replaced or regenerated.
- Before the grouped-comma fix, the cumulative page was 0.58815 mm too wide: the SVG's first zero in `2,000` sat 1.663 PDF points too far right. Final: PDF 66.07669 mm wide, workbench 66.07907 mm (+0.00238 mm); first-zero x is 4.60865 vs 4.60856 mm. All ten bar edges are within 0.00209 mm horizontally and 0.00104 mm vertically. Only this example's Download changed from the pre-comma capture.
- Across all five figures, the largest absolute differences versus the PDF are 0.00253 mm for the axis frame, 0.00252 mm for ticks/grid, and 0.00209 mm for plotted geometry. The left and bottom label-ink bounds in the workbench coincide with the PDF to the pixel (384 dpi). Standalone Chrome reaches 0.13229 mm (2 pixels) and CLI/librsvg 0.19844 mm (3 pixels) on those ink bounds. The original PDF **rasterizations** and native converter PNGs were byte-identical to baseline in all five cases; newly compiled PDF file hashes are not expected to match.
- At 384 dpi the PDF/manual blue fill is `#b3b3ff` in Poppler and Chrome, `#b2b2ff` via native tikztosvg/librsvg. The four-bin cyan fill is `#bfebfb` in Poppler and `#bfeafb` in Chrome and librsvg. The downloaded SVG has the same geometry in standalone Chrome and the CLI, but standalone font rasterization differs from the editor; compare the actual glyphs on the sheet.

## Reproduce

From the project root: local Node dependencies, Chrome/Playwright, MacTeX with the PGFPlots docs archive, tikztosvg, Poppler, librsvg, and Python with PyMuPDF, NumPy and Pillow. Set `PLAYWRIGHT_MJS` to the installed Playwright `index.mjs`.

```sh
F=test/fixtures/native-pgfplots-histograms
Q=outputs/qa/2026-11-25-pgfplots-histograms
mkdir -p "$Q/frozen-ca5b3ae"
git archive ca5b3ae -- bin src web scripts package.json package-lock.json | tar -x -C "$Q/frozen-ca5b3ae"
rsync -a node_modules "$Q/frozen-ca5b3ae/"
node "$F/replay.mjs" inputs "$Q/replay-catalog"
# Run once per renderer. Use a fresh stage name; never overwrite the frozen run.
TREE="$Q/frozen-ca5b3ae" STAGE="$Q/before-replay" REV=ca5b3ae
node "$TREE/scripts/render-example-fixtures.js" --fixtures "$Q/replay-catalog" --output "$STAGE" \
  --native-reference --native-latex-engine pdflatex --strict-tikztosvg --tikztosvg-engine pdflatex \
  --math-renderer svg-text --no-comparison-grid --external-timeout-ms 180000
TIKZKIT_QA_RERENDER=1 node test/fixtures/native-positioning-targets/capture.mjs "$TREE" "$STAGE" "$PLAYWRIGHT_MJS" "$REV"
node "$F/replay.mjs" routes "$STAGE" "$PLAYWRIGHT_MJS"
python3 "$F/measure.py" "$STAGE"
```

For a candidate use `TREE=.` (or a frozen copy of the same directories/dependencies), a fresh `STAGE` and an identifying `REV`. Use `measure.py --verify "$STAGE"` to require matching measured data/topology, clean diagnostics, and page/frame/tick/paint positions within 0.02 mm; label ink is measured separately. The disposable input catalog uses symlinks so the native resource retains its printed name. MacTeX's `reference.tex` is checked against the original; the CLI is invoked on the canonical path. No frozen SVG is used for a render.

```sh
node "$F/replay.mjs" routes "$STAGE" "$PLAYWRIGHT_MJS" test/fixtures/examples
TIKZKIT_QA_COMPARE_TREE=. node "$F/replay.mjs" routes "$STAGE" "$PLAYWRIGHT_MJS"
python3 "$F/gallery.py" "$Q/before" "$STAGE" docs/qa/assets/native-pgfplots-histograms.png
node "$F/replay.mjs" serve "$STAGE"
```

The last command prints a local link to the captured build. Each stage keeps
`summary.json`, `capture.json`, `routes.json`, `geometry.json`, the unaltered PDF,
the UI screenshots, actual SVGs and their native-size PNGs. `public-routes.json`
records both public deep links, their downloaded SVG hashes and the data received by Chrome.
